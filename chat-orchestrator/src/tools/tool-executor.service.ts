import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type Redis from 'ioredis';
import { AppError, ErrorCode } from '@genxtaxi/ai-shared';
import { CoreBackendClient } from '../gateway-client/core-backend.client';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  SupportTicket,
  SupportTicketDocument,
} from '../schemas/support-ticket.schema';
import {
  RefundRequest,
  RefundRequestDocument,
} from '../schemas/refund-request.schema';
import { TOOL_SPEC_BY_NAME } from './tool-schemas';
import { ActionCard, PendingAction, ToolContext, ToolOutcome } from './tool.types';
import { scanMoney } from './money-scan';

/**
 * Validates, authorizes and executes tools (spec §2.4). Read-only tools run
 * immediately; state-changing tools (book/cancel/refund) return an action card
 * and a deferred commit that only fires on user Confirm (spec §2.2).
 */
@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private readonly core: CoreBackendClient,
    @InjectModel(SupportTicket.name)
    private readonly tickets: Model<SupportTicketDocument>,
    @InjectModel(RefundRequest.name)
    private readonly refunds: Model<RefundRequestDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Server-side authorization + JSON-schema arg validation (spec §2.4, §2.8). */
  private assertAllowed(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): void {
    const spec = TOOL_SPEC_BY_NAME.get(name);
    if (!spec) throw new AppError(ErrorCode.VALIDATION, `Unknown tool: ${name}`);
    if (!spec.allowedRoles.includes(ctx.user.role)) {
      throw new AppError(ErrorCode.FORBIDDEN, `Role ${ctx.user.role} may not call ${name}`);
    }
    const required = (spec.parameters as { required?: string[] }).required ?? [];
    for (const field of required) {
      if (args[field] === undefined || args[field] === null || args[field] === '') {
        throw new AppError(ErrorCode.VALIDATION, `Tool ${name} missing required arg: ${field}`);
      }
    }
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolOutcome> {
    this.assertAllowed(name, args, ctx);
    switch (name) {
      case 'get_fare_estimate':
        return this.getFareEstimate(args, ctx);
      case 'get_ride_status':
        return this.getRideStatus(args, ctx);
      case 'get_payment_history':
        return this.getPaymentHistory(args, ctx);
      case 'explain_charge':
        return this.explainCharge(args, ctx);
      case 'escalate_to_human':
        return this.escalate(args, ctx);
      case 'book_ride':
        return this.bookRide(args, ctx);
      case 'cancel_ride':
        return this.cancelRide(args, ctx);
      case 'initiate_refund':
        return this.initiateRefund(args, ctx);
      default:
        throw new AppError(ErrorCode.VALIDATION, `Unhandled tool: ${name}`);
    }
  }

  // ── read-only tools ───────────────────────────────────────────────────────

  private parseCoords(s: string): { lat: number; lng: number } | string {
    const m = /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/.exec(s);
    return m ? { lat: Number(m[1]), lng: Number(m[2]) } : s;
  }

  private async getFareEstimate(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
    const res = await this.core.request('POST', '/rides/estimate', ctx.user.token, {
      pickupCoords: this.parseCoords(String(args.pickup)),
      dropoffCoords: this.parseCoords(String(args.dropoff)),
      rideType: args.ride_type,
    });
    const data = (res.ok ? res.data : { error: res.error }) as Record<string, unknown>;
    return { kind: 'result', data, moneyAmounts: scanMoney(data) };
  }

  private async getRideStatus(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
    const path = args.ride_id ? `/rides/${args.ride_id}` : '/rides/active';
    const res = await this.core.request('GET', path, ctx.user.token);
    const data = (res.ok ? res.data : { error: res.error }) as Record<string, unknown>;
    return { kind: 'result', data, moneyAmounts: scanMoney(data) };
  }

  private async getPaymentHistory(_args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
    const res = await this.core.request('GET', '/wallet/history', ctx.user.token);
    const data = (res.ok ? res.data : { error: res.error }) as Record<string, unknown>;
    // Redact any card fragments defensively (spec §2.4 redact card PAN).
    const redacted = JSON.parse(
      JSON.stringify(data).replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_CARD]'),
    );
    return { kind: 'result', data: redacted, moneyAmounts: scanMoney(redacted) };
  }

  private async explainCharge(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
    const res = await this.core.request('GET', `/rides/${args.ride_id}`, ctx.user.token);
    const data = (res.ok ? res.data : { error: res.error }) as Record<string, unknown>;
    return { kind: 'result', data, moneyAmounts: scanMoney(data) };
  }

  private async escalate(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
    const ticket = await this.tickets.create({
      sessionId: new Types.ObjectId(ctx.sessionId),
      userId: ctx.user.userId,
      priority: (args.priority as string) ?? 'normal',
      summary: String(args.summary ?? 'User requested a human agent'),
      category: 'question',
    });
    return {
      kind: 'result',
      data: { escalated: true, ticketId: ticket._id.toString() },
      moneyAmounts: [],
    };
  }

  // ── confirmation-gated tools ──────────────────────────────────────────────

  private async bookRide(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
    // Preview the fare so the card can show an amount sourced from a tool result.
    const est = await this.core.request('POST', '/rides/estimate', ctx.user.token, {
      pickupCoords: this.parseCoords(String(args.pickup)),
      dropoffCoords: this.parseCoords(String(args.dropoff)),
      rideType: args.ride_type,
    });
    const money = scanMoney(est.data)[0];
    const card: ActionCard = {
      action: 'book_ride',
      title: 'Confirm your booking',
      lines: [
        `Pickup: ${args.pickup}`,
        `Dropoff: ${args.dropoff}`,
        `Type: ${args.ride_type}`,
        ...(args.scheduled_at ? [`Scheduled: ${args.scheduled_at}`] : []),
      ],
      money,
      toolCallId: '', // set by caller
      confirmLabel: 'Confirm booking',
      declineLabel: 'Cancel',
    };
    const pendingAction: PendingAction = {
      tool: 'book_ride',
      commit: {
        type: 'core',
        method: 'POST',
        path: '/rides',
        body: {
          pickup: this.parseCoords(String(args.pickup)),
          dropoff: this.parseCoords(String(args.dropoff)),
          rideType: args.ride_type,
          scheduledFor: args.scheduled_at,
          surgeAccepted: true,
        },
      },
      idempotencyKey: uuidv4(),
    };
    return { kind: 'action_card', card, pendingAction, moneyAmounts: money ? [money] : [] };
  }

  private async cancelRide(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
    // Read the ride to surface any cancellation fee before the user confirms.
    const ride = await this.core.request('GET', `/rides/${args.ride_id}`, ctx.user.token);
    const fee = scanMoney(ride.data).find((m) => m.amount >= 0);
    const card: ActionCard = {
      action: 'cancel_ride',
      title: 'Confirm cancellation',
      lines: [
        `Ride: ${args.ride_id}`,
        `Reason: ${args.reason}`,
        fee ? `Cancellation fee may apply.` : `No cancellation fee expected.`,
      ],
      money: fee,
      toolCallId: '',
      confirmLabel: 'Confirm cancellation',
      declineLabel: 'Keep ride',
    };
    const pendingAction: PendingAction = {
      tool: 'cancel_ride',
      commit: {
        type: 'core',
        method: 'POST',
        path: `/rides/${args.ride_id}/cancel`,
        body: { reason: args.reason },
      },
      idempotencyKey: uuidv4(),
    };
    return { kind: 'action_card', card, pendingAction, moneyAmounts: fee ? [fee] : [] };
  }

  private async initiateRefund(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutcome> {
    const amount = { amount: Number(args.amount), currency: String(args.currency).toUpperCase() };
    const card: ActionCard = {
      action: 'initiate_refund',
      title: 'Request a refund',
      lines: [
        `Ride: ${args.ride_id}`,
        `Reason: ${args.reason}`,
        `This request will be reviewed by our team.`,
      ],
      money: amount,
      toolCallId: '',
      confirmLabel: 'Submit request',
      declineLabel: 'Cancel',
    };
    const pendingAction: PendingAction = {
      tool: 'initiate_refund',
      commit: {
        type: 'refund_queue',
        rideId: String(args.ride_id),
        amount,
        reason: String(args.reason),
      },
      idempotencyKey: uuidv4(),
    };
    return { kind: 'action_card', card, pendingAction, moneyAmounts: [amount] };
  }

  // ── commit (called on Confirm) ────────────────────────────────────────────

  /**
   * Commit a previously-confirmed action. Idempotent via a Redis guard keyed on
   * the action's idempotencyKey (spec §2.8 duplicate action protection).
   */
  async commit(action: PendingAction, ctx: ToolContext): Promise<Record<string, unknown>> {
    const guardKey = `idem:${action.idempotencyKey}`;
    const first = await this.redis.set(guardKey, '1', 'EX', 600, 'NX');
    if (first === null) {
      throw new AppError(ErrorCode.CONFLICT, 'This action was already submitted');
    }

    if (action.commit.type === 'refund_queue') {
      return this.commitRefund(action, ctx);
    }

    const { method, path, body } = action.commit;
    const res = await this.core.request(method, path, ctx.user.token, {
      ...body,
      idempotencyKey: action.idempotencyKey,
    });
    if (!res.ok) {
      throw new AppError(ErrorCode.INTERNAL, res.error ?? 'Action failed');
    }
    return (res.data as Record<string, unknown>) ?? { ok: true };
  }

  private async commitRefund(action: PendingAction, ctx: ToolContext): Promise<Record<string, unknown>> {
    if (action.commit.type !== 'refund_queue') throw new AppError(ErrorCode.INTERNAL, 'bad action');
    // Rate-limit refund requests per user per day (spec §2.8 refund abuse).
    const dayKey = `refund:${ctx.user.userId}:${new Date().toISOString().slice(0, 10)}`;
    const count = await this.redis.incr(dayKey);
    if (count === 1) await this.redis.expire(dayKey, 86_400);

    const ticket = await this.tickets.create({
      sessionId: new Types.ObjectId(ctx.sessionId),
      userId: ctx.user.userId,
      priority: 'high',
      summary: `Refund request for ride ${action.commit.rideId}: ${action.commit.reason}`,
      category: 'refund',
    });
    const refund = await this.refunds.create({
      ticketId: ticket._id,
      userId: ctx.user.userId,
      rideId: action.commit.rideId,
      amount: action.commit.amount,
      reason: action.commit.reason,
    });
    this.logger.log(`Queued refund ${refund._id} for admin (user ${ctx.user.userId})`);
    return {
      queued: true,
      ticketId: ticket._id.toString(),
      refundRequestId: refund._id.toString(),
      anomaly: count > 3, // flag suspicious volume for admin
    };
  }
}

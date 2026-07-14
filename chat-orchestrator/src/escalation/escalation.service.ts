import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SupportTicket,
  SupportTicketDocument,
  TicketStatus,
} from '../schemas/support-ticket.schema';
import { SessionsService } from '../orchestrator/sessions.service';
import { SessionStatus } from '../schemas/chat-session.schema';

/** Human-handoff ticketing (spec §2.3 live handoff inbox, §2.6 support_tickets). */
@Injectable()
export class EscalationService {
  constructor(
    @InjectModel(SupportTicket.name)
    private readonly tickets: Model<SupportTicketDocument>,
    private readonly sessions: SessionsService,
  ) {}

  async createTicket(input: {
    sessionId: string;
    userId: string;
    summary: string;
    priority: string;
    category: string;
  }): Promise<SupportTicketDocument> {
    const ticket = await this.tickets.create({
      sessionId: new Types.ObjectId(input.sessionId),
      userId: input.userId,
      summary: input.summary,
      priority: input.priority,
      category: input.category,
    });
    await this.sessions.setStatus(input.sessionId, SessionStatus.ESCALATED);
    return ticket;
  }

  // ── admin inbox queries (spec §2.3) ───────────────────────────────────────

  listInbox(filter: { status?: TicketStatus; category?: string }) {
    const q: Record<string, unknown> = {};
    if (filter.status) q.status = filter.status;
    if (filter.category) q.category = filter.category;
    return this.tickets.find(q).sort({ priority: -1, createdAt: -1 }).limit(200).exec();
  }

  async assign(ticketId: string, assigneeId: string) {
    return this.tickets.findByIdAndUpdate(
      ticketId,
      { $set: { assigneeId, status: TicketStatus.IN_REVIEW } },
      { new: true },
    );
  }

  async resolve(ticketId: string, csatScore?: number) {
    return this.tickets.findByIdAndUpdate(
      ticketId,
      { $set: { status: TicketStatus.RESOLVED, resolvedAt: new Date(), csatScore } },
      { new: true },
    );
  }
}

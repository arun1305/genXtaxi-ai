import { Role } from '@genxtaxi/ai-shared';
import { ChatUser } from '../common/auth';

/** A structured confirmation card (spec §2.2) rendered by the client. */
export interface ActionCard {
  /** book_ride | cancel_ride | initiate_refund */
  action: string;
  title: string;
  /** Human-readable lines (already localized upstream where possible). */
  lines: string[];
  /** Money shown to the user — always sourced from a tool result. */
  money?: { amount: number; currency: string };
  /** The tool call id this card confirms. */
  toolCallId: string;
  confirmLabel: string;
  declineLabel: string;
}

/**
 * The outcome of running a tool. Either an immediate result (read-only tools)
 * or a confirmation card + a deferred action that only commits on Confirm
 * (state-changing tools — spec §2.2 action confirmation cards).
 */
export type ToolOutcome =
  | { kind: 'result'; data: Record<string, unknown>; moneyAmounts: { amount: number; currency: string }[] }
  | {
      kind: 'action_card';
      card: ActionCard;
      /** Persisted (Redis) until Confirm; describes the commit call. */
      pendingAction: PendingAction;
      moneyAmounts: { amount: number; currency: string }[];
    };

export interface PendingAction {
  tool: string;
  /** Core-backend commit spec, or a local commit marker (e.g. refund queue). */
  commit:
    | { type: 'core'; method: 'POST' | 'PATCH'; path: string; body?: Record<string, unknown> }
    | { type: 'refund_queue'; rideId: string; amount: { amount: number; currency: string }; reason: string };
  /** Idempotency key (spec §2.8 duplicate action protection). */
  idempotencyKey: string;
}

export interface ToolContext {
  user: ChatUser;
  sessionId: string;
  lang: string;
  traceId: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  /** Roles permitted to invoke this tool (server-side, never client-trusted). */
  allowedRoles: Role[];
  /** True for book/cancel/refund — needs an explicit Confirm before commit. */
  requiresConfirmation: boolean;
}

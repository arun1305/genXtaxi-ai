import { ActionCard } from '../tools/tool.types';

/** SSE event contract (spec §2.7 stream event types). */
export type StreamEvent =
  | { type: 'token'; data: { text: string } }
  | { type: 'tool_call_proposed'; data: { id: string; name: string; arguments: Record<string, unknown> } }
  | { type: 'tool_result'; data: { name: string; result: Record<string, unknown> } }
  | { type: 'action_card'; data: ActionCard }
  | { type: 'done'; data: { grounded: boolean; escalated?: boolean; awaitingConfirmation?: boolean } }
  | { type: 'error'; data: { message: string } };

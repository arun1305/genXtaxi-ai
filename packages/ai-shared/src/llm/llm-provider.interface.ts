/**
 * Provider-agnostic LLM abstraction (spec §1: "Abstract behind a LLMProvider
 * interface so the model is swappable. Never hardcode a vendor in business
 * logic."). Concrete implementations (Groq, Anthropic, …) live in ai-gateway.
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present on tool result messages. */
  toolName?: string;
  toolCallId?: string;
}

/** JSON-schema function/tool definition passed to the model (spec §2.4). */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ProposedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmCompletionParams {
  messages: ChatMessage[];
  /** Logical model id from the task→model map, resolved by the router. */
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  /** Force structured JSON output (spec §3.3 aspect extraction). */
  responseFormat?: 'text' | 'json';
  /** Abort signal for timeouts / circuit-breaker. */
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmCompletionResult {
  content: string;
  toolCalls: ProposedToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason: string;
}

export interface LlmStreamChunk {
  delta: string;
  done: boolean;
  toolCalls?: ProposedToolCall[];
  usage?: TokenUsage;
}

export interface LLMProvider {
  /** Stable id used in logs and the task→model map, e.g. "groq". */
  readonly id: string;

  complete(params: LlmCompletionParams): Promise<LlmCompletionResult>;

  /** Token streaming for the chat UI (SSE/WebSocket in Phase 2). */
  stream(
    params: LlmCompletionParams,
  ): AsyncIterable<LlmStreamChunk>;
}

/**
 * Config-driven task→model routing (spec §1: "Keep a config-driven map
 * { task -> model }. Never hardcode a vendor in business logic.").
 *
 * The router in ai-gateway reads this map to pick a provider + model per task,
 * with a fallback chain (e.g. Groq Llama 3.3 70B for chat, 8B for cheap
 * classification/routing).
 */

export enum AiTask {
  CHAT = 'chat',
  CLASSIFY = 'classify',
  ROUTE = 'route',
  LANG_DETECT = 'lang_detect',
  ASPECT_EXTRACTION = 'aspect_extraction',
  SUMMARIZE = 'summarize',
  EMBEDDING = 'embedding',
}

export interface ModelRoute {
  /** Provider id, e.g. "groq" | "anthropic" | "cohere". */
  provider: string;
  /** Vendor model id, e.g. "llama-3.3-70b-versatile". */
  model: string;
  /** Ordered fallbacks tried on provider error / circuit-open. */
  fallbacks?: Array<{ provider: string; model: string }>;
  /** Per-1M-token pricing in USD minor units (cents) for cost logging. */
  inputPricePerMillionUsd?: number;
  outputPricePerMillionUsd?: number;
}

export type TaskModelMap = Record<AiTask, ModelRoute>;

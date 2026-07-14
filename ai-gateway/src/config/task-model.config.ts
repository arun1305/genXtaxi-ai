import { AiTask, TaskModelMap } from '@genxtaxi/ai-shared';
import { AppEnv } from './env.validation';

/**
 * Builds the config-driven task→model map (spec §1). Business logic asks for a
 * task (e.g. AiTask.CHAT); the router resolves provider + model + fallbacks.
 * Changing a model = changing config/env, never touching code.
 */
export function buildTaskModelMap(env: AppEnv): TaskModelMap {
  const groqChat = { provider: 'groq', model: env.LLM_CHAT_MODEL };
  const groqCheap = { provider: 'groq', model: env.LLM_CHEAP_MODEL };
  const anthropicFallback = {
    provider: 'anthropic',
    model: env.ANTHROPIC_FALLBACK_MODEL,
  };

  return {
    // Strong FR/AR chat on the 70B model, fall back to a cheaper model then Anthropic.
    [AiTask.CHAT]: {
      ...groqChat,
      fallbacks: [groqCheap, anthropicFallback],
      inputPricePerMillionUsd: 59,
      outputPricePerMillionUsd: 79,
    },
    [AiTask.CLASSIFY]: { ...groqCheap, fallbacks: [anthropicFallback] },
    [AiTask.ROUTE]: { ...groqCheap },
    [AiTask.LANG_DETECT]: { ...groqCheap },
    [AiTask.ASPECT_EXTRACTION]: { ...groqCheap, fallbacks: [groqChat] },
    [AiTask.SUMMARIZE]: { ...groqChat, fallbacks: [groqCheap] },
    [AiTask.EMBEDDING]: {
      provider: env.EMBEDDING_PROVIDER,
      model: env.EMBEDDING_MODEL,
    },
  };
}

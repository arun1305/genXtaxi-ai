import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CircuitBreaker from 'opossum';
import {
  AiTask,
  LLMProvider,
  LlmCompletionParams,
  LlmCompletionResult,
  ModelRoute,
  ProviderUnavailableError,
  TaskModelMap,
} from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';
import { buildTaskModelMap } from '../config/task-model.config';
import { GroqProvider } from './groq.provider';
import { AnthropicProvider } from './anthropic.provider';

/**
 * Resolves a task to a provider+model via the config-driven map and executes
 * with a per-provider circuit breaker (spec §5: circuit breakers on provider
 * errors) plus the fallback chain (spec §1). Business logic never references a
 * vendor directly — it asks for an AiTask.
 */
@Injectable()
export class LlmRouterService implements OnModuleInit {
  private readonly logger = new Logger(LlmRouterService.name);
  private taskMap!: TaskModelMap;
  private providers!: Map<string, LLMProvider>;
  private breakers = new Map<string, CircuitBreaker<[LlmCompletionParams], LlmCompletionResult>>();

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly groq: GroqProvider,
    private readonly anthropic: AnthropicProvider,
  ) {}

  onModuleInit() {
    this.taskMap = buildTaskModelMap(this.readEnv());
    this.providers = new Map<string, LLMProvider>([
      [this.groq.id, this.groq],
      [this.anthropic.id, this.anthropic],
    ]);
  }

  /** Resolve the route for a task (exposed for cost pricing + logging). */
  routeFor(task: AiTask): ModelRoute {
    return this.taskMap[task];
  }

  /**
   * Execute a completion for a task, trying the primary route then each
   * fallback whenever the circuit is open or the call errors.
   */
  async complete(
    task: AiTask,
    params: Omit<LlmCompletionParams, 'model'>,
  ): Promise<LlmCompletionResult> {
    const route = this.taskMap[task];
    const chain = [
      { provider: route.provider, model: route.model },
      ...(route.fallbacks ?? []),
    ];

    let lastError: unknown;
    for (const hop of chain) {
      const provider = this.providers.get(hop.provider);
      if (!provider) continue;
      try {
        const breaker = this.breakerFor(provider);
        return await breaker.fire({ ...params, model: hop.model });
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `Provider ${hop.provider}/${hop.model} failed for ${task}: ${
            (err as Error).message
          } — trying next fallback`,
        );
      }
    }
    throw new ProviderUnavailableError(
      route.provider,
      lastError instanceof Error ? lastError.message : 'all fallbacks exhausted',
    );
  }

  /** Streaming path bypasses the breaker's promise semantics; uses primary + guard. */
  stream(task: AiTask, params: Omit<LlmCompletionParams, 'model'>) {
    const route = this.taskMap[task];
    const provider = this.providers.get(route.provider);
    if (!provider) {
      throw new ProviderUnavailableError(route.provider, 'not registered');
    }
    return provider.stream({ ...params, model: route.model });
  }

  private breakerFor(provider: LLMProvider) {
    let breaker = this.breakers.get(provider.id);
    if (breaker) return breaker;

    breaker = new CircuitBreaker(
      (p: LlmCompletionParams) => provider.complete(p),
      {
        timeout: this.config.get('CB_TIMEOUT_MS', { infer: true }),
        errorThresholdPercentage: this.config.get('CB_ERROR_THRESHOLD_PERCENT', {
          infer: true,
        }),
        resetTimeout: this.config.get('CB_RESET_TIMEOUT_MS', { infer: true }),
        name: `llm:${provider.id}`,
      },
    );
    breaker.on('open', () =>
      this.logger.error(`Circuit OPEN for provider ${provider.id}`),
    );
    breaker.on('halfOpen', () =>
      this.logger.warn(`Circuit HALF-OPEN for provider ${provider.id}`),
    );
    this.breakers.set(provider.id, breaker);
    return breaker;
  }

  private readEnv(): AppEnv {
    // ConfigService is populated from validated env; read the strongly-typed keys.
    return {
      LLM_CHAT_MODEL: this.config.get('LLM_CHAT_MODEL', { infer: true }),
      LLM_CHEAP_MODEL: this.config.get('LLM_CHEAP_MODEL', { infer: true }),
      ANTHROPIC_FALLBACK_MODEL: this.config.get('ANTHROPIC_FALLBACK_MODEL', {
        infer: true,
      }),
      EMBEDDING_PROVIDER: this.config.get('EMBEDDING_PROVIDER', { infer: true }),
      EMBEDDING_MODEL: this.config.get('EMBEDDING_MODEL', { infer: true }),
    } as AppEnv;
  }
}

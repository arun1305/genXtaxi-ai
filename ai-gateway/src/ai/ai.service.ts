import { Injectable } from '@nestjs/common';
import {
  AiTask,
  AuthenticatedUser,
  ChatMessage,
  ToolDefinition,
} from '@genxtaxi/ai-shared';
import { LlmRouterService } from '../providers/llm-router.service';
import { EmbeddingRouterService } from '../providers/embedding-router.service';
import { BudgetService } from '../budget/budget.service';
import { RedactionService } from '../redaction/redaction.service';
import { ObservabilityService } from '../observability/observability.service';
import { PricingService } from '../cost/pricing.service';

export interface CompleteRequest {
  task: AiTask;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  promptVersion?: string;
  feature: string;
}

/**
 * The single entrypoint every AI feature uses (spec §1: core apps never call a
 * provider directly). Enforces the full cross-cutting chain per call:
 *   budget check → PII redaction → route → provider (with breaker/fallback) →
 *   price → observability (log + metrics) → budget consume.
 */
@Injectable()
export class AiService {
  constructor(
    private readonly router: LlmRouterService,
    private readonly embeddings: EmbeddingRouterService,
    private readonly budget: BudgetService,
    private readonly redaction: RedactionService,
    private readonly observability: ObservabilityService,
    private readonly pricing: PricingService,
  ) {}

  async complete(
    req: CompleteRequest,
    user: AuthenticatedUser,
    traceId: string,
  ) {
    await this.budget.assertWithinBudget(user.userId);

    // Redact PII from every user/assistant message before it leaves our infra.
    const messages = req.messages.map((m) =>
      m.role === 'system'
        ? m
        : { ...m, content: this.redaction.scrub(m.content).text },
    );

    const start = Date.now();
    const route = this.router.routeFor(req.task);
    let outcome = 'success';
    try {
      const result = await this.router.complete(req.task, {
        messages,
        tools: req.tools,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        responseFormat: req.responseFormat,
      });
      if (result.model !== route.model) outcome = 'fallback';

      const { money, usdMicros } = this.pricing.price(route, result.usage);
      const latencyMs = Date.now() - start;

      await this.observability.record({
        traceId,
        userId: user.userId,
        role: user.role,
        feature: req.feature,
        model: result.model,
        promptVersion: req.promptVersion,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cost: money,
        costUsdMicros: usdMicros,
        latencyMs,
        toolCalls: result.toolCalls.map((t) => t.name),
        outcome,
      });

      await this.budget.consume(
        user.userId,
        result.usage.inputTokens + result.usage.outputTokens,
      );

      return { ...result, cost: money, latencyMs, traceId };
    } catch (err) {
      await this.observability.record({
        traceId,
        userId: user.userId,
        role: user.role,
        feature: req.feature,
        model: route.model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        outcome: 'error',
      });
      throw err;
    }
  }

  /** Embedding passthrough (budget + observability applied). */
  async embed(
    texts: string[],
    user: AuthenticatedUser,
    traceId: string,
    feature = 'gateway',
  ) {
    await this.budget.assertWithinBudget(user.userId);
    const start = Date.now();
    const result = await this.embeddings.embed({
      texts,
      inputType: 'search_document',
    });
    await this.observability.record({
      traceId,
      userId: user.userId,
      role: user.role,
      feature,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      outcome: 'success',
    });
    await this.budget.consume(user.userId, result.inputTokens);
    return { vectors: result.vectors, dimensions: this.embeddings.dimensions };
  }
}

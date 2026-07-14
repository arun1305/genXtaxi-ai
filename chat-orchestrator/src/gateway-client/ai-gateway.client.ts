import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiTask,
  ChatMessage,
  ProviderUnavailableError,
  ToolDefinition,
} from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';

export interface GatewayCompletion {
  content: string;
  toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  finishReason: string;
}

export interface KbHit {
  content: string;
  lang: string;
  score: number;
}

/**
 * Thin client for ai-gateway (spec §1: core apps never call an LLM directly —
 * always through ai-gateway). Forwards the caller's JWT so budgets/observability
 * are attributed to the real user.
 */
@Injectable()
export class AiGatewayClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService<AppEnv, true>) {
    this.baseUrl = config.get('AI_GATEWAY_URL', { infer: true });
  }

  async complete(
    token: string,
    body: {
      task: AiTask;
      messages: ChatMessage[];
      tools?: ToolDefinition[];
      feature: string;
      responseFormat?: 'text' | 'json';
    },
  ): Promise<GatewayCompletion> {
    const res = await fetch(`${this.baseUrl}/api/v1/ai/complete`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new ProviderUnavailableError(
        'ai-gateway',
        `HTTP ${res.status}: ${await res.text().catch(() => '')}`,
      );
    }
    return (await res.json()) as GatewayCompletion;
  }

  /** RAG retrieval (spec §2.4 step 2), pre-filtered by language. */
  async kbSearch(
    token: string,
    query: string,
    lang: string,
    topK = 5,
  ): Promise<KbHit[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/kb/search`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ query, lang, topK }),
    });
    if (!res.ok) return []; // degrade gracefully — never fail the chat on RAG miss
    return (await res.json()) as KbHit[];
  }

  private headers(token: string): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiTask, ChatMessage } from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';

/**
 * Client for ai-gateway (spec §1: never call an LLM directly). The batch
 * pipeline authenticates with a long-lived service token (INSIGHTS_SERVICE_TOKEN).
 */
@Injectable()
export class AiGatewayClient {
  private readonly logger = new Logger(AiGatewayClient.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService<AppEnv, true>) {
    this.baseUrl = config.get('AI_GATEWAY_URL', { infer: true });
    this.token = config.get('INSIGHTS_SERVICE_TOKEN', { infer: true });
  }

  /** Structured JSON completion (aspect extraction / summaries). Low temp. */
  async completeJson<T>(
    task: AiTask,
    messages: ChatMessage[],
    feature: string,
  ): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/ai/complete`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ task, messages, feature, responseFormat: 'json' }),
      });
      if (!res.ok) {
        this.logger.warn(`ai-gateway ${task} -> HTTP ${res.status}`);
        return null;
      }
      const body = (await res.json()) as { content: string };
      return JSON.parse(body.content) as T;
    } catch (err) {
      this.logger.error(`ai-gateway ${task} failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Embeddings for complaint clustering (spec §3.3 admin aggregation). */
  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/ai/embed`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ texts }),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { vectors: number[][] };
      return body.vectors ?? [];
    } catch {
      return [];
    }
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.token}`,
    };
  }
}

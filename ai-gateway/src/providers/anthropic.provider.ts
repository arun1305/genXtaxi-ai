import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  LLMProvider,
  LlmCompletionParams,
  LlmCompletionResult,
  LlmStreamChunk,
} from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';

/**
 * Anthropic fallback provider (spec §1: swappable provider strategy). Used when
 * the primary Groq provider's circuit breaker is open or errors persist.
 */
@Injectable()
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  private readonly client: Anthropic;

  constructor(config: ConfigService<AppEnv, true>) {
    this.client = new Anthropic({
      apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }),
    });
  }

  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
    const system = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');

    const res = await this.client.messages.create(
      {
        model: params.model,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.2,
        system: system || undefined,
        messages: params.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
      },
      { signal: params.signal },
    );

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      content: text,
      toolCalls: [],
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
      model: res.model,
      finishReason: res.stop_reason ?? 'end_turn',
    };
  }

  async *stream(
    params: LlmCompletionParams,
  ): AsyncIterable<LlmStreamChunk> {
    const system = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');

    const stream = this.client.messages.stream(
      {
        model: params.model,
        max_tokens: params.maxTokens ?? 1024,
        system: system || undefined,
        messages: params.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
      },
      { signal: params.signal },
    );

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { delta: event.delta.text, done: false };
      }
    }
    yield { delta: '', done: true };
  }
}

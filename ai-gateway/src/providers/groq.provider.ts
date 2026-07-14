import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  LLMProvider,
  LlmCompletionParams,
  LlmCompletionResult,
  LlmStreamChunk,
  ProposedToolCall,
} from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';

/**
 * Groq-hosted Llama provider (spec §1 default: Llama 3.3 70B for chat, 3.1 8B
 * for cheap classification). Groq exposes an OpenAI-compatible API.
 */
@Injectable()
export class GroqProvider implements LLMProvider {
  readonly id = 'groq';
  private readonly logger = new Logger(GroqProvider.name);
  private readonly client: Groq;

  constructor(config: ConfigService<AppEnv, true>) {
    // The groq-sdk already appends `/openai/v1/chat/completions`, so the base
    // URL must be the host only. Strip a trailing `/openai/v1` if someone set
    // the full OpenAI-compatible URL, otherwise the path doubles (404).
    const rawBase = config.get('GROQ_BASE_URL', { infer: true });
    const baseURL = rawBase
      ? rawBase.replace(/\/openai\/v1\/?$/, '')
      : undefined;
    this.client = new Groq({
      apiKey: config.get('GROQ_API_KEY', { infer: true }),
      ...(baseURL ? { baseURL } : {}),
    });
  }

  async complete(params: LlmCompletionParams): Promise<LlmCompletionResult> {
    const res = await this.client.chat.completions.create(
      {
        model: params.model,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens,
        messages: this.mapMessages(params),
        tools: params.tools?.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
        response_format:
          params.responseFormat === 'json'
            ? { type: 'json_object' }
            : undefined,
      },
      { signal: params.signal },
    );

    const choice = res.choices[0];
    const toolCalls: ProposedToolCall[] = (choice.message.tool_calls ?? []).map(
      (tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: this.safeParse(tc.function.arguments),
      }),
    );

    return {
      content: choice.message.content ?? '',
      toolCalls,
      usage: {
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
      },
      model: res.model,
      finishReason: choice.finish_reason ?? 'stop',
    };
  }

  async *stream(
    params: LlmCompletionParams,
  ): AsyncIterable<LlmStreamChunk> {
    const stream = await this.client.chat.completions.create(
      {
        model: params.model,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens,
        messages: this.mapMessages(params),
        stream: true,
      },
      { signal: params.signal },
    );

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      yield { delta, done: false };
    }
    yield { delta: '', done: true };
  }

  private mapMessages(params: LlmCompletionParams) {
    return params.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant' | 'tool',
      content: m.content,
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    })) as Groq.Chat.ChatCompletionMessageParam[];
  }

  private safeParse(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.warn(`Failed to parse tool args: ${raw}`);
      return {};
    }
  }
}

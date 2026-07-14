import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmbeddingParams,
  EmbeddingProvider,
  EmbeddingResult,
  ProviderUnavailableError,
} from '@genxtaxi/ai-shared';
import { AppEnv } from '../../config/env.validation';

/**
 * Cohere embed-multilingual-v3 (1024-dim) — default embeddings vendor since
 * Groq offers none. Strong FR/AR support (spec target market). Swappable via
 * EMBEDDING_PROVIDER. Uses the REST API directly to avoid an extra SDK dep.
 */
@Injectable()
export class CohereEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'cohere';
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint = 'https://api.cohere.com/v2/embed';

  constructor(config: ConfigService<AppEnv, true>) {
    this.apiKey = config.get('COHERE_API_KEY', { infer: true });
    this.model = config.get('EMBEDDING_MODEL', { infer: true });
    this.dimensions = config.get('EMBEDDING_DIMENSIONS', { infer: true });
  }

  async embed(params: EmbeddingParams): Promise<EmbeddingResult> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        texts: params.texts,
        input_type: params.inputType ?? 'search_document',
        embedding_types: ['float'],
      }),
      signal: params.signal,
    });

    if (!res.ok) {
      throw new ProviderUnavailableError(
        'cohere',
        `HTTP ${res.status}: ${await res.text().catch(() => '')}`,
      );
    }

    const json = (await res.json()) as {
      embeddings: { float: number[][] };
      meta?: { billed_units?: { input_tokens?: number } };
    };

    return {
      vectors: json.embeddings.float,
      model: this.model,
      inputTokens: json.meta?.billed_units?.input_tokens ?? 0,
    };
  }
}

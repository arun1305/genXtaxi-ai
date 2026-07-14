import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmbeddingParams,
  EmbeddingProvider,
  EmbeddingResult,
} from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';
import { CohereEmbeddingProvider } from './embeddings/cohere.embedding.provider';
import { LocalEmbeddingProvider } from './embeddings/local.embedding.provider';

/**
 * Routes embedding requests to the configured provider (EMBEDDING_PROVIDER).
 * Kept separate from the LLM router because embeddings have their own vendor +
 * dimensionality contract (must match the Atlas knnVector index).
 *
 * Providers: `cohere` (production default, needs COHERE_API_KEY) and `local`
 * (dependency-free, no key — for dev/CI/offline). Swappable via config only.
 */
@Injectable()
export class EmbeddingRouterService {
  private readonly logger = new Logger(EmbeddingRouterService.name);
  private readonly providers: Map<string, EmbeddingProvider>;
  private readonly active: EmbeddingProvider;

  constructor(
    config: ConfigService<AppEnv, true>,
    cohere: CohereEmbeddingProvider,
    local: LocalEmbeddingProvider,
  ) {
    this.providers = new Map<string, EmbeddingProvider>([
      [cohere.id, cohere],
      [local.id, local],
    ]);
    const selected = config.get('EMBEDDING_PROVIDER', { infer: true });
    this.active = this.providers.get(selected) ?? cohere;
    this.logger.log(
      `Embedding provider: ${this.active.id} (${this.active.dimensions}-dim)`,
    );
  }

  get dimensions(): number {
    return this.active.dimensions;
  }

  embed(params: EmbeddingParams): Promise<EmbeddingResult> {
    return this.active.embed(params);
  }
}

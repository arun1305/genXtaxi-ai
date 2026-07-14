import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmbeddingParams,
  EmbeddingProvider,
  EmbeddingResult,
} from '@genxtaxi/ai-shared';
import { createHash } from 'crypto';
import { AppEnv } from '../../config/env.validation';

/**
 * Deterministic, dependency-free local embedding provider (spec §1: providers
 * are swappable + config-driven). Produces L2-normalized bag-of-hashed-tokens
 * vectors of the configured dimensionality — no external API key required.
 *
 * Purpose: dev/CI/offline (the target market has intermittent connectivity) and
 * smoke-testing the full RAG pipeline before a hosted embeddings vendor (Cohere)
 * is wired. Quality is far below a real semantic model — production must set
 * EMBEDDING_PROVIDER=cohere. Selected via EMBEDDING_PROVIDER=local.
 */
@Injectable()
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'local';
  readonly dimensions: number;

  constructor(config: ConfigService<AppEnv, true>) {
    this.dimensions = config.get('EMBEDDING_DIMENSIONS', { infer: true });
  }

  async embed(params: EmbeddingParams): Promise<EmbeddingResult> {
    const vectors = params.texts.map((t) => this.embedOne(t));
    const inputTokens = params.texts.reduce(
      (n, t) => n + this.tokenize(t).length,
      0,
    );
    return { vectors, model: 'local-hash', inputTokens };
  }

  private tokenize(text: string): string[] {
    // Lowercase word + bigram tokens for a bit of locality (FR/AR/EN safe).
    const words = (text.toLowerCase().match(/\p{L}+/gu) ?? []).filter(Boolean);
    const bigrams: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      bigrams.push(`${words[i]}_${words[i + 1]}`);
    }
    return [...words, ...bigrams];
  }

  private embedOne(text: string): number[] {
    const vec = new Array(this.dimensions).fill(0);
    for (const tok of this.tokenize(text)) {
      // Hash token -> bucket + sign, accumulate (feature hashing).
      const h = createHash('md5').update(tok).digest();
      const bucket = h.readUInt32BE(0) % this.dimensions;
      const sign = h[4] % 2 === 0 ? 1 : -1;
      vec[bucket] += sign;
    }
    // L2-normalize so cosine similarity is meaningful.
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map((x) => x / norm);
  }
}

/**
 * Provider-agnostic embedding abstraction. Groq offers no embeddings API, so
 * the default concrete impl is Cohere embed-multilingual-v3 (1024-dim, strong
 * FR/AR) — matching the kb_chunks 1024-dim vector in spec §2.6. Swappable via
 * config, never hardcoded in business logic (spec §1).
 */

export type EmbeddingInputType = 'search_document' | 'search_query';

export interface EmbeddingParams {
  texts: string[];
  /** Cohere-style hint; ignored by providers that don't support it. */
  inputType?: EmbeddingInputType;
  signal?: AbortSignal;
}

export interface EmbeddingResult {
  /** One 1024-dim vector per input text, order-preserved. */
  vectors: number[][];
  model: string;
  inputTokens: number;
}

export interface EmbeddingProvider {
  readonly id: string;
  /** Fixed output dimensionality — must equal the Atlas knnVector index dim. */
  readonly dimensions: number;
  embed(params: EmbeddingParams): Promise<EmbeddingResult>;
}

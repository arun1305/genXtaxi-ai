import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GroqProvider } from './groq.provider';
import { AnthropicProvider } from './anthropic.provider';
import { CohereEmbeddingProvider } from './embeddings/cohere.embedding.provider';
import { LocalEmbeddingProvider } from './embeddings/local.embedding.provider';
import { LlmRouterService } from './llm-router.service';
import { EmbeddingRouterService } from './embedding-router.service';

/** Provider abstraction module (spec §1 LLM provider strategy). */
@Module({
  imports: [ConfigModule],
  providers: [
    GroqProvider,
    AnthropicProvider,
    CohereEmbeddingProvider,
    LocalEmbeddingProvider,
    LlmRouterService,
    EmbeddingRouterService,
  ],
  exports: [LlmRouterService, EmbeddingRouterService],
})
export class ProvidersModule {}

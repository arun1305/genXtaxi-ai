import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KbDocument, KbDocumentSchema } from '../schemas/kb-document.schema';
import { KbChunk, KbChunkSchema } from '../schemas/kb-chunk.schema';
import { ChunkerService } from './chunker.service';
import { VectorSearchService } from './vector-search.service';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { ProvidersModule } from '../providers/providers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KbDocument.name, schema: KbDocumentSchema },
      { name: KbChunk.name, schema: KbChunkSchema },
    ]),
    ProvidersModule,
  ],
  providers: [ChunkerService, VectorSearchService, RagService],
  controllers: [RagController],
  exports: [RagService, VectorSearchService],
})
export class RagModule {}

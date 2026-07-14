import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KbDocument, KbDocumentDocument } from '../schemas/kb-document.schema';
import { KbChunk, KbChunkDocument } from '../schemas/kb-chunk.schema';
import { ChunkerService } from './chunker.service';
import { VectorSearchService, VectorHit } from './vector-search.service';
import { EmbeddingRouterService } from '../providers/embedding-router.service';

/**
 * RAG store (spec §2.6, §7 Phase 1: Atlas Vector Search RAG store). Handles KB
 * document lifecycle: upload/version → publish (chunk + embed + index) → search.
 */
@Injectable()
export class RagService {
  constructor(
    @InjectModel(KbDocument.name)
    private readonly docs: Model<KbDocumentDocument>,
    @InjectModel(KbChunk.name)
    private readonly chunks: Model<KbChunkDocument>,
    private readonly chunker: ChunkerService,
    private readonly embeddings: EmbeddingRouterService,
    private readonly vectorSearch: VectorSearchService,
  ) {}

  async createDocument(input: {
    title: string;
    lang: string;
    source: string;
    body: string;
  }): Promise<KbDocumentDocument> {
    const latest = await this.docs
      .findOne({ title: input.title })
      .sort({ version: -1 })
      .lean();
    return this.docs.create({
      ...input,
      version: (latest?.version ?? 0) + 1,
      status: 'draft',
    });
  }

  listDocuments(lang?: string): Promise<KbDocumentDocument[]> {
    return this.docs
      .find(lang ? { lang } : {})
      .sort({ updatedAt: -1 })
      .exec();
  }

  /**
   * Publish a document: (re)chunk, embed each chunk (search_document), replace
   * its chunks, and mark published. The Atlas knnVector index picks up new
   * embeddings automatically.
   */
  async publishDocument(docId: string): Promise<{ chunks: number }> {
    const doc = await this.docs.findById(docId);
    if (!doc) throw new NotFoundException(`KB document ${docId} not found`);

    const pieces = this.chunker.chunk(doc.body);
    if (pieces.length === 0) return { chunks: 0 };

    const { vectors } = await this.embeddings.embed({
      texts: pieces.map((p) => p.content),
      inputType: 'search_document',
    });

    // Idempotent republish: drop old chunks then insert fresh ones.
    await this.chunks.deleteMany({ docId: doc._id });
    await this.chunks.insertMany(
      pieces.map((p, i) => ({
        docId: doc._id as Types.ObjectId,
        content: p.content,
        lang: doc.lang,
        embedding: vectors[i],
        metadata: { source: doc.source, title: doc.title, version: doc.version },
      })),
    );

    doc.status = 'published';
    doc.publishedAt = new Date();
    await doc.save();
    return { chunks: pieces.length };
  }

  /** Embed the query and retrieve top-k chunks pre-filtered by language. */
  async search(query: string, lang: string, topK = 5): Promise<VectorHit[]> {
    const { vectors } = await this.embeddings.embed({
      texts: [query],
      inputType: 'search_query',
    });
    return this.vectorSearch.search(vectors[0], lang, topK);
  }
}

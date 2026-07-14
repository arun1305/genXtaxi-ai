import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KbChunk, KbChunkDocument } from '../schemas/kb-chunk.schema';

export interface VectorHit {
  content: string;
  lang: string;
  score: number;
  docId: string;
  metadata: Record<string, unknown>;
}

/**
 * Atlas Vector Search retrieval (spec §2.4 step 2: $vectorSearch over the
 * kb_chunks embedding index, pre-filtered by lang). The knnVector index
 * ("kb_chunks_vector") is created out-of-band — see scripts/atlas-vector-index.json.
 *
 * Falls back to an in-memory cosine scan if $vectorSearch is unavailable (e.g.
 * local Mongo without Atlas Search) so dev/test never dead-ends.
 */
@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);
  private static readonly INDEX = 'kb_chunks_vector';

  constructor(
    @InjectModel(KbChunk.name) private readonly model: Model<KbChunkDocument>,
  ) {}

  async search(
    embedding: number[],
    lang: string,
    topK = 5,
  ): Promise<VectorHit[]> {
    try {
      const results = await this.model.aggregate<VectorHit>([
        {
          $vectorSearch: {
            index: VectorSearchService.INDEX,
            path: 'embedding',
            queryVector: embedding,
            numCandidates: Math.max(100, topK * 20),
            limit: topK,
            filter: { lang },
          },
        },
        {
          $project: {
            _id: 0,
            content: 1,
            lang: 1,
            docId: { $toString: '$docId' },
            metadata: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ]);
      return results;
    } catch (err) {
      this.logger.warn(
        `$vectorSearch unavailable (${(err as Error).message}); falling back to in-memory cosine`,
      );
      return this.fallbackCosine(embedding, lang, topK);
    }
  }

  private async fallbackCosine(
    query: number[],
    lang: string,
    topK: number,
  ): Promise<VectorHit[]> {
    const docs = await this.model.find({ lang }).limit(2000).lean();
    return docs
      .map((d) => ({
        content: d.content,
        lang: d.lang,
        docId: String(d.docId),
        metadata: d.metadata ?? {},
        score: cosine(query, d.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

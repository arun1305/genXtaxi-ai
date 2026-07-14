import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * Embedded RAG chunk (spec §2.6 kb_chunks). The `embedding` field is indexed by
 * an Atlas Search knnVector index (cosine, 1024-dim) created out-of-band (see
 * scripts/atlas-vector-index.json). `lang` is the pre-filter field for
 * $vectorSearch (spec §2.4 step 2).
 */
@Schema({ collection: 'kb_chunks', timestamps: { createdAt: true, updatedAt: false } })
export class KbChunk {
  @Prop({ type: Types.ObjectId, ref: 'KbDocument', required: true, index: true })
  docId!: Types.ObjectId;

  @Prop({ required: true })
  content!: string;

  @Prop({ required: true, index: true })
  lang!: string;

  /** 1024-dim vector — dimensionality MUST equal the Atlas index. */
  @Prop({ type: [Number], required: true })
  embedding!: number[];

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;
}

export type KbChunkDocument = HydratedDocument<KbChunk>;
export const KbChunkSchema = SchemaFactory.createForClass(KbChunk);

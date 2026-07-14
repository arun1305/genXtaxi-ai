import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** FAQ / policy source document feeding RAG (spec §2.6 kb_documents). */
@Schema({ collection: 'kb_documents', timestamps: { createdAt: true, updatedAt: false } })
export class KbDocument {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, index: true })
  lang!: string;

  /** e.g. "policy", "faq", "pricing". */
  @Prop({ required: true })
  source!: string;

  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop()
  publishedAt?: Date;

  /** draft until published, at which point chunks are embedded + indexed. */
  @Prop({ default: 'draft', index: true })
  status!: string;

  /** Raw text kept for re-chunking on prompt/version change. */
  @Prop({ required: true })
  body!: string;
}

export type KbDocumentDocument = HydratedDocument<KbDocument>;
export const KbDocumentSchema = SchemaFactory.createForClass(KbDocument);
KbDocumentSchema.index({ lang: 1, version: -1 });

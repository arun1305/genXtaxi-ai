import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum PromptStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  RETIRED = 'retired',
}

/**
 * Versioned prompt templates (spec §5: "all prompts in a versioned repo, not
 * inline strings"; §2.5 system prompt is versioned). One (key, version) is the
 * unit; exactly one version per key is PUBLISHED at a time.
 */
@Schema({ collection: 'prompt_templates', timestamps: true })
export class PromptTemplate {
  /** Logical prompt id, e.g. "chatbot.system". */
  @Prop({ required: true, index: true })
  key!: string;

  @Prop({ required: true })
  version!: number;

  /** The AI task this prompt drives (drives model routing). */
  @Prop({ required: true })
  task!: string;

  @Prop({ required: true })
  content!: string;

  /** Handlebars-style variables the template expects, e.g. {market},{lang}. */
  @Prop({ type: [String], default: [] })
  variables!: string[];

  @Prop({ enum: PromptStatus, default: PromptStatus.DRAFT, index: true })
  status!: PromptStatus;

  @Prop()
  createdBy?: string;

  @Prop()
  publishedAt?: Date;
}

export type PromptTemplateDocument = HydratedDocument<PromptTemplate>;
export const PromptTemplateSchema = SchemaFactory.createForClass(PromptTemplate);

PromptTemplateSchema.index({ key: 1, version: -1 }, { unique: true });
PromptTemplateSchema.index({ key: 1, status: 1 });

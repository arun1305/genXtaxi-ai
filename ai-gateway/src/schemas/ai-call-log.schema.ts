import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Observability record for every AI call (spec §1 Observability, §6). Amounts
 * (cost) follow the {amount, currency} money rule. A TTL index enforces the
 * configurable retention window (spec §5 Data retention).
 */
@Schema({ collection: 'ai_call_logs', timestamps: { createdAt: true, updatedAt: false } })
export class AiCallLog {
  @Prop({ required: true, index: true })
  traceId!: string;

  @Prop({ index: true })
  userId?: string;

  @Prop()
  role?: string;

  /** chatbot | summarizer | demand | gateway */
  @Prop({ required: true, index: true })
  feature!: string;

  @Prop({ required: true })
  model!: string;

  @Prop()
  promptVersion?: string;

  @Prop({ default: 0 })
  inputTokens!: number;

  @Prop({ default: 0 })
  outputTokens!: number;

  /** Cost in {amount: minor units, currency}. Never a float. */
  @Prop({ type: Object })
  cost?: { amount: number; currency: string };

  @Prop({ default: 0 })
  latencyMs!: number;

  @Prop({ type: [String], default: [] })
  toolCalls!: string[];

  /** success | error | fallback | blocked | budget_exceeded */
  @Prop({ required: true })
  outcome!: string;

  @Prop()
  createdAt!: Date;
}

export type AiCallLogDocument = HydratedDocument<AiCallLog>;
export const AiCallLogSchema = SchemaFactory.createForClass(AiCallLog);

// Query paths (spec §6 dashboard slices)
AiCallLogSchema.index({ userId: 1, createdAt: -1 });
AiCallLogSchema.index({ feature: 1, createdAt: -1 });
AiCallLogSchema.index({ model: 1, createdAt: -1 });
// TTL — retention configured at bootstrap via AI_LOG_RETENTION_DAYS.
AiCallLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90, name: 'ttl_retention' },
);

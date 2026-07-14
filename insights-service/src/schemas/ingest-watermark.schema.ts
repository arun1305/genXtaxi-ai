import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Ingest watermark — the high-water `ratedAt` already materialized from the
 * rides collection. Makes the cron scan incremental + resumable (no Kafka).
 */
@Schema({ collection: 'insights_watermarks', timestamps: true })
export class IngestWatermark {
  @Prop({ required: true, unique: true })
  source!: string; // e.g. 'rides'

  @Prop({ required: true })
  lastRatedAt!: Date;
}

export type IngestWatermarkDocument = HydratedDocument<IngestWatermark>;
export const IngestWatermarkSchema = SchemaFactory.createForClass(IngestWatermark);

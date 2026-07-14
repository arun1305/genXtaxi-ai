import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DriverSummaryJson } from '../pipeline/aspects';

/**
 * Cached per-driver summary (spec §3.5 driver_summaries). Mongo is the durable
 * store; Redis serves the rider read path (<200ms). `computedAt` drives freshness.
 */
@Schema({ collection: 'driver_summaries', timestamps: false })
export class DriverSummary {
  @Prop({ required: true })
  driverId!: string;

  @Prop({ required: true })
  lang!: string;

  @Prop({ type: Object, required: true })
  summary!: DriverSummaryJson;

  @Prop({ required: true })
  reviewCount!: number;

  @Prop({ required: true })
  promptVersion!: number;

  @Prop({ required: true })
  computedAt!: Date;
}

export type DriverSummaryDocument = HydratedDocument<DriverSummary>;
export const DriverSummarySchema = SchemaFactory.createForClass(DriverSummary);
DriverSummarySchema.index({ driverId: 1, lang: 1 }, { unique: true });

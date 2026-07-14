import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export interface ComplaintCluster {
  label: string;
  size: number;
  representative: string; // anonymized representative review text
}

/** Per-zone/per-week aspect sentiment + complaint clusters (spec §3.5 zone_insights). */
@Schema({ collection: 'zone_insights', timestamps: false })
export class ZoneInsight {
  @Prop({ required: true })
  zoneId!: string;

  /** ISO week key, e.g. "2026-W28". */
  @Prop({ required: true })
  week!: string;

  @Prop({ required: true })
  aspect!: string;

  @Prop({ required: true })
  avgSentiment!: number;

  @Prop({ required: true })
  volume!: number;

  @Prop({ type: Array, default: [] })
  clusters!: ComplaintCluster[];

  @Prop({ required: true })
  computedAt!: Date;
}

export type ZoneInsightDocument = HydratedDocument<ZoneInsight>;
export const ZoneInsightSchema = SchemaFactory.createForClass(ZoneInsight);
ZoneInsightSchema.index({ zoneId: 1, week: -1 });

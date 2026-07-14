import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AspectResult } from '../pipeline/aspects';

/**
 * Materialized review (spec §3.5 reviews). Ratings live embedded in the ride doc
 * in gen-taxi-backend (driverRating/passengerRating); the ingest projects them
 * here so the summarizer owns its own store. Aspect results are embedded
 * (always read with the review — avoids a join).
 */
@Schema({ collection: 'reviews', timestamps: { createdAt: false, updatedAt: false } })
export class Review {
  @Prop({ required: true, index: true })
  rideId!: string;

  /** Who wrote the review. */
  @Prop({ required: true })
  authorId!: string;

  /** Who the review is about (driver or passenger). */
  @Prop({ required: true, index: true })
  subjectId!: string;

  @Prop({ required: true, enum: ['driver', 'rider'] })
  subjectType!: 'driver' | 'rider';

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ default: '' })
  text!: string;

  @Prop({ required: true, default: 'fr' })
  lang!: string;

  @Prop({ required: true })
  createdAt!: Date;

  /** Filled by aspect extraction; empty until processed. */
  @Prop({ type: Array, default: [] })
  aspects!: AspectResult[];

  /** Pipeline bookkeeping. */
  @Prop({ default: false, index: true })
  aspectsProcessed!: boolean;

  /** Excluded from summaries (toxicity / review-bombing) — spec §3.7. */
  @Prop({ default: false })
  excluded!: boolean;

  @Prop()
  excludedReason?: string;

  /** Zone for admin aggregation, if resolvable from the ride. */
  @Prop({ index: true })
  zoneId?: string;
}

export type ReviewDocument = HydratedDocument<Review>;
export const ReviewSchema = SchemaFactory.createForClass(Review);
// One materialized review per (ride, subjectType) — makes ingest idempotent.
ReviewSchema.index({ rideId: 1, subjectType: 1 }, { unique: true });
ReviewSchema.index({ subjectId: 1, createdAt: -1 });

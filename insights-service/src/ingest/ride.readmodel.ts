import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

interface EmbeddedRating {
  rating?: number;
  review?: string;
  ratedAt?: Date;
}

/**
 * READ-ONLY projection of the gen-taxi-backend `rides` collection. insights-
 * service shares the same MongoDB (spec §1), so we read ratings directly rather
 * than requiring a Kafka feed. We never write to this collection.
 */
@Schema({ collection: 'rides', timestamps: true, strict: false })
export class RideReadModel {
  @Prop()
  passenger?: string;

  @Prop()
  driver?: string;

  @Prop()
  status?: string;

  /** Zone/city if present on the ride (used for admin zone aggregation). */
  @Prop()
  zoneId?: string;

  @Prop({ type: Object })
  passengerRating?: EmbeddedRating; // driver rating the passenger

  @Prop({ type: Object })
  driverRating?: EmbeddedRating; // passenger rating the driver
}

export type RideReadDocument = HydratedDocument<RideReadModel>;
export const RideReadSchema = SchemaFactory.createForClass(RideReadModel);
// Support the watermark scan on either rating timestamp.
RideReadSchema.index({ 'driverRating.ratedAt': -1 });
RideReadSchema.index({ 'passengerRating.ratedAt': -1 });

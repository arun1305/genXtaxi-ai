import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * FX rate snapshot (spec §1). Immutable once stored; the rateTimestamp is
 * stamped onto any quote/report that used it so prices can't silently move.
 */
@Schema({ collection: 'fx_rates', timestamps: { createdAt: true, updatedAt: false } })
export class FxRate {
  @Prop({ required: true, uppercase: true })
  base!: string;

  @Prop({ required: true, uppercase: true })
  quote!: string;

  @Prop({ required: true })
  rate!: number;

  @Prop({ required: true })
  rateTimestamp!: Date;

  @Prop({ required: true })
  provider!: string;
}

export type FxRateDocument = HydratedDocument<FxRate>;
export const FxRateSchema = SchemaFactory.createForClass(FxRate);
FxRateSchema.index({ base: 1, quote: 1, rateTimestamp: -1 });

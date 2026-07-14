import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { RoundingRule } from '@genxtaxi/ai-shared';

/** Supported currency config (spec §1: minor-unit exponent, rounding rules). */
@Schema({ collection: 'currencies', timestamps: true })
export class Currency {
  @Prop({ required: true, uppercase: true, unique: true })
  code!: string;

  /** DZD/EUR/USD = 2, XOF = 0, … */
  @Prop({ required: true })
  minorUnitExponent!: number;

  @Prop({
    required: true,
    enum: RoundingRule,
    default: RoundingRule.HALF_EVEN,
  })
  roundingRule!: RoundingRule;

  @Prop({ required: true })
  symbol!: string;

  @Prop({ default: true })
  enabled!: boolean;
}

export type CurrencyDocument = HydratedDocument<Currency>;
export const CurrencySchema = SchemaFactory.createForClass(Currency);

import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CurrencyConfig, RoundingRule } from '@genxtaxi/ai-shared';
import { Currency, CurrencyDocument } from '../schemas/currency.schema';
import { UpsertCurrencyDto } from './dto/currency.dto';

/**
 * Owns the supported-currency registry (spec §1). Seeds the North/West Africa
 * defaults on boot so the platform has DZD/EUR/USD/XOF/MAD/TND/NGN out of the box.
 */
@Injectable()
export class CurrenciesService implements OnModuleInit {
  private static readonly SEED: CurrencyConfig[] = [
    { code: 'DZD', minorUnitExponent: 2, roundingRule: RoundingRule.HALF_EVEN, symbol: 'DA', enabled: true },
    { code: 'EUR', minorUnitExponent: 2, roundingRule: RoundingRule.HALF_EVEN, symbol: '€', enabled: true },
    { code: 'USD', minorUnitExponent: 2, roundingRule: RoundingRule.HALF_EVEN, symbol: '$', enabled: true },
    { code: 'XOF', minorUnitExponent: 0, roundingRule: RoundingRule.HALF_UP, symbol: 'CFA', enabled: true },
    { code: 'MAD', minorUnitExponent: 2, roundingRule: RoundingRule.HALF_EVEN, symbol: 'DH', enabled: true },
    { code: 'TND', minorUnitExponent: 3, roundingRule: RoundingRule.HALF_EVEN, symbol: 'DT', enabled: true },
    { code: 'NGN', minorUnitExponent: 2, roundingRule: RoundingRule.HALF_EVEN, symbol: '₦', enabled: true },
  ];

  constructor(
    @InjectModel(Currency.name) private readonly model: Model<CurrencyDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.model.estimatedDocumentCount();
    if (count === 0) {
      await this.model.insertMany(CurrenciesService.SEED);
    }
  }

  findAll(includeDisabled = false): Promise<CurrencyDocument[]> {
    return this.model
      .find(includeDisabled ? {} : { enabled: true })
      .sort({ code: 1 })
      .exec();
  }

  async getConfig(code: string): Promise<CurrencyConfig> {
    const doc = await this.model.findOne({ code: code.toUpperCase() }).lean();
    if (!doc) throw new NotFoundException(`Unsupported currency: ${code}`);
    return {
      code: doc.code,
      minorUnitExponent: doc.minorUnitExponent,
      roundingRule: doc.roundingRule,
      symbol: doc.symbol,
      enabled: doc.enabled,
    };
  }

  upsert(dto: UpsertCurrencyDto): Promise<CurrencyDocument> {
    return this.model
      .findOneAndUpdate(
        { code: dto.code.toUpperCase() },
        {
          $set: {
            code: dto.code.toUpperCase(),
            minorUnitExponent: dto.minorUnitExponent,
            roundingRule: dto.roundingRule ?? RoundingRule.HALF_EVEN,
            symbol: dto.symbol,
            enabled: dto.enabled ?? true,
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }
}

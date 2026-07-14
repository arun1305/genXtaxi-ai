import { Injectable } from '@nestjs/common';
import { Money, MoneyOps } from '@genxtaxi/ai-shared';
import { CurrenciesService } from '../currencies/currencies.service';
import { FxService } from '../fx/fx.service';

export interface ConversionResult {
  original: Money;
  converted: Money;
  rate: number;
  rateTimestamp: string;
  /** Human-readable formatting of the converted value. */
  formatted: string;
}

/**
 * Converts a {amount, currency} for DISPLAY only (spec §1: keep the
 * authoritative amount in the transaction currency). Returns both the original
 * and converted values plus the rate + timestamp so callers can persist both.
 */
@Injectable()
export class ConvertService {
  constructor(
    private readonly currencies: CurrenciesService,
    private readonly fx: FxService,
  ) {}

  async convert(
    amount: number,
    currency: string,
    target: string,
    locale = 'fr-DZ',
  ): Promise<ConversionResult> {
    const original = MoneyOps.of(amount, currency);
    const fromCfg = await this.currencies.getConfig(original.currency);
    const toCfg = await this.currencies.getConfig(target);
    const fx = await this.fx.getRate(original.currency, target);

    const { converted, rateTimestamp } = MoneyOps.convert(
      original,
      fx,
      fromCfg,
      toCfg,
    );

    return {
      original,
      converted,
      rate: fx.rate,
      rateTimestamp,
      formatted: MoneyOps.format(converted, toCfg, locale),
    };
  }
}

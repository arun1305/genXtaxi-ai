import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Money } from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';
import { ConvertService } from '../convert/convert.service';

export interface NormalizedAmount {
  original: Money;
  base: Money;
  baseCurrency: string;
  rate: number;
  rateTimestamp: string;
}

/**
 * Normalizes arbitrary {amount, currency} values into the configurable base
 * reporting currency using the FX rate at (or nearest to) event time (spec §1:
 * "store both original and converted"). Used by the admin cost dashboard.
 */
@Injectable()
export class ReportingService {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly convert: ConvertService,
  ) {}

  async normalize(amount: number, currency: string): Promise<NormalizedAmount> {
    const base = this.config.get('REPORTING_BASE_CURRENCY', { infer: true });
    const result = await this.convert.convert(amount, currency, base);
    return {
      original: result.original,
      base: result.converted,
      baseCurrency: base,
      rate: result.rate,
      rateTimestamp: result.rateTimestamp,
    };
  }
}

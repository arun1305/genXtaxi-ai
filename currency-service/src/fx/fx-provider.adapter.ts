import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv } from '../config/env.validation';

export interface RawRates {
  base: string;
  timestamp: string;
  rates: Record<string, number>;
}

/**
 * Config-driven FX rates provider adapter (spec §1: "pulled from a rates
 * provider"). Default = exchangerate.host. Swap the provider by changing env,
 * never business logic. Returns `base -> quote` multipliers in major units.
 */
@Injectable()
export class FxProviderAdapter {
  private readonly logger = new Logger(FxProviderAdapter.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  async fetchRates(base: string): Promise<RawRates> {
    const url = new URL(this.config.get('FX_API_URL', { infer: true }));
    url.searchParams.set('base', base);
    const apiKey = this.config.get('FX_API_KEY', { infer: true });
    if (apiKey) url.searchParams.set('access_key', apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`FX provider HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      base?: string;
      date?: string;
      rates?: Record<string, number>;
    };
    if (!json.rates) {
      throw new Error('FX provider returned no rates');
    }
    this.logger.log(
      `Fetched ${Object.keys(json.rates).length} rates for base ${base}`,
    );
    return {
      base: json.base ?? base,
      timestamp: json.date
        ? new Date(json.date).toISOString()
        : new Date().toISOString(),
      rates: json.rates,
    };
  }
}

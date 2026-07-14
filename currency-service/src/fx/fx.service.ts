import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type Redis from 'ioredis';
import { FxRateSnapshot } from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';
import { FxRate, FxRateDocument } from '../schemas/fx-rate.schema';
import { FxProviderAdapter } from './fx-provider.adapter';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Fetches, caches (Redis) and persists (Mongo) FX rates. Redis is the hot
 * layer; Mongo is the durable, auditable store of every snapshot (immutable).
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly provider: FxProviderAdapter,
    @InjectModel(FxRate.name) private readonly model: Model<FxRateDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private cacheKey(base: string, quote: string): string {
    return `fx:${base.toUpperCase()}:${quote.toUpperCase()}`;
  }

  /** Refresh all rates for the configured base and persist a snapshot. */
  async refreshAll(): Promise<number> {
    const base = this.config.get('FX_BASE_CURRENCY', { infer: true });
    const provider = this.config.get('FX_PROVIDER', { infer: true });
    const ttl = this.config.get('FX_CACHE_TTL_SECONDS', { infer: true });

    const raw = await this.provider.fetchRates(base);
    const ts = new Date(raw.timestamp);
    const docs: Partial<FxRate>[] = [];

    for (const [quote, rate] of Object.entries(raw.rates)) {
      const snapshot: FxRateSnapshot = {
        base: raw.base.toUpperCase(),
        quote: quote.toUpperCase(),
        rate,
        rateTimestamp: raw.timestamp,
        provider,
      };
      await this.redis.set(
        this.cacheKey(raw.base, quote),
        JSON.stringify(snapshot),
        'EX',
        ttl,
      );
      docs.push({
        base: raw.base.toUpperCase(),
        quote: quote.toUpperCase(),
        rate,
        rateTimestamp: ts,
        provider,
      });
    }
    if (docs.length) await this.model.insertMany(docs);
    this.logger.log(`Refreshed & cached ${docs.length} FX rates (base ${base})`);
    return docs.length;
  }

  /**
   * Resolve a base->quote rate. Cache-first; falls back to the latest Mongo
   * snapshot; triggers a refresh if nothing is available (spec: never fail the
   * fare path — callers degrade gracefully).
   */
  async getRate(base: string, quote: string): Promise<FxRateSnapshot> {
    const b = base.toUpperCase();
    const q = quote.toUpperCase();
    if (b === q) {
      return {
        base: b,
        quote: q,
        rate: 1,
        rateTimestamp: new Date().toISOString(),
        provider: 'identity',
      };
    }

    const cached = await this.redis.get(this.cacheKey(b, q));
    if (cached) return JSON.parse(cached) as FxRateSnapshot;

    const doc = await this.model
      .findOne({ base: b, quote: q })
      .sort({ rateTimestamp: -1 })
      .lean();
    if (doc) {
      return {
        base: doc.base,
        quote: doc.quote,
        rate: doc.rate,
        rateTimestamp: doc.rateTimestamp.toISOString(),
        provider: doc.provider,
      };
    }

    // Cross-rate via base currency if a direct pair is missing.
    const cross = await this.tryCrossRate(b, q);
    if (cross) return cross;

    throw new NotFoundException(`No FX rate available for ${b}->${q}`);
  }

  /** Derive base->quote through the configured pivot currency when needed. */
  private async tryCrossRate(
    base: string,
    quote: string,
  ): Promise<FxRateSnapshot | null> {
    const pivot = this.config
      .get('FX_BASE_CURRENCY', { infer: true })
      .toUpperCase();
    if (base === pivot || quote === pivot) return null;

    const pivotToBase = await this.model
      .findOne({ base: pivot, quote: base })
      .sort({ rateTimestamp: -1 })
      .lean();
    const pivotToQuote = await this.model
      .findOne({ base: pivot, quote })
      .sort({ rateTimestamp: -1 })
      .lean();
    if (!pivotToBase || !pivotToQuote) return null;

    const rate = pivotToQuote.rate / pivotToBase.rate;
    return {
      base,
      quote,
      rate,
      rateTimestamp: pivotToQuote.rateTimestamp.toISOString(),
      provider: `${pivotToQuote.provider}:cross`,
    };
  }
}

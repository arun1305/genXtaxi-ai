import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type Redis from 'ioredis';
import { AiTask } from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';
import { AiGatewayClient } from '../gateway-client/ai-gateway.client';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Review, ReviewDocument } from '../schemas/review.schema';
import {
  DriverSummary,
  DriverSummaryDocument,
} from '../schemas/driver-summary.schema';
import { ASPECTS, Aspect, DriverSummaryJson } from './aspects';

/**
 * Per-driver summarization (spec §3.3 step 3). Deterministic (low temp + pinned
 * promptVersion — spec §3.7) so summaries are reproducible/auditable. Aspect
 * aggregates are computed in-code; the LLM writes only the natural-language parts.
 */
@Injectable()
export class SummarizerService {
  private readonly logger = new Logger(SummarizerService.name);
  private readonly promptVersion: number;
  private readonly coldStartMin: number;
  private readonly cacheTtl: number;

  constructor(
    config: ConfigService<AppEnv, true>,
    private readonly gateway: AiGatewayClient,
    @InjectModel(Review.name) private readonly reviews: Model<ReviewDocument>,
    @InjectModel(DriverSummary.name)
    private readonly summaries: Model<DriverSummaryDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.promptVersion = config.get('SUMMARY_PROMPT_VERSION', { infer: true });
    this.coldStartMin = config.get('COLD_START_MIN_REVIEWS', { infer: true });
    this.cacheTtl = config.get('SUMMARY_CACHE_TTL_SECONDS', { infer: true });
  }

  private cacheKey(driverId: string, lang: string) {
    return `driver_summary:${driverId}:${lang}`;
  }

  /** Recompute one driver's summary for a language and cache it. */
  async recompute(driverId: string, lang: string): Promise<DriverSummaryJson | null> {
    const reviews = await this.reviews
      .find({ subjectId: driverId, subjectType: 'driver', excluded: false })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // Cold start (spec §3.7): not enough reviews -> no LLM summary.
    if (reviews.length < this.coldStartMin) {
      this.logger.debug(`Driver ${driverId}: cold start (${reviews.length} reviews)`);
      return null;
    }

    // Deterministic aspect aggregation in-code.
    const agg = new Map<Aspect, { sum: number; count: number }>();
    for (const r of reviews) {
      for (const a of r.aspects ?? []) {
        const cur = agg.get(a.aspect) ?? { sum: 0, count: 0 };
        cur.sum += a.sentiment;
        cur.count += 1;
        agg.set(a.aspect, cur);
      }
    }
    const aspects = ASPECTS.map((name) => {
      const a = agg.get(name);
      return a
        ? { name, sentiment: round2(a.sum / a.count), mention_count: a.count }
        : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    const overall = aspects.length
      ? round2(aspects.reduce((s, a) => s + a.sentiment, 0) / aspects.length)
      : round2((avg(reviews.map((r) => r.rating)) - 3) / 2); // map 1..5 -> -1..1

    // LLM writes the prose (summary/strengths/improvements) from the aggregates.
    const llm = await this.gateway.completeJson<{
      summary: string;
      strengths: string[];
      improvements: string[];
    }>(
      AiTask.SUMMARIZE,
      [
        {
          role: 'system',
          content:
            `You write a supportive, constructive driver reputation summary in ${lang}. ` +
            `Return STRICT JSON {"summary":"<=60 words","strengths":["..."],"improvements":["..."]}. ` +
            `Base it ONLY on the provided aspect aggregates. Never name or identify any reviewer. ` +
            `Frame improvements as coaching, not punishment.`,
        },
        {
          role: 'user',
          content: JSON.stringify({ review_count: reviews.length, aspects, overall_sentiment: overall }),
        },
      ],
      'summarizer_summary',
    );

    const summary: DriverSummaryJson = {
      summary: llm?.summary ?? '',
      overall_sentiment: overall,
      aspects,
      strengths: llm?.strengths ?? [],
      improvements: llm?.improvements ?? [],
      review_count: reviews.length,
      lang,
    };

    await this.summaries.updateOne(
      { driverId, lang },
      {
        $set: {
          driverId,
          lang,
          summary,
          reviewCount: reviews.length,
          promptVersion: this.promptVersion,
          computedAt: new Date(),
        },
      },
      { upsert: true },
    );
    await this.redis.set(
      this.cacheKey(driverId, lang),
      JSON.stringify({ summary, computedAt: new Date().toISOString() }),
      'EX',
      this.cacheTtl,
    );
    return summary;
  }

  /** Serve from Redis first (spec §3.6 <200ms), then Mongo, else null. */
  async serve(driverId: string, lang: string): Promise<{ summary: DriverSummaryJson; computedAt: string } | null> {
    const cached = await this.redis.get(this.cacheKey(driverId, lang));
    if (cached) return JSON.parse(cached);
    const doc = await this.summaries.findOne({ driverId, lang }).lean();
    if (!doc) return null;
    const payload = { summary: doc.summary, computedAt: doc.computedAt.toISOString() };
    await this.redis.set(this.cacheKey(driverId, lang), JSON.stringify(payload), 'EX', this.cacheTtl);
    return payload;
  }

  /** Drivers with new reviews since their last summary, for scheduled refresh. */
  async driversNeedingRefresh(minNew: number, maxAgeHours: number): Promise<string[]> {
    const stale = new Date(Date.now() - maxAgeHours * 3_600_000);
    const summaries = await this.summaries.find({}, { driverId: 1, computedAt: 1, reviewCount: 1 }).lean();
    const byDriver = new Map(summaries.map((s) => [s.driverId, s]));

    const counts = await this.reviews.aggregate<{ _id: string; count: number }>([
      { $match: { subjectType: 'driver', excluded: false } },
      { $group: { _id: '$subjectId', count: { $sum: 1 } } },
    ]);

    const due: string[] = [];
    for (const c of counts) {
      const s = byDriver.get(c._id);
      if (!s) {
        if (c.count >= this.coldStartMin) due.push(c._id);
      } else if (c.count - s.reviewCount >= minNew || s.computedAt < stale) {
        due.push(c._id);
      }
    }
    return due;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

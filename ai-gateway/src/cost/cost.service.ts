import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiCallLog, AiCallLogDocument } from '../schemas/ai-call-log.schema';

export interface CostQuery {
  from?: Date;
  to?: Date;
  feature?: string;
}

/**
 * Aggregates ai_call_logs into the admin cost/observability dashboard shape
 * (spec §6): per-feature request volume, token spend, cost/day, P50/P95 latency,
 * error rate. All amounts already stored as {amount, currency} minor units.
 */
@Injectable()
export class CostService {
  constructor(
    @InjectModel(AiCallLog.name)
    private readonly model: Model<AiCallLogDocument>,
  ) {}

  async summary(q: CostQuery) {
    const match: Record<string, unknown> = {};
    if (q.feature) match.feature = q.feature;
    if (q.from || q.to) {
      match.createdAt = {
        ...(q.from ? { $gte: q.from } : {}),
        ...(q.to ? { $lte: q.to } : {}),
      };
    }

    const perFeature = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$feature',
          requests: { $sum: 1 },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          costCents: { $sum: { $ifNull: ['$cost.amount', 0] } },
          errors: {
            $sum: {
              $cond: [{ $in: ['$outcome', ['error', 'blocked']] }, 1, 0],
            },
          },
          latencies: { $push: '$latencyMs' },
        },
      },
      { $sort: { requests: -1 } },
    ]);

    return {
      generatedAt: new Date().toISOString(),
      currency: 'USD',
      features: perFeature.map((f) => ({
        feature: f._id,
        requests: f.requests,
        inputTokens: f.inputTokens,
        outputTokens: f.outputTokens,
        cost: { amount: f.costCents, currency: 'USD' },
        errorRate: f.requests ? f.errors / f.requests : 0,
        p50LatencyMs: percentile(f.latencies, 50),
        p95LatencyMs: percentile(f.latencies, 95),
      })),
    };
  }

  /** Cost/day time-series for the dashboard chart (spec §6). */
  async daily(q: CostQuery) {
    const match: Record<string, unknown> = {};
    if (q.feature) match.feature = q.feature;
    if (q.from || q.to) {
      match.createdAt = {
        ...(q.from ? { $gte: q.from } : {}),
        ...(q.to ? { $lte: q.to } : {}),
      };
    }
    return this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            feature: '$feature',
          },
          costCents: { $sum: { $ifNull: ['$cost.amount', 0] } },
          requests: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]);
  }
}

function percentile(values: number[], p: number): number {
  if (!values?.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, idx)];
}

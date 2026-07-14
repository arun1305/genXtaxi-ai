import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiGatewayClient } from '../gateway-client/ai-gateway.client';
import { Review, ReviewDocument } from '../schemas/review.schema';
import {
  ZoneInsight,
  ZoneInsightDocument,
  ComplaintCluster,
} from '../schemas/zone-insight.schema';
import { greedyCluster } from './clustering';
import { isoWeek } from './iso-week';

/**
 * Nightly admin aggregation (spec §3.3 step 4): per-zone/per-week aspect
 * sentiment + emerging complaint clusters (embed + cluster negative review text).
 */
@Injectable()
export class ZoneAggregationService {
  private readonly logger = new Logger(ZoneAggregationService.name);

  constructor(
    private readonly gateway: AiGatewayClient,
    @InjectModel(Review.name) private readonly reviews: Model<ReviewDocument>,
    @InjectModel(ZoneInsight.name)
    private readonly zones: Model<ZoneInsightDocument>,
  ) {}

  /** Aggregate the current ISO week across all zones. */
  async aggregateCurrentWeek(): Promise<number> {
    const week = isoWeek(new Date());
    const since = new Date(Date.now() - 7 * 86_400_000);

    // Per (zone, aspect) sentiment + volume.
    const rows = await this.reviews.aggregate<{
      _id: { zoneId: string; aspect: string };
      avgSentiment: number;
      volume: number;
    }>([
      { $match: { excluded: false, aspectsProcessed: true, createdAt: { $gte: since } } },
      { $unwind: '$aspects' },
      {
        $group: {
          _id: { zoneId: { $ifNull: ['$zoneId', 'unknown'] }, aspect: '$aspects.aspect' },
          avgSentiment: { $avg: '$aspects.sentiment' },
          volume: { $sum: 1 },
        },
      },
    ]);

    // Complaint clusters per zone (negative reviews only).
    const clustersByZone = await this.buildClusters(since);

    let written = 0;
    for (const row of rows) {
      await this.zones.updateOne(
        { zoneId: row._id.zoneId, week, aspect: row._id.aspect },
        {
          $set: {
            zoneId: row._id.zoneId,
            week,
            aspect: row._id.aspect,
            avgSentiment: Math.round(row.avgSentiment * 100) / 100,
            volume: row.volume,
            clusters: clustersByZone.get(row._id.zoneId) ?? [],
            computedAt: new Date(),
          },
        },
        { upsert: true },
      );
      written++;
    }
    this.logger.log(`Zone aggregation: wrote ${written} rows for week ${week}`);
    return written;
  }

  private async buildClusters(since: Date): Promise<Map<string, ComplaintCluster[]>> {
    const negatives = await this.reviews
      .find({
        excluded: false,
        createdAt: { $gte: since },
        rating: { $lte: 2 },
        text: { $ne: '' },
      })
      .limit(500)
      .lean();

    const byZone = new Map<string, { text: string }[]>();
    for (const r of negatives) {
      const zone = r.zoneId ?? 'unknown';
      const arr = byZone.get(zone) ?? [];
      arr.push({ text: r.text });
      byZone.set(zone, arr);
    }

    const out = new Map<string, ComplaintCluster[]>();
    for (const [zone, items] of byZone) {
      if (items.length < 3) continue;
      const vectors = await this.gateway.embed(items.map((i) => i.text));
      if (vectors.length !== items.length) continue;
      const clusters = greedyCluster(items.map((i, idx) => ({ text: i.text, vector: vectors[idx] })));
      out.set(
        zone,
        clusters
          .filter((c) => c.members.length >= 2)
          .slice(0, 5)
          .map((c) => ({
            label: c.members[0].text.slice(0, 60),
            size: c.members.length,
            representative: c.members[0].text, // anonymized (no reviewer id)
          })),
      );
    }
    return out;
  }
}

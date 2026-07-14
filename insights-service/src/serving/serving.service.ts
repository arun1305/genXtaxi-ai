import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SummarizerService } from '../pipeline/summarizer.service';
import { ZoneInsight, ZoneInsightDocument } from '../schemas/zone-insight.schema';
import { DriverSummaryJson } from '../pipeline/aspects';

export interface RiderReputation {
  available: boolean;
  summary?: string;
  chips: { aspect: string; sentiment: number }[];
  reviewCount: number;
  computedAt?: string;
}

/** Read-side serving (spec §3.6). Rider view is chip-only; never raw negatives. */
@Injectable()
export class ServingService {
  constructor(
    private readonly summarizer: SummarizerService,
    @InjectModel(ZoneInsight.name)
    private readonly zones: Model<ZoneInsightDocument>,
  ) {}

  /** Rider-facing driver reputation — concise summary + positive aspect chips. */
  async riderView(driverId: string, lang: string): Promise<RiderReputation> {
    const served = await this.summarizer.serve(driverId, lang);
    if (!served) {
      return { available: false, chips: [], reviewCount: 0 };
    }
    const s = served.summary;
    return {
      available: true,
      summary: s.summary,
      // Surface top positive aspects only, out-of-context negatives are hidden.
      chips: s.aspects
        .filter((a) => a.sentiment > 0.2)
        .sort((x, y) => y.sentiment - x.sentiment)
        .slice(0, 4)
        .map((a) => ({ aspect: a.name, sentiment: a.sentiment })),
      reviewCount: s.review_count,
      computedAt: served.computedAt,
    };
  }

  /** Driver self-view — full coaching summary (spec §3.4). */
  async driverSelfView(
    driverId: string,
    lang: string,
  ): Promise<{ available: boolean; summary?: DriverSummaryJson; computedAt?: string }> {
    const served = await this.summarizer.serve(driverId, lang);
    if (!served) return { available: false };
    return { available: true, summary: served.summary, computedAt: served.computedAt };
  }

  /** Admin zone analytics for a week (spec §3.6). */
  zoneInsights(week: string) {
    return this.zones.find({ week }).sort({ zoneId: 1, aspect: 1 }).lean();
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppEnv } from '../config/env.validation';
import { Review, ReviewDocument } from '../schemas/review.schema';
import {
  IngestWatermark,
  IngestWatermarkDocument,
} from '../schemas/ingest-watermark.schema';
import { REVIEW_SOURCE, ReviewSource, RawReview } from './review-source';
import { ContentFilterService } from '../pipeline/content-filter.service';

/**
 * Materializes ratings from the source into the reviews collection (spec §3.5),
 * applying the content filter and review-bombing exclusion (spec §3.7). Idempotent
 * via the unique (rideId, subjectType) index.
 */
@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly defaultLang: string;

  constructor(
    config: ConfigService<AppEnv, true>,
    @Inject(REVIEW_SOURCE) private readonly source: ReviewSource,
    @InjectModel(Review.name) private readonly reviews: Model<ReviewDocument>,
    @InjectModel(IngestWatermark.name)
    private readonly watermarks: Model<IngestWatermarkDocument>,
    private readonly filter: ContentFilterService,
  ) {
    this.defaultLang = config.getOrThrow('DEFAULT_LANG');
  }

  /** Pull a batch, filter, detect bombing, and upsert. Returns count ingested. */
  async ingestBatch(limit = 500): Promise<number> {
    const wm = await this.watermarks.findOne({ source: 'rides' });
    const from = wm?.lastRatedAt ?? new Date(0);

    const { reviews, newWatermark } = await this.source.pullSince(from, limit);
    if (reviews.length === 0) return 0;

    const bombedSubjects = this.detectReviewBombing(reviews);
    let ingested = 0;

    for (const r of reviews) {
      const { clean, toxic } = this.filter.filter(r.text);
      const excluded = toxic || bombedSubjects.has(r.subjectId);
      const excludedReason = toxic
        ? 'toxicity'
        : bombedSubjects.has(r.subjectId)
        ? 'review_bombing'
        : undefined;

      // Idempotent upsert on (rideId, subjectType).
      const res = await this.reviews.updateOne(
        { rideId: r.rideId, subjectType: r.subjectType },
        {
          $setOnInsert: {
            rideId: r.rideId,
            authorId: r.authorId,
            subjectId: r.subjectId,
            subjectType: r.subjectType,
            rating: r.rating,
            text: clean,
            lang: this.defaultLang,
            zoneId: r.zoneId,
            createdAt: r.createdAt,
            aspects: [],
            aspectsProcessed: false,
            excluded,
            excludedReason,
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount) ingested++;
    }

    await this.watermarks.updateOne(
      { source: 'rides' },
      { $set: { lastRatedAt: newWatermark } },
      { upsert: true },
    );
    this.logger.log(`Ingested ${ingested} new reviews (watermark -> ${newWatermark.toISOString()})`);
    return ingested;
  }

  /**
   * Review-bombing heuristic (spec §3.7): a subject receiving many reviews with
   * duplicate text in this batch is flagged; those reviews are excluded.
   */
  private detectReviewBombing(reviews: RawReview[]): Set<string> {
    const bySubject = new Map<string, string[]>();
    for (const r of reviews) {
      const arr = bySubject.get(r.subjectId) ?? [];
      arr.push((r.text ?? '').trim().toLowerCase());
      bySubject.set(r.subjectId, arr);
    }
    const bombed = new Set<string>();
    for (const [subject, texts] of bySubject) {
      if (texts.length < 5) continue;
      const nonEmpty = texts.filter(Boolean);
      const unique = new Set(nonEmpty);
      // High volume + low text diversity => likely coordinated bombing.
      if (nonEmpty.length >= 5 && unique.size <= Math.ceil(nonEmpty.length / 3)) {
        bombed.add(subject);
        this.logger.warn(`Review bombing suspected for subject ${subject} — excluded + flagged`);
      }
    }
    return bombed;
  }
}

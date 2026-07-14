/**
 * Abstraction over the review event source (spec §3.2 "cron + event"). Today we
 * scan the shared MongoDB rides collection via a watermark; a Kafka consumer for
 * `review.created` can implement this same interface later without touching the
 * pipeline.
 */
export interface RawReview {
  rideId: string;
  authorId: string;
  subjectId: string;
  subjectType: 'driver' | 'rider';
  rating: number;
  text: string;
  zoneId?: string;
  createdAt: Date;
}

export interface ReviewSource {
  /** Pull reviews newer than the watermark; returns them + the new watermark. */
  pullSince(watermark: Date, limit: number): Promise<{ reviews: RawReview[]; newWatermark: Date }>;
}

export const REVIEW_SOURCE = Symbol('REVIEW_SOURCE');

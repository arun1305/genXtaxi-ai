/**
 * Fixed aspect taxonomy (spec §3.3). Aspect classification must map to exactly
 * these keys; sentiment is a float in [-1, 1].
 */
export const ASPECTS = [
  'punctuality',
  'driving_safety',
  'cleanliness',
  'communication',
  'vehicle_condition',
  'route_efficiency',
  'pricing_fairness',
] as const;

export type Aspect = (typeof ASPECTS)[number];

export interface AspectResult {
  aspect: Aspect;
  /** [-1, 1] */
  sentiment: number;
  /** Short evidence span quoted from the review. */
  evidenceSpan?: string;
}

/** Per-driver structured summary (spec §3.3 output schema). */
export interface DriverSummaryJson {
  summary: string; // <= 60 words
  overall_sentiment: number; // [-1, 1]
  aspects: { name: Aspect; sentiment: number; mention_count: number }[];
  strengths: string[];
  improvements: string[];
  review_count: number;
  lang: string;
}

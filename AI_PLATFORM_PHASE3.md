# GenXTaxi AI Platform — Phase 3 (AI Review Summarizer)

Implements spec §3: a new `insights-service` (NestJS + Mongoose) that batch-analyzes
rider↔driver reviews into aspect-based, actionable summaries for riders, drivers and
admins. Summaries are **precomputed and served from cache — never on the read path**
(spec §3.2).

## Service

| Service | Port | Responsibility |
|---|---|---|
| `insights-service` | 8083 | Ingest ratings → aspect extraction → per-driver summaries → zone analytics; cron-driven batch pipeline; cached serving |

## Data reality vs spec

Ratings live **embedded in the ride doc** in gen-taxi-backend (`driverRating`,
`passengerRating` = `{ rating, review, ratedAt }`), and there is **no Kafka**. So:
- A `ReviewSource` interface abstracts the event source. `MongoReviewSource` scans the
  shared `rides` collection with a **watermark** (`insights_watermarks`) — incremental,
  resumable, no broker. A Kafka `review.created` consumer can implement the same
  interface later without touching the pipeline (spec §3.2 "cron + event").
- Ratings are **materialized** into insights-service's own `reviews` collection
  (spec §3.5 shape) so the summarizer owns its store.

## Pipeline (spec §3.3)

```
INGEST_CRON (*/5m): ingest → aspect-extract → refresh due driver summaries
ZONE_AGGREGATION_CRON (nightly): per-zone/week aspect sentiment + complaint clusters
```

1. **Ingest** — watermark scan, content filter (toxicity + PII mask), review-bombing
   exclusion (velocity + duplicate-text), idempotent upsert.
2. **Aspect extraction** — cheap 8B model via ai-gateway, **structured JSON**, fixed 7
   aspects (`punctuality, driving_safety, cleanliness, communication, vehicle_condition,
   route_efficiency, pricing_fairness`), sentiment ∈ [-1,1] + evidence span.
3. **Summarize** — deterministic per-driver rollup: aspect aggregates computed in-code;
   the LLM writes only prose (summary ≤60 words + strengths + improvements). Low temp +
   pinned `promptVersion` → reproducible/auditable (spec §3.7). Cached in Redis + Mongo.
4. **Zone aggregation** — per-zone/week aspect sentiment + emerging complaint clusters
   (embed negative reviews via ai-gateway, greedy cosine clustering), anonymized reps.

## Collections (spec §3.5)

`reviews` (materialized, aspects embedded), `driver_summaries` (cache; Mongo durable),
`zone_insights`, plus `insights_watermarks` (ingest bookkeeping).

## APIs (spec §3.6)

- `GET /api/v1/reviews/drivers/:id/summary?lang=fr` — rider reputation (chips + summary)
- `GET /api/v1/reviews/me/insights?lang=fr` — driver self-view (auth = driver)
- `GET /api/v1/admin/insights/zones?week=2026-W28` — admin analytics
- `POST /api/v1/admin/insights/recompute/:driverId` — force refresh

## Guardrails (spec §3.7)

- **Cold start** — `< COLD_START_MIN_REVIEWS` (5) → no LLM summary, "not enough reviews".
- **Toxicity/PII** — filtered/masked before summarizing; reviewer identity never surfaced.
- **Review bombing** — velocity + duplicate-text detection → excluded + flagged.
- **Determinism** — low temperature + pinned prompt version.
- **Language** — per-language summaries, cached per lang.

## Frontend

- **RN driver:** `src/screens/driver/MyFeedbackScreen.tsx` — coaching dashboard (strengths
  first, ≤3 improvement tips, per-aspect scores), RTL-aware. Client `insights.api.ts`.
- **RN rider:** `src/components/DriverReputationChips.tsx` — drop-in reputation summary +
  positive aspect chips for the driver card (never raw negatives).
- **Admin:** `pages/ai/ReviewInsightsPage.tsx` at `/ai/reviews` — aspect-sentiment
  heatmap by zone + complaint-cluster drill-down.

## Environment

`MONGODB_URI, REDIS_URL, JWT_SECRET, AI_GATEWAY_URL, INSIGHTS_SERVICE_TOKEN (service
admin JWT for batch LLM calls), SUMMARY_MIN_NEW_REVIEWS=5, SUMMARY_MAX_AGE_HOURS=24,
INGEST_CRON, ZONE_AGGREGATION_CRON, COLD_START_MIN_REVIEWS=5, SUMMARY_PROMPT_VERSION,
SUMMARY_TEMPERATURE=0.1, SUMMARY_CACHE_TTL_SECONDS, DEFAULT_LANG=fr`.
Frontend: `EXPO_PUBLIC_INSIGHTS_URL`. Admin: `VITE_INSIGHTS_SERVICE_URL`.

## Run / test / deploy

```bash
pnpm --filter insights-service run start:dev   # :8083/docs
pnpm --filter insights-service run test         # clustering, iso-week, content-filter
docker build -f insights-service/Dockerfile -t genxtaxi/insights-service:1.0 .
```

## Notes / next

- **Language detection:** materialized reviews default to `DEFAULT_LANG`. Add a cheap
  `lang_detect` call (ai-gateway `AiTask.LANG_DETECT`) per review for mixed-language fleets.
- **Zone id:** taken from `ride.zoneId` if present, else `'unknown'`; wire the ride's
  actual zone/H3 field when Phase 4 lands.
- `INSIGHTS_SERVICE_TOKEN` is a long-lived admin JWT for the batch LLM calls; rotate it
  like any service credential.

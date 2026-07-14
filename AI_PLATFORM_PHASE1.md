# GenXTaxi AI Platform — Phase 1 (Foundation)

Implements spec §1 (shared conventions), §5 (cross-cutting), §6 (observability/cost),
and §7 Phase 1: **ai-gateway + provider abstraction + observability + Atlas Vector
Search RAG store + currency-service**.

## Services

| Service | Port | Stack | Responsibility |
|---|---|---|---|
| `ai-gateway` | 8080 | NestJS + Mongoose | Auth, RBAC, throttle, per-user token budget, PII redaction, provider routing (task→model), prompt versioning, RAG store, observability + cost |
| `currency-service` | 8081 | NestJS + Mongoose | Supported currencies, minor-unit exponents, rounding, FX rates (scheduled + cached), conversion & base-currency normalization |
| `@genxtaxi/ai-shared` | — | TS lib | Money value object, provider interfaces, JWT payload, error types |

Core apps (RN, admin, `gen-taxi-backend`) **never call an LLM/embedding/FX provider
directly** — only through `ai-gateway` / `currency-service` (spec §1).

## Prerequisites

- Node 20+, **pnpm 8+** (`corepack enable`)
- MongoDB Atlas (for `$vectorSearch`) or local Mongo (falls back to in-memory cosine)
- Redis
- Provider keys: `GROQ_API_KEY`, `COHERE_API_KEY` (embeddings), optional `ANTHROPIC_API_KEY`

## Install & run (local)

```bash
# from repo root
pnpm install
pnpm --filter @genxtaxi/ai-shared run build   # shared lib first

cp ai-gateway/.env.example ai-gateway/.env
cp currency-service/.env.example currency-service/.env
# edit both: set MONGODB_URI, REDIS_URL, JWT_SECRET (MUST match gen-taxi-backend),
# GROQ_API_KEY, COHERE_API_KEY

pnpm run dev:currency     # http://localhost:8081/docs
pnpm run dev:gateway      # http://localhost:8080/docs
```

Or the full containerized stack (Mongo + Redis + Prometheus + Grafana + services):

```bash
JWT_SECRET=... GROQ_API_KEY=... COHERE_API_KEY=... pnpm run docker:up
```

## Environment variables

See `ai-gateway/.env.example` and `currency-service/.env.example`. Key ones:

- `JWT_SECRET` / `JWT_ALGORITHM` / `JWT_ISSUER` — **must match gen-taxi-backend** so the
  gateway validates the same tokens.
- `LLM_CHAT_MODEL` (default `llama-3.3-70b-versatile`), `LLM_CHEAP_MODEL`
  (`llama-3.1-8b-instant`), `ANTHROPIC_FALLBACK_MODEL`.
- `EMBEDDING_PROVIDER=cohere`, `EMBEDDING_MODEL=embed-multilingual-v3.0`,
  `EMBEDDING_DIMENSIONS=1024` (must equal the Atlas index dimension).
- `DAILY_TOKEN_BUDGET_PER_USER`, `THROTTLE_TTL_SECONDS`, `THROTTLE_LIMIT`,
  `AI_LOG_RETENTION_DAYS`.
- currency-service: `FX_API_URL` (default exchangerate.host), `FX_BASE_CURRENCY=DZD`,
  `FX_REFRESH_CRON`, `REPORTING_BASE_CURRENCY=USD`.

## Database migrations

No manual migrations — Mongoose creates collections + indexes on boot. Two out-of-band
steps for MongoDB Atlas:

1. **Atlas Vector Search index** for `kb_chunks` (spec §2.6):
   ```bash
   ./ai-gateway/scripts/create-atlas-index.sh <clusterName>
   # or import ai-gateway/scripts/atlas-vector-index.json via the Atlas UI
   ```
   Index name **must** be `kb_chunks_vector`, 1024-dim, cosine, filter field `lang`.
2. `currencies` are auto-seeded (DZD/EUR/USD/XOF/MAD/TND/NGN); FX rates warm on boot
   and refresh on `FX_REFRESH_CRON`.

## Testing

```bash
pnpm -r run test                          # all packages
pnpm --filter @genxtaxi/ai-shared run test # Money VO unit tests
pnpm --filter ai-gateway run test          # budget, redaction, pricing, prompts
pnpm --filter currency-service run test    # currencies integration (mongodb-memory-server)
```

## API docs (OpenAPI)

- ai-gateway: `GET http://localhost:8080/docs` (Swagger UI) · `pnpm --filter ai-gateway run openapi` → `ai-gateway/openapi.json`
- currency-service: `GET http://localhost:8081/docs` · `pnpm --filter currency-service run openapi`

## Key endpoints (Phase 1)

**ai-gateway**
- `GET /health` · `GET /metrics` (Prometheus)
- `POST /api/v1/ai/complete` · `POST /api/v1/ai/embed`
- `POST /api/v1/kb/documents` · `GET /api/v1/kb/documents` · `POST /api/v1/kb/documents/:id/publish` · `POST /api/v1/kb/search`
- `GET/POST /api/v1/prompts` · `POST /api/v1/prompts/:key/:version/publish` · `POST /api/v1/prompts/:key/:version/preview`
- `GET /api/v1/admin/ai/cost` · `GET /api/v1/admin/ai/cost/daily`

**currency-service**
- `GET/POST /api/v1/currencies` · `GET /api/v1/fx/rates?base=&quote=` · `POST /api/v1/fx/refresh`
- `POST /api/v1/convert` · `POST /api/v1/reporting/normalize`

## Admin UI

New pages under `gen-taxi-admin` (routes `/ai/cost`, `/ai/currencies`, `/ai/knowledge`).
Set `VITE_AI_GATEWAY_URL` and `VITE_CURRENCY_SERVICE_URL` in the admin env.

## Deployment

Both services ship a workspace-aware multi-stage `Dockerfile`. Build/push:

```bash
docker build -f ai-gateway/Dockerfile -t genxtaxi/ai-gateway:1.0 .
docker build -f currency-service/Dockerfile -t genxtaxi/currency-service:1.0 .
```

CI (`.github/workflows/ai-ci.yml`) installs the workspace, builds the shared lib,
lints, runs unit + integration tests, builds both services, and uploads the OpenAPI
specs as artifacts (regression gate foundation for Phase 5).

## What's next

Phase 2 (Chatbot) consumes: `ai-gateway` `/ai/complete` (tool-calling loop),
`/kb/search` (RAG retrieval), prompt registry (`chatbot.system`), and
`currency-service` for all money in tool results.

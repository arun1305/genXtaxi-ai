# 6. AI Platform

Separate pnpm workspace at the repo root (see also the phase docs `AI_PLATFORM_PHASE1..5.md`, `AI_DEPLOYMENT.md`, `AI_LOCALIZATION_QA.md`).

| Service | Port | Purpose |
|---|---|---|
| `ai-gateway` (NestJS) | 8080 | Single entry to LLMs: JWT+RBAC, throttling, token budget, PII redaction, Groq + Anthropic router with circuit breaker/fallback, prompt versioning, RAG store (Atlas `$vectorSearch` with in-memory cosine fallback), call logs, cost API, demand proxy |
| `currency-service` | 8081 | FX rates, Money value object |
| `chat-orchestrator` | 8082 | Support chatbot: tool-calling loop (max 5 hops), 7 tools with server-side authz calling the Backend REST API with the caller's JWT, RAG, grounding check, confirmation-gated book/cancel, refund → admin queue, SSE streaming, escalation + admin handoff inbox |
| `insights-service` | 8083 | Batch review pipeline: aspect extraction, per-driver summaries, zone aggregation; guardrails (cold start <5, toxicity/PII, review-bombing) |
| `demand-service` (FastAPI) | 8084 | H3 demand actuals, seasonal baseline + LightGBM, advisory surge engine, heatmap |
| `packages/ai-shared` | — | Shared types/interfaces |
| `ai-eval` | — | Golden-set regression gate (wired into CI) |

## Models and config
Chat models default to Groq `openai/gpt-oss-120b` (chat) and `openai/gpt-oss-20b` (cheap/aspects) — the earlier llama-3.x models were decommissioned. `GROQ_BASE_URL` must be host-only (`https://api.groq.com`). Embeddings: `EMBEDDING_PROVIDER=local` (hash-based 1024-dim; Cohere is the intended production provider but no key is configured).

## Production facts
- Deployed on Render (Singapore, Docker, same Atlas DB and Redis as the backend). Auto-deploy does **not** fire on push: trigger via `POST /v1/services/{id}/deploys`.
- Each service must declare every dependency it imports (workspace hoisting hides gaps locally; Render clean builds expose them).
- Atlas Vector index `kb_chunks_vector` must be created (`ai-gateway/scripts/create-atlas-index.sh`); until then search uses the cosine fallback.
- The production knowledge base was empty; draft policy docs are in `ai-gateway/kb-drafts/` awaiting review (`[CONFIRM]` markers).
- Demand/insights output needs real ride history (empty in a fresh environment).

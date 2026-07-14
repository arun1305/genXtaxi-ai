# GenXTaxi AI Platform — Phase 5 (Cross-cutting hardening)

Implements spec §5 (security, compliance, evaluation, localization) and §6
(observability & cost dashboard), plus a real end-to-end live smoke test.

## 1. Evaluation harness / regression gate (spec §5)

`ai-eval/` — golden test sets + a runner that fails CI if any suite drops below
threshold. Tests the **real production code**, not re-implementations:

| Suite | Source under test | Threshold | Result |
|---|---|---|---|
| redaction | ai-gateway `RedactionService` (built dist) | 100% | ✅ 5/5 |
| grounding | chat-orchestrator `GroundingService` (built dist) | 100% | ✅ 6/6 |
| surge | demand-service `surge_engine` (real Python) | 100% | ✅ 4/4 |
| faq (live) | ai-gateway `/ai/complete` → real Groq | ≥90% | ✅ 4/4 (FR/EN/AR) |

- Run: `node ai-eval/run-eval.mjs` (deterministic suites always run; FAQ runs live
  only when `EVAL_GATEWAY_URL` + `EVAL_TOKEN` are set — otherwise SKIPPED, never a
  silent pass).
- Wired into `.github/workflows/ai-ci.yml` as a gate after the build step.

## 2. Unified AI Ops dashboard (spec §6)

`gen-taxi-admin` → `/ai/ops` (`AiOpsPage`): single pane with
- **service health** across all 5 services (ai-gateway, currency, chat-orchestrator,
  insights, demand) with dependency status,
- **demand model health** (MAPE vs baseline, beats-baseline %, drift),
- **per-feature** request volume, tokens, cost, error rate, P95 latency (from
  `ai_call_logs` via `/admin/ai/cost`),
- deep links to the per-feature consoles (`/ai/cost`, `/ai/handoff`, `/ai/reviews`,
  `/ai/surge`).

Prometheus `/metrics` (ai-gateway) + the cost API are the data sources; alerting on
cost spikes / latency SLO / drift is a Grafana concern (compose ships Prometheus +
Grafana).

## 3. Localization QA (spec §5)

See [AI_LOCALIZATION_QA.md](AI_LOCALIZATION_QA.md). Added FR/AR/EN keys for all new
AI surfaces, fixed the RN i18n integration, RTL mirroring verified, and the custom
`t()` now supports a string fallback. Live model output confirmed in-language
(incl. Arabic) via the eval harness.

## 4. Security & compliance (spec §5)

Consolidated + live-verified:
- **Auth required + role scoping** — every AI endpoint behind JWT; admin/driver/owner
  scoping server-side. **Live-verified:** `POST /currencies` → 401 without token, 201
  with a real backend-signed admin token.
- **PII redaction** before any provider call (ai-gateway) — unit + golden tested.
- **Rate limiting & budgets** — `@nestjs/throttler` on all services + per-user daily
  token budget (Redis).
- **Circuit breakers + fallback** — **live-verified**: Groq failure fell through to the
  Anthropic fallback; both-down returned a clean `PROVIDER_UNAVAILABLE`.
- **Prompt/model versioning** — versioned prompt registry + model registry with
  rollback.
- **Data retention** — TTL indexes on `ai_call_logs` and `chat_messages`.

## 5. End-to-end live smoke test (real keys)

Ran against **local Mongo + Redis** (a `_smoke` DB — prod Atlas/Redis untouched),
reusing the real `JWT_SECRET`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY` from
`gen-taxi-backend/.env`:

| Check | Result |
|---|---|
| currency-service `/health` | ✅ mongodb + redis connected |
| Currencies auto-seed | ✅ 7 (DZD/EUR/USD/XOF/MAD/TND/NGN), XOF exp 0 |
| Auth (real backend JWT) | ✅ 401 without / 201 with admin token |
| FX provider down | ✅ degraded gracefully (no crash) |
| ai-gateway `/health` + `/metrics` | ✅ up; Prometheus counters serving |
| **Real Groq LLM call** | ✅ `llama-3.3-70b`, correct **French** reply, 539ms |
| Observability | ✅ `ai_call_logs` + cost API + metrics populated |
| Fallback chain | ✅ Groq→Anthropic tried on error |

### 🐞 Production bug found & fixed by the smoke test
`GROQ_BASE_URL` defaulted to `…/openai/v1`, but the `groq-sdk` **also** appends
`/openai/v1/chat/completions` → the request URL doubled to
`/openai/v1/openai/v1/chat/completions` (404). **No Groq call would have worked in
prod.** Fixed: base URL is now host-only and the provider strips a stray
`/openai/v1` suffix defensively. Re-verified with a successful live call.

## What still needs production data / native review
- Demand model "beats baseline ≥15% MAPE" — path built + gated; needs real ride history.
- Native FR/AR copy sign-off (checklist in AI_LOCALIZATION_QA.md).
- Cohere embeddings key absent → RAG ingestion + review clustering need the key wired.

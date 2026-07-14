# GenXTaxi AI Platform — Phase 2 (AI Chatbot)

Implements spec §2 in full: a new `chat-orchestrator` (NestJS + Mongoose) fronted
by the Phase 1 `ai-gateway`, with the tool-calling loop, RAG grounding,
confirmation-gated actions, SSE streaming, and human escalation.

## Service

| Service | Port | Responsibility |
|---|---|---|
| `chat-orchestrator` | 8082 | Session + tool-calling loop (cap 5 hops), RAG retrieval via ai-gateway, 7 tools with server-side authz, grounding check, confirmation cards, SSE, escalation + admin handoff inbox |

Flow: `RN → chat-orchestrator → ai-gateway (/ai/complete, /kb/search) → Groq`;
tools → `gen-taxi-backend` REST (caller JWT forwarded); money via `currency-service`.

## Tool → endpoint mapping (verified against gen-taxi-backend)

| Tool | Endpoint / behavior | Guardrail |
|---|---|---|
| `get_fare_estimate` | `POST /rides/estimate` | read-only |
| `get_ride_status` | `GET /rides/active` or `/rides/:id` | owner (forwarded JWT) |
| `book_ride` | preview estimate → **action card** → `POST /rides` on confirm | confirmation + idempotency key |
| `cancel_ride` | read ride for fee → **action card** → `POST /rides/:id/cancel` | confirmation + idempotency |
| `get_payment_history` | `GET /wallet/history` | PAN redaction in orchestrator |
| `explain_charge` | `GET /rides/:id` | owner |
| `initiate_refund` | **action card** → queue `refund_requests` + `support_tickets` for admin | per-day rate limit + anomaly flag |
| `escalate_to_human` | create `support_tickets`, mark session escalated | always available |

**Refund policy (this phase):** all refunds **queue to admin** — no auto-approve
(your chosen option). The admin approves in the handoff inbox, which then calls the
existing `POST /payments/:id/refund`.

## APIs (spec §2.7)

- `POST /api/v1/chat/sessions` → `{ sessionId }`
- `POST /api/v1/chat/sessions/:id/messages` → **SSE** (`token`, `tool_call_proposed`, `tool_result`, `action_card`, `done`, `error`)
- `GET /api/v1/chat/sessions/:id` → transcript
- `POST /api/v1/chat/sessions/:id/confirm` → `{ toolCallId, decision }`
- `POST /api/v1/chat/sessions/:id/escalate` → `{ ticketId }`
- Admin: `GET /api/v1/admin/chat/inbox`, `GET .../sessions/:id/transcript`, `GET .../sessions/:id/suggested-reply`, `POST .../tickets/:id/{assign,resolve}`

## Collections (spec §2.6)

`chat_sessions`, `chat_messages` (TTL), `support_tickets`, plus `refund_requests`
(admin-approval queue). `kb_documents`/`kb_chunks` come from Phase 1.

## Guardrails implemented (spec §2.8)

- **Grounding rule** — post-generation check blocks + regenerates if the reply
  contains a currency amount not present in a tool result (unit-tested).
- **Confirmation gating** — book/cancel/refund never execute without an explicit
  `/confirm`; pending actions stored in Redis (single-use, TTL).
- **Prompt injection** — retrieved KB + user content passed as DATA; system prompt
  instructs the model to treat it as data, never instructions.
- **Idempotency** — Redis `SET NX` guard on every committed action.
- **Refund abuse** — per-user/day counter, anomaly flag surfaced to admin.
- **Provider outage** — degrades to a scripted message + auto-escalation (never a dead end).
- **Server-side authz** — every tool re-checks role; client role claims never trusted.

## Frontend

- **RN (rider/driver):** `src/screens/chat/SupportChatScreen.tsx` — streaming
  bubbles, quick-reply chips, action-confirmation cards, RTL mirroring for Arabic,
  "Talk to a human". SSE via `supportChat.api.ts` (XHR progress parser).
  Register in your navigator, e.g. `<Stack.Screen name="SupportChat" component={SupportChatScreen} />`,
  and deep-link `genxtaxi://support/chat`.
- **Admin:** `pages/ai/HandoffInboxPage.tsx` at route `/ai/handoff` — inbox +
  transcript + AI suggested-reply draft + assign/resolve.

## Environment

New (chat-orchestrator): `MONGODB_URI, REDIS_URL, JWT_SECRET (match gen-taxi-backend),
AI_GATEWAY_URL, GEN_TAXI_BACKEND_URL, CURRENCY_SERVICE_URL, MAX_TOOL_HOPS=5,
SESSION_CONTEXT_TURNS=10, CHAT_RETENTION_DAYS=90, REFUND_MAX_PER_DAY=3,
CONFIRM_TTL_SECONDS=300, MARKET=Algeria, DEFAULT_LANG=fr`.
Frontend: `EXPO_PUBLIC_CHAT_ORCHESTRATOR_URL`. Admin: `VITE_CHAT_ORCHESTRATOR_URL`.

## Setup / run

```bash
pnpm install
pnpm --filter @genxtaxi/ai-shared run build
cp chat-orchestrator/.env.example chat-orchestrator/.env   # edit
pnpm --filter chat-orchestrator run start:dev              # :8082/docs

# Seed & publish the versioned system prompt into ai-gateway's registry:
ADMIN_TOKEN=<admin jwt> AI_GATEWAY_URL=http://localhost:8080 \
  pnpm --filter chat-orchestrator run seed:prompt
```

## Testing

```bash
pnpm --filter chat-orchestrator run test   # grounding (acceptance §2.9), money-scan, tool authz
```

## Deployment

```bash
docker build -f chat-orchestrator/Dockerfile -t genxtaxi/chat-orchestrator:1.0 .
# or the whole stack:
pnpm run docker:up
```

## Known limitations / next

- **Token streaming** is chunked from the final gateway completion. True
  provider→client token streaming needs an SSE endpoint on `ai-gateway`
  (`/ai/complete/stream`) — a small Phase 2.x add; the SSE event contract already
  supports it.
- **Geocoding:** tools accept `"lat,lng"` directly; free-text addresses are passed
  through to the backend. Add a geocode step if the estimate endpoint requires coords.
- Acceptance criteria met in code: 100% state-changes gated, grounding enforced
  (unit-tested), escalation always available. P95 first-token latency depends on
  adding real provider streaming (above).

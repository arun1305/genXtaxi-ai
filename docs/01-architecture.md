# 1. Architecture & Repositories

## 1.1 Repositories

| Folder | Git remote | Stack | Role |
|---|---|---|---|
| `gen-taxi-backend/` | `arun1305/genXtaxi-backend` (main) | Node 20, Express, MongoDB/Mongoose, Redis, Socket.IO | Core API + realtime |
| `gen-taxi-frontend/` | `arun1305/genXtaxi-Mobile` (branch `ai-features`) | Expo SDK 50, React Native, TypeScript | One codebase → rider app and driver app (`APP_VARIANT`) |
| `gen-taxi-admin/` | `arun1305/genXtaxi-Admin` (main) | React, Vite, TypeScript, Tailwind, React Query | Admin dashboard |
| AI platform (repo root) | `arun1305/genXtaxi-ai` (main) | NestJS services + one FastAPI service, pnpm workspace | `ai-gateway`, `currency-service`, `chat-orchestrator`, `insights-service`, `demand-service`, `packages/ai-shared`, `ai-eval` |
| `genxtaxi-nestjs-backend/`, `gen-taxi-landing/` | — | NestJS/Prisma; landing site | Not part of the live flow described here **(unverified)** |

## 1.2 System diagram

```
 Rider app ─┐                                   ┌─ MongoDB (genxtaxi)
 Driver app ─┼─ REST (JWT) + Socket.IO ─► Backend API ─┼─ Redis (geo, cache, pub/sub)
 Admin web ──┘                                   └─ Stripe/Razorpay, Twilio/MSG91, FCM, S3, Google Maps
      │
      └─ AI calls ─► ai-gateway ─► Groq / Anthropic (LLMs), embeddings
                         ├─ chat-orchestrator  (support chatbot, tools call the Backend REST API)
                         ├─ insights-service   (review summaries; reads rides collection)
                         ├─ demand-service     (FastAPI; demand forecast + advisory surge)
                         └─ currency-service   (FX)
```

All services share one JWT secret (`JWT_SECRET`) so a token issued by the backend is accepted everywhere. JWT payload: `{ id, role, sessionId, jti }`; roles are `passenger`, `driver`, `admin`.

## 1.3 Key design decisions
- **One mobile codebase, two apps.** `APP_VARIANT=driver|passenger` selects package ID, navigator and branding.
- **Backend dispatch is server-driven**: Redis geo index of online drivers, expanding search radius (3→5→8→12 km), one offer at a time, ~30 s offer window, retry loop.
- **Pickup OTP gate**: a trip cannot start until the driver enters the 4-digit OTP shown to the rider.
- **Surge**: the live backend has a polygon/time-window surge engine (`modules/pricing`). The AI `demand-service` surge is *advisory/shadow only* and does not change fares.
- **AI platform is separate** so it can scale and fail independently; the apps degrade gracefully when it is down.
- **Refunds always queue to an admin** (never auto-approved by the chatbot).

## 1.4 Environments
- **Production (Render, Singapore):** `gentaxi-backend`, plus five AI services (`gentaxi-ai-gateway`, `-currency`, `-chat`, `-insights`, `-demand`). Free/starter plans: services sleep when idle (cold start ≈ 30–50 s).
- **Local:** backend :5001, admin :5173, Mongo :27017, Redis :6379 (see doc 7).

# GenXTaxi AI Platform — Deployment (Render)

Deploys the 5 AI services so the APK's AI features work for real users. The apps
authenticate against `gentaxi-backend.onrender.com`, so the AI services **must**
share that backend's `JWT_SECRET` and point at the **same MongoDB** to see real
rides/users.

## Service → URL map (must match the app's EXPO_PUBLIC_* build vars)

| Service | Render name | URL | App env var |
|---|---|---|---|
| ai-gateway | `gentaxi-ai-gateway` | https://gentaxi-ai-gateway.onrender.com | `EXPO_PUBLIC_AI_GATEWAY_URL` |
| chat-orchestrator | `gentaxi-chat` | https://gentaxi-chat.onrender.com | `EXPO_PUBLIC_CHAT_ORCHESTRATOR_URL` |
| insights-service | `gentaxi-insights` | https://gentaxi-insights.onrender.com | `EXPO_PUBLIC_INSIGHTS_URL` |
| currency-service | `gentaxi-currency` | https://gentaxi-currency.onrender.com | (internal) |
| demand-service | `gentaxi-demand` | https://gentaxi-demand.onrender.com | (via gateway) |

These names are wired into `render.yaml` and the app `.env`. If you rename a
service on Render, update both.

## Prerequisites (what I need from you)

1. **A GitHub repo for the AI services.** They currently live at the repo root but
   are **not in any git repo**. Options:
   - Create `github.com/arun1305/genXtaxi-ai`, and I'll init + push the AI dirs
     (`ai-gateway`, `currency-service`, `chat-orchestrator`, `insights-service`,
     `demand-service`, `packages`, `ai-eval`, `render.yaml`, `docker`) to it, **or**
   - Tell me to add them into an existing repo.
2. **Render access** — either a **Render API key** (I deploy via Blueprint), or you
   click *New → Blueprint* in the Render dashboard and point it at the repo.
3. **Secrets** to set as Render env vars (dashboard → each service → Environment).
   Keep them in Render, not in git:
   - `JWT_SECRET` — **the exact value from gentaxi-backend on Render** (so app
     logins validate). This is the single most important one.
   - `MONGODB_URI` — the **prod** Atlas URI (same cluster as gentaxi-backend).
   - `REDIS_URL` — a Render Key-Value (Redis) instance or your existing Redis.
   - `GROQ_API_KEY` — for the chatbot LLM (you already have one).
   - `COHERE_API_KEY` — optional; set it **and** flip `EMBEDDING_PROVIDER=cohere`
     on ai-gateway for production-grade RAG. Without it, local hash embeddings run.
   - `INSIGHTS_SERVICE_TOKEN` — a long-lived admin JWT (sign one with the same
     secret) for the summarizer's batch LLM calls.

## Deploy steps

1. Push the AI services to the GitHub repo (see prereq 1).
2. Provision **MongoDB** (reuse prod Atlas) + **Redis** (Render Key-Value).
3. Render → **New → Blueprint** → select the repo → it reads `render.yaml` and
   creates all 5 services.
4. For each service, set the `sync:false` secrets (JWT_SECRET, MONGODB_URI,
   REDIS_URL, GROQ_API_KEY, …).
5. Deploy. Verify health:
   ```
   curl https://gentaxi-ai-gateway.onrender.com/health
   curl https://gentaxi-chat.onrender.com/health
   curl https://gentaxi-insights.onrender.com/health
   curl https://gentaxi-currency.onrender.com/health
   curl https://gentaxi-demand.onrender.com/health
   ```
6. Create the **Atlas Vector Search index** for RAG (only if using Cohere/Atlas):
   `./ai-gateway/scripts/create-atlas-index.sh <cluster>` (spec §2.6).
7. Seed the chatbot system prompt:
   `ADMIN_TOKEN=<admin jwt> AI_GATEWAY_URL=https://gentaxi-ai-gateway.onrender.com \
     pnpm --filter chat-orchestrator seed:prompt`

## Verify AI features in the app

After deploy, open the APK → Profile → **AI Assistant** → ask *"Comment annuler
ma course ?"*. A logged-in user's real JWT flows to chat-orchestrator → ai-gateway
→ Groq. Driver: Profile → **My Feedback** (populates once reviews are summarized).

## Notes

- Free/starter Render services cold-start (~30–50s first request). The app clients
  degrade gracefully on timeout.
- `SURGE_ADVISORY=true` keeps the ML surge shadow-only (no live fare impact).
- Retention/TTL indexes and cron pipelines start automatically on boot.

# 7. Setup, Deployment & Operations

## 7.1 Local setup (backend)
Prereqs: Node 20, MongoDB 7, Redis 7.
```
cd gen-taxi-backend && npm install
cp .env.example .env     # set MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY …
export MONGO_URI=mongodb://localhost:27017/genxtaxi_dev PORT=5001 DEMO_MODE=true
node scripts/seedAdmin.js && node scripts/seedDocumentTypes.js
node src/app.js           # health: GET /api/v1/health
```
Admin: `cd gen-taxi-admin && npm install && VITE_API_URL=http://localhost:5001/api/v1 npm run dev`.
Mobile: see doc 4. AI services: `pnpm install` then `pnpm dev:gateway` etc., or `docker compose -f docker/docker-compose.ai.yml up`.

## 7.2 Backend environment variables (names only)
Core: `NODE_ENV PORT MONGO_URI REDIS_HOST/PORT/PASSWORD JWT_SECRET JWT_REFRESH_SECRET ENCRYPTION_KEY DEMO_MODE`.
Auth: `GOOGLE_OAUTH_CLIENT_ID(S) APPLE_CLIENT_ID(S)`. Payments: `PAYMENT_PROVIDER STRIPE_* RAZORPAY_*`. Messaging: `SMS_PROVIDER TWILIO_* MSG91_* EMAIL_PROVIDER SENDGRID_API_KEY SMTP_* PUSH_PROVIDER FIREBASE_*`. Maps/storage: `GOOGLE_MAPS_API_KEY AWS_*`. Pricing defaults: `BASE_FARE PER_KM_RATE PER_MIN_RATE DRIVER_COMMISSION_RATE PLATFORM_FEE_RATE SURGE_*`.
AI services additionally need the **same `JWT_SECRET`**, `MONGODB_URI`, `REDIS_URL`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `INSIGHTS_SERVICE_TOKEN`, `DEMAND_SERVICE_URL`.

## 7.3 Deployment (Render)
Services: `gentaxi-backend` plus the five AI services (`render.yaml` blueprint, Docker). Redeploy API: `POST https://api.render.com/v1/services/{id}/deploys`. Order: backend first when schema/behaviour changes, then AI services. Free plans sleep — warm them before demos.
Release checklist: run tests → merge → deploy backend → smoke test (`/health`, login, estimate) → publish OTA / build APKs.

## 7.4 Operations runbook
- **Chatbot says "briefly unavailable":** check gateway model env vars and Groq model availability; look at circuit breaker in gateway logs.
- **Rides stuck in `searching`:** no online driver within radius for the tier; check `drivers:online:*` in Redis and driver `currentLocation`.
- **AI features slow after idle:** Render cold start; warm `/health`.
- **Wallet top-up 503:** payment gateway keys not configured.
- **Payout "No earnings":** period/ledger mismatch; verify `DriverEarning` rows and already-paid totals.

## 7.5 Security notes
Rotate any credential that has appeared in chat/logs (Render API key, admin password). Do not commit `.env` or the Firebase admin JSON (`genxtaxi-firebase-adminsdk-*.json` sits in the repo root — move it out and rotate if it was ever pushed). Change the seeded admin password. Keep `DEMO_MODE` **off** in production (OTP bypass). Integration secrets are stored AES-encrypted via `ENCRYPTION_KEY`.

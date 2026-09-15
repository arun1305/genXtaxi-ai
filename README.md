# GenTaxi — Full-Stack Taxi Booking Platform

A production-ready, Uber-inspired taxi booking platform built with a **Liquid Glossy** design system.

```
GenXTaxi/
├── gen-taxi-backend/     Node.js + Express + MongoDB + Redis + Socket.IO
├── gen-taxi-frontend/    React Native (Expo) — Passenger & Driver apps
└── gen-taxi-admin/       React + TypeScript + Tailwind — Admin dashboard
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Mobile Apps (Expo)                          │
│   ┌─────────────────────┐      ┌─────────────────────────────────┐  │
│   │   Passenger App      │      │         Driver App              │  │
│   │  • Book ride         │      │  • Online/offline toggle        │  │
│   │  • Live map tracking │      │  • Accept/decline offers        │  │
│   │  • Payments          │      │  • Location broadcast (3–5s)   │  │
│   │  • Ride history      │      │  • Earnings dashboard           │  │
│   └──────────┬──────────┘      └─────────────┬───────────────────┘  │
└──────────────┼──────────────────────────────────────────────────────┘
               │  REST API (JWT)  +  Socket.IO (WSS)
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Nginx (Reverse Proxy)                        │
│              SSL termination · rate limiting · WebSocket upgrade     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
               ┌───────────────▼──────────────────┐
               │      Gen-Taxi Backend API         │
               │  Express.js  ·  Socket.IO 4       │
               │                                   │
               │  Modules:                         │
               │   auth · users · drivers          │
               │   rides · payments · pricing      │
               │   notifications · admin           │
               │                                   │
               │  Services:                        │
               │   Stripe · Twilio · FCM           │
               │   Google Maps · AWS S3            │
               └──────┬──────────────┬────────────┘
                      │              │
          ┌───────────▼──┐   ┌───────▼──────┐
          │  MongoDB 7    │   │   Redis 7    │
          │  (primary DB) │   │  (cache +    │
          │               │   │   pub/sub)   │
          └───────────────┘   └──────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                    Admin Panel (React + Vite)                        │
│   Dashboard · Users · Drivers · Rides · Pricing · Promos · Charts   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Feature Matrix

### Passenger App
- Phone + OTP authentication
- Real-time nearby driver markers on dark Google Maps
- Ride type selection (Economy / Comfort / XL / Premium / Bike)
- Live fare estimation with surge multiplier badge
- Promo code application
- Cash / Card / Wallet payment selection
- Live driver tracking (GPS updates every 3–5s)
- In-ride chat
- Ride cancellation with reason
- Post-ride rating and review
- Ride history
- Saved addresses (Home / Work)

### Driver App
- Online / Offline toggle with live GPS tracking
- Ride offer popup with 30s countdown timer
- Route preview, distance, ETA, and estimated earning
- Accept / Decline
- Trip navigation flow
- Earnings dashboard (today / week / month / total)
- Document upload for onboarding

### Admin Panel
- Live KPI dashboard (users, drivers, rides, revenue)
- Ride + revenue trend charts (7d / 30d / 90d)
- Top driver leaderboard
- User management (search, block, unblock)
- Driver approval workflow (approve / reject with notes)
- Ride monitoring with status filters
- Fare engine config (per ride type, per zone)
- Revenue split editor (driver commission / platform fee)
- Surge pricing config (thresholds + max multiplier)
- Promo code CRUD (%, fixed, free ride)
- Analytics with doughnut + bar + line charts

---

## Design System

**Liquid Glossy** — dark glassmorphism UI inspired by Uber.

| Token | Value | Usage |
|---|---|---|
| Primary Yellow | `#E0C04F` | CTA buttons, active states, prices |
| Dark Charcoal | `#2F3440` | App background |
| Slate Grey | `#565B6B` | Secondary surfaces |
| Muted Blue | `#5F7FB2` | Info, driver markers |
| Light Grey | `#B7B8AE` | Secondary text |

All surfaces use `backdrop-filter: blur(20px)` + semi-transparent fills for the glass effect.

---

## Getting Started

### 1. Clone repositories

```bash
# All three repos sit inside this workspace
cd GenXTaxi

# Backend
cd gen-taxi-backend && npm install && cp .env.example .env

# Frontend
cd ../gen-taxi-frontend && npm install && cp .env.example .env

# Admin
cd ../gen-taxi-admin && npm install && cp .env.example .env
```

### 2. Configure environment variables

Edit each `.env` file — minimum required:

**Backend `.env`:**
```bash
MONGO_URI=mongodb://localhost:27017/gentaxi
REDIS_HOST=localhost
JWT_SECRET=your_32+_char_secret
STRIPE_SECRET_KEY=sk_test_...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
GOOGLE_MAPS_API_KEY=...
```

**Frontend `.env`:**
```bash
EXPO_PUBLIC_API_URL=http://localhost:5000/api/v1
EXPO_PUBLIC_GOOGLE_MAPS_KEY=...
```

**Admin `.env`:**
```bash
VITE_API_URL=http://localhost:5000/api/v1
```

### 3. Start with Docker Compose (quickest)

```bash
cd gen-taxi-backend
docker-compose up -d
```

This starts: API (port 5000) + MongoDB (27017) + Redis (6379) + Nginx (80/443).

### 4. Start mobile app

```bash
cd gen-taxi-frontend
npm start        # Expo dev server
npm run ios      # iOS Simulator
npm run android  # Android Emulator
```

### 5. Start admin panel

```bash
cd gen-taxi-admin
npm run dev      # http://localhost:3000
```

---

## API Quick Reference

```
POST   /api/v1/auth/send-otp          Send OTP
POST   /api/v1/auth/verify-otp        Login → returns JWT
POST   /api/v1/rides/estimate         Fare estimate
POST   /api/v1/rides                  Book ride
GET    /api/v1/rides/history          Ride history
PATCH  /api/v1/drivers/me/status      Go online/offline
PATCH  /api/v1/drivers/me/location    Update GPS
GET    /api/v1/admin/dashboard        KPI stats (admin)
```

Full API docs in [gen-taxi-backend/README.md](gen-taxi-backend/README.md).

---

## Socket.IO Events

| Direction | Event | Description |
|---|---|---|
| Client→Server | `driver:location` | GPS update (every 3–5s) |
| Client→Server | `ride:join` | Passenger subscribes to ride room |
| Client→Server | `ride:response` | Driver accept/decline |
| Server→Client | `ride:offer` | New ride offer (with timeout) |
| Server→Client | `ride:status` | Status change |
| Server→Client | `driver:location` | Driver coords relayed to passenger |
| Server→Client | `notification` | In-app push |

---

## Production Deployment

### Backend
```bash
# Build and push Docker image
docker build -t gen-taxi-backend .
docker-compose -f docker-compose.yml up -d

# Health check
curl http://localhost:5000/api/v1/health
```

### Admin Panel
```bash
npm run build
# Serve dist/ via Nginx or deploy to Vercel/Netlify
```

### Mobile Apps
```bash
# EAS Build
eas build --platform all
```

---

## Contributing

1. Branch from `main`
2. Follow the existing module structure
3. Keep controllers thin — logic in services
4. All API responses use `ApiResponse.*` helpers
5. Socket events documented in `socket.manager.js`

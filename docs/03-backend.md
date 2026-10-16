# 3. Backend & API Reference

Base URL: `/api/v1`. Responses use `{ success, message, data, timestamp }`. Auth: `Authorization: Bearer <accessToken>`; refresh via `/auth/refresh`.

## 3.1 Layout
`src/app.js` (Express + Socket.IO), `config/` (db, redis, env, secrets), `middlewares/` (auth, validation, rate limits, errors), `modules/<feature>/` (routes → controller → service → model), `sockets/`, `services/`, `utils/`.

## 3.2 Modules
admin (incl. rbac, audit log, dashboard, settings), ads, ai-booking, analytics, auth, branding, broadcasts, calls (masked calling), chat, corporate, dispatch, disputes, drivers, earnings, loyalty, maps, notifications, payments, pricing (incl. surge), privacy, promos, referrals, revenue, rides, safety (SOS), scheduled-rides, subscriptions, tracking, users, vehicles, wallet, zones.

## 3.3 Auth
| Endpoint | Purpose |
|---|---|
| `POST /auth/send-otp` `{phone}` | Send OTP (Twilio/MSG91). `DEMO_MODE=true` → OTP is `123456`, SMS skipped |
| `POST /auth/verify-otp` `{phone, otp, role, firstName?, lastName?}` | Login/signup; **`role` required** (`passenger`/`driver`); returns `{user, accessToken, refreshToken, sessionId, isNewUser}` |
| `POST /auth/social`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `GET /auth/sessions` | |
| `POST /auth/admin-login` `{email, password}` | Admin panel login |

## 3.4 Core endpoints
**Rides:** `POST /rides/estimate`, `POST /rides`, `GET /rides/active`, `GET /rides/history`, `GET /rides/:id`, `POST /rides/:id/accept` (driver), `POST /rides/:id/verify-pickup-otp`, `PATCH /rides/:id/status`, `GET /rides/:id/cancellation-fee`, `POST /rides/:id/cancel`, `POST /rides/:id/rate`, `POST /rides/:id/share`, `GET /rides/nearby-drivers`, `GET /rides/availability`.
**Drivers:** `GET/PATCH /drivers/me`, `PATCH /drivers/me/status`, `PATCH /drivers/me/location` (`{latitude, longitude}`), `GET /drivers/me/earnings`, `/me/rides`, documents upload endpoints, `POST /drivers/me/complete-onboarding`.
**Payments/Wallet:** `GET /payments/gateways`, `POST /payments/intent|pay|charge-card|charge-wallet|charge-external`, cards CRUD, `POST /payments/:id/refund` (admin), webhooks (`/payments/webhook`, `/payments/webhooks/:gateway`); `GET /wallet/balance|history`, `POST /wallet/topup`.
**Safety:** `POST /safety/sos`, `GET/DELETE /safety/sos/me`.
**Users:** `GET/PUT /users/me/saved-addresses`, emergency contacts, profile.
**Promos:** `POST /promos/validate`. **Subscriptions:** `/subscriptions/plans|my|subscribe|cancel`.
**Admin (`/admin/*`, admin role):** dashboard, analytics, users, drivers (approve/reject/suspend/…), rides, pricing, promos, documents & document-types, SOS, live rides/drivers, disputes, scheduled rides, admin-roles, zones, vehicle-categories, broadcasts, audit-log, referrals, corporate, payouts (`/payouts`, `/payouts/driver-earnings`, `/payouts/initiate`, approve/reject/retry), surge-zones/events, vehicles, settings.

## 3.5 Realtime (Socket.IO)
Rooms: `driver:<id>`, `passenger:<id>`, ride rooms, `admin:live`. Events: `driver:online`, `driver:location`, `ride:offer`, `ride:response`, `ride:accepted`, `ride:status`, `ride:otp_verified`, `ride:cancelled`, `ride:join|leave`, `chat:message|read`, `typing`, `call:*`, `sos:triggered|resolved`, `scheduled:*`, `dispatch:unassigned`, `dispute:resolved`, `heartbeat`.

## 3.6 Data model (Mongo collections)
users, drivers, vehicles, vehicle-categories, rides, payments, wallet transactions, driver earnings, payout requests, driver bank accounts, revenue ledger, pricing, surge zones/events, zones, promos, referrals, subscriptions & plans, notifications (+templates, logs), sos alerts, disputes, chat, call sessions, scheduled rides, documents & document types, admin roles, audit logs, settings/integration settings, corporate (accounts, employees, trips, invoices), loyalty, ads, broadcasts, branding, privacy exports, driver strikes, dispatch logs, AI booking sessions.
Key ride fields: `passenger`, `driver`, `status`, `pickup/dropoff {address, location(GeoJSON)}`, `rideType`, `fare{baseFare,distanceFare,timeFare,surge,discount,tax,total,platformFee,driverEarning,currency}`, `paymentMethod/Status`, `timeline{…}`, `pickupOtp`, `passengerRating/driverRating {rating, review, ratedAt}`.

## 3.7 Cross-cutting
Rate limiting on OTP/social/admin/webhooks; helmet/CORS; Winston logs; audit log on selected admin writes; encrypted integration secrets (`ENCRYPTION_KEY`); health at `/api/v1/health`; background crons (surge sweep 2 min, dashboard KPI emit 30 s, SOS escalation, calls cleanup).

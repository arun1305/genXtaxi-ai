# Multi-City — Implementation Status (backend phases 2–3)

Branch: `gen-taxi-backend` → **`feat/multi-city`** (not merged to `main`; nothing deployed).
Feature flag: `MULTI_CITY_ENABLED=true` (default off). Optional `MULTI_CITY_STRICT=true` refuses bookings outside every city.

## Decisions applied (from approved plan)
City = new `City` collection grouping existing `Zone`s · passenger visibility = riders with rides in the city (history limited to that city) · drivers = home city + optional Super-Admin-approved extra cities · pricing changes need approval by default (switchable per city).

## Implemented (with tests)
| Area | What |
|---|---|
| Models | `City`, `CityPricing` (immutable, effective-dated versions); `Ride.city/cityReview/fare.pricingVersionId`; `Driver.operatingCity/additionalCities`; `User.role='branch_manager'`, `assignedCities`, `registeredCity`; `Zone.city`; `AuditLog.city/actorRole` |
| Auth | `POST /auth/branch-manager-login` (role-isolated: BM cannot use `/auth/admin-login` and vice-versa); `authorize('admin')` rejects BMs on every existing admin route by default |
| Super Admin API (`/api/v1/admin/…`) | `cities` CRUD, `cities/:id/status` (draft/active/inactive, active requires a zone), `cities/:id/zones/:zoneId`, `cities/:id/analytics`, `analytics/cities` (comparison; totals = sum of rows), `cities/:id/pricing` (publish), `cities/:id/pricing-policy` (approval + per-field min/max), `city-pricing/pending|:id/approve|reject`, `branch-managers`, `cities/:id/branch-managers` |
| Branch Manager API (`/api/v1/branch-manager/…`) | `city, dashboard, passengers(+:id), drivers(+:id, approve, reject), rides(+:id), pricing (GET/PUT), reports, profile, change-password`. Scope comes only from the token's server-side `assignedCities`; header/query/body city can only **narrow** it, anything else → 403; out-of-scope records → 404 |
| Pricing engine | Resolution: platform default (`Pricing`) ← city override version in force at `now`. Final-fare recompute is **pinned** to the booked version. Flag off ⇒ byte-identical legacy fares (regression test) |
| Booking / dispatch | City resolved server-side from pickup polygon; draft/inactive city ⇒ `409 CITY_UNAVAILABLE`; `ride.city` set on normal, scheduled and manual-dispatch rides; dispatch and `acceptRide` enforce driver city eligibility (`403 DRIVER_OUT_OF_CITY`) |
| Migration | `scripts/migrate-multi-city.js` — dry-run default, `--apply`, `--rollback --apply`; idempotent; verifies record counts; ambiguous rides flagged `cityReview` |
| Audit | City/pricing/manager/driver-decision actions logged with actor role and city |

## Test results
- New: `tests/modules/cities/multi-city.test.js` — **19/19 pass** (isolation/IDOR, admin-route lockout, scope widening, role separation, city lifecycle, pricing limits/approval/effective dates/version pinning, driver eligibility, flag-off regression). A deliberate scoping mutation made 2 tests fail → they do detect leaks.
- Full backend suite: **1044 / 1045 pass**. The one failure (`calls.service … sweepExpiredSessions`) is pre-existing/flaky: it also fails on the untouched baseline and passes in isolation with these changes.
- Migration exercised on a local copy: dry-run → apply → re-apply (no-op) → rollback → re-apply; counts unchanged.

## Rollout
1. Deploy code with flag **off**. 2. `node scripts/migrate-multi-city.js` (dry-run) → `--apply`. 3. In Super Admin, create the zone polygon for the default city and attach it (`/cities/:id/zones/:zoneId`). 4. Set `MULTI_CITY_ENABLED=true`. Rollback: flag off → `--rollback --apply`.
Existing `Pricing` rows are intentionally **not copied**: they remain the platform default every city inherits, so current fares don't change until a city override exists.

## NOT done yet (do not treat as complete)
- **Phase 4** Super Admin UI (City Management, manager accounts, city analytics, pricing limits).
- **Phase 5** Branch Manager Panel (separate routes/layout in `gen-taxi-admin`).
- **Phase 6** Rider/driver app changes (city-unavailable messaging, driver city display).
- City-scoped realtime rooms, notifications and background-job alerts (BMs currently join no socket room, so they receive nothing rather than too much).
- Branch-manager support/complaints endpoint, exports (CSV/PDF), driver-document file access, city-level notification inbox.
- Extra-city driver assignment endpoints (model + eligibility logic exist; no admin API to create assignments yet).
- Real-production verification: `checkPermission` modules (`zones`, `pricing`, `analytics`, `admin_roles`) must be granted to the live Super Admin role; not checked against production data.

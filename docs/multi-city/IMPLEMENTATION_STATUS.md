# Multi-City — Implementation Status

Branches: `gen-taxi-backend` → **`feat/multi-city`**, `gen-taxi-admin` → **`feat/multi-city`** (neither merged to `main`; nothing deployed).
Flag: `MULTI_CITY_ENABLED=true` (default off). Optional `MULTI_CITY_STRICT=true` refuses bookings outside every city.

## Implemented and tested
**Backend (phases 2–3):** City + CityPricing (immutable effective-dated versions, approval, per-field limits); server-side city resolution on booking; city on normal/scheduled/manual rides; fare engine resolves city override at booking time and re-prices completed rides with the pinned version; dispatch + accept enforce driver city eligibility; `branch_manager` role with trusted `assignedCities`; `/api/v1/branch-manager/*` (dashboard, passengers, drivers + approve/reject + documents, rides, pricing, services, support, notifications/alerts, reports, activity, profile, change-password, CSV exports); Super Admin APIs (cities CRUD/status/analytics/comparison, boundaries, pricing governance + approvals, branch-manager accounts, driver city assignment); city-scoped socket rooms (`city:<id>`; BMs never join `admin:live`); SOS stamped with city; audit log with city/actor role; migration script (dry-run / apply / rollback, idempotent); single-city platforms auto-assign new users/drivers; driver can choose an active city at onboarding.

**Super Admin UI (phase 4):** City Management (list with live stats, search/filter/paginate, create/edit, activate/deactivate with confirmation, comparison, pricing-approval queue), city detail (boundary, pricing governance + limits + version history, branch managers, services + "allow manager to change services"), Branch Managers page.

**Branch Manager panel (phase 5)** at `/branch-manager/*`, separate token/login/layout: dashboard (14 KPIs, charts, date + service filters, recent rides/passengers, approval queue, alerts), passengers, drivers (review + documents + approve/reject), rides (filters, detail, fare breakdown), pricing (limit validation, preview, approval flow, history), services, support, reports, notifications (+ live pop-ups), profile/password/activity, CSV exports, light/dark theme, prominent "You are managing <city>" header.

## Test results
- Backend full suite: **72 suites / 1057 tests pass** (31 new multi-city tests; includes IDOR/scope-widening, role separation, RBAC interplay, pricing limits/approval/effective dates/version pinning, driver eligibility, exports, sockets, SOS, defaults).
- Frontend: `tsc` clean; vitest 66/66 (9 new).
- **Browser end-to-end (Playwright, real backend + Mongo, 2 seeded cities): 28/28 steps** — SA creates/activates a city, BM isolation on every page, API-level attacks (other-city id → 404, header/query/body city → 403, admin routes → 403), approval round-trip, empty-state for a new city. Screenshots in `screenshots/multi-city/`.
- Mutation check: removing the scope from two queries makes the isolation tests fail.
- Migration exercised on a local DB copy: dry-run → apply → re-apply → rollback → re-apply; counts unchanged.

## Bugs found & fixed along the way
1. `checkPermission` locked out every existing admin (no AdminRole) once roles exist → city routes use a lenient variant (legacy admins keep access; scoped roles are enforced).
2. Activation-failure left the confirm dialog stuck open.
3. **Pre-existing:** `rideId = GT + Date.now()` collided for two rides in the same millisecond (E11000) → added a random suffix (was also the cause of an intermittent disputes test failure).
4. Earlier-flaky `calls.service sweepExpiredSessions` test is unrelated and still intermittent.

## NOT done / needs attention before production
- **Rider & driver apps (phase 6):** not changed. The server already refuses bookings in draft/inactive cities with `409 CITY_UNAVAILABLE` and `422 OUT_OF_SERVICE_AREA`, and `DRIVER_OUT_OF_CITY`, but the apps show their generic error instead of a friendly "service unavailable in <city>" message, and the driver app has no city display or onboarding city picker UI.
- **Production checks not performed:** run the migration against a production copy; create real city boundary polygons; confirm `Pricing.zone`/currency behave for your live city; set `MULTI_CITY_ENABLED` only after migration.
- Not built: dispatch-time city selection UI in the Super Admin Dispatch page; interactive map boundary drawing (boundaries are entered as a box or pasted GeoJSON); PDF/Excel exports (CSV only); email/push notifications to managers (in-app + socket only); a Super-Admin-wide multi-currency revenue total (per-city figures only, deliberately not summed across currencies).
- Mobile/real-device behaviour, load testing and a security review by a second person have not been done.
- `gen-taxi-admin` has no ESLint config in the repo, so lint was not run.

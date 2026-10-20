# Multi-City — Implementation Status

Branches: `gen-taxi-backend`, `gen-taxi-admin` → **`feat/multi-city`**; `gen-taxi-frontend` (mobile) → **`feat/multi-city-apps`** (none merged; nothing deployed).
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

## Phase 6 — rider & driver apps (implemented)
- **Server (new):** `GET /cities/active` (minimal fields, auth) and `GET /cities/service-area?lat&lng`; `POST /rides/estimate` now refuses draft/inactive cities with `409 CITY_UNAVAILABLE` (previously only booking did); `GET /drivers/me` returns the home city; a failed socket accept now emits `ride:offer_rejected {code,message}` to the driver (it was only logged).
- **Rider app:** checks the pick-up against the service area; shows a "Service paused in <City>" / "We're not here yet" banner, hides ride types and disables booking; maps `CITY_UNAVAILABLE` / `OUT_OF_SERVICE_AREA` errors from estimate and booking into the same friendly message (new `utils/serviceArea.ts`, `hooks/useServiceArea.ts`). Fails open if the area check itself errors (the server still enforces).
- **Driver app:** home-city chip (shows "· paused" when the city is inactive); handles `ride:offer_rejected` (clears the stale offer and explains); onboarding city picker when several cities are active (required field), sent with `complete-onboarding`; a driver can never switch city themselves.
- **Verified on iOS simulators against a real multi-city backend:** rider sees the paused banner in New York and normal USD fares again after reactivation; driver home shows the "New York" chip; onboarding shows the London / New York picker. Screenshots: `screenshots/multi-city/30–33`.
- **Tests:** backend 1062/1062 (36 city tests); frontend `tsc` clean; 9 new util tests pass (run with a minimal babel-jest config — see below).

## NOT done / needs attention before production
- **Verified on the iOS simulator (follow-up):** onboarding "Please choose your city." validation (`33`/`34-driver-onboarding-city-required.png`) and the selected chip (`35-driver-onboarding-city-selected.png`). This exposed a bug (error stayed after choosing a city), now fixed.
- **Verified on the iOS simulators (second follow-up):**
  - Currency follows the city: a New York rider's profile/wallet shows `$0.00`, the same rider with the device GPS in London shows `£0.00`; the New York driver's home shows `$189.60` (`36`–`38-*.png`). Note: with no GPS fix the app falls back to its INR default by design.
  - Refused ride (`DRIVER_OUT_OF_CITY`): a New York ride was offered, the driver's operating city was switched to London while the offer was on screen, and Accept was tapped. The server refused (`You are not authorised to serve this city`) and the driver sees "Ride is outside your area" (`39`), then stays on Home, online (`40`).
  - **Bug found and fixed while doing this:** the driver app accepted optimistically over the socket (persisted the ride and opened the trip screen before the server answered), so a refused accept left the driver stranded on a phantom trip. Accept now uses `POST /rides/:id/accept` and navigates only on success. Normal accept re-verified (`41`).
- **Android (driver, emulator `gentaxi_driver`, debug build against the local multi-city backend):** login, New York chip, `$` earnings (`42`), `$8.64` offer (`43`), and the same refused-accept alert then staying on Home (`44`) all work. Required `adb reverse tcp:5002 tcp:5002` (the app otherwise shows "Failed to send OTP"). The old install on the AVD was signed with a different key and had to be uninstalled first.
- **Still not exercised:** the rider app on Android; release (non-debug) Android builds; the AI Booking refusal copy end to end (unit-level only).
- **Currency:** hard-coded `₹` removed from rider/driver screens; amounts now follow the city/fare currency via `store/currencyStore.ts` + `utils/money.ts` (default INR). Remaining `₹` is dev-only mock data in `paymentSlice.ts`. AI Booking now shows the service-area copy when a refusal carries a city code (not exercised end to end).
- **Existing frontend jest setup is broken on this machine** (`jest-expo` preset fails to transform on Node 22 — the pre-existing `geo.test.ts` fails identically); the new `serviceArea` tests pass with `jest --config` using `babel-preset-expo` directly.
- **Simulator quirk (not product code):** the dev launcher crashed once from a corrupted `expo.devlauncher.recentlyopenedapps` preference after a state reset.

- **Production checks not performed:** run the migration against a production copy; create real city boundary polygons; confirm `Pricing.zone`/currency behave for your live city; set `MULTI_CITY_ENABLED` only after migration.
- Not built: dispatch-time city selection UI in the Super Admin Dispatch page; interactive map boundary drawing (boundaries are entered as a box or pasted GeoJSON); PDF/Excel exports (CSV only); email/push notifications to managers (in-app + socket only); a Super-Admin-wide multi-currency revenue total (per-city figures only, deliberately not summed across currencies).
- Mobile/real-device behaviour, load testing and a security review by a second person have not been done.
- `gen-taxi-admin` has no ESLint config in the repo, so lint was not run.


## End-to-end verification run (2026-10-20)
Method: fresh database + an isolated backend (strict mode), driven only through the real API with live driver sockets — Super Admin creates cities/zones/managers, managers set pricing, riders and drivers in two cities ride end to end, managers are probed for isolation, a city is paused and reactivated. Plus the 28-step Playwright UI suite (Super Admin + Branch Manager panels).

**Result: 183/183 API checks, 5/5 lenient-mode checks, 28/28 UI steps; backend jest 73 suites / 1077 tests; admin unit tests 9/9.**

Covered: city create/activate (zone required, duplicate code, status injection), manager creation and every auth boundary (BM vs admin routes, wrong role, no token), service-area/estimate/booking gating (outside area, draft city), server-side city stamping (client-supplied city ignored), pricing governance (limits, unknown fields, approval, pending never applies, future-dated, rejected, tightened limits re-checked at approval, per-city isolation, historical fares unchanged), dispatch eligibility (home city, approved extra city, suspended/expired/future windows), full ride lifecycle in both cities, traveller account (one rider, two cities, each manager sees only their city's rides), IDOR/scope-widening attempts, exports, driver approval scope, services permission, audit rows, city socket rooms (ride_new / cancelled / driver_pending / sos), SOS scoping, scheduled rides, pause with in-flight rides, reactivation, manager reassignment/multi-city/deactivation/password change, per-city analytics vs DB.

**Logical issues found and fixed** (regression tests in `tests/modules/cities/multi-city-e2e-regressions.test.js`, 9 of them fail without the fixes):
1. Pricing: a backdated `effectiveFrom` silently lost to older versions; a proposal that sat pending could go live retroactively. Now clamped to now / approval time.
2. Auth (pre-existing, affects every role): block / suspend / ban / deactivate never invalidated the 5-minute cached user, so a revoked account — a branch manager included — kept working. Cache is now dropped immediately.
3. Scheduled rides skipped the city gate: could be scheduled in a paused/unserved city and were dispatched into a paused city when due. Now gated at scheduling time; a ride due while its city is paused is cancelled with no fee.
4. Lenient mode: a ride outside every city had no city and no review flag (invisible to all managers). Now flagged `cityReview:true` for Super Admin.
5. Branch-manager dashboard/reports summed fares across currencies for multi-currency managers. Now per currency (`money.byCurrency`, `row.currency`; UI shows one figure per currency).

**Not changed / for your decision**
- `MULTI_CITY_STRICT` is off by default: with it off an out-of-area pickup is still served (flagged for review). Turn it on once your boundaries are real.
- A later-created version with an earlier go-live loses to a version already scheduled for the future (latest effective date wins, by design).
- Pre-existing, outside this feature: `PATCH /rides/:id/status` does not check that the caller is the ride's driver/rider.
- Rider/driver mobile flows were verified earlier on iOS/Android (see above); this run exercised the same backend paths through the API, not the apps again.

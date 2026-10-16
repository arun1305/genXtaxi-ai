# Multi-City + Branch Manager — Audit & Implementation Plan

Status: **PLAN — no code changed yet.** Date: 2026-10-16.

## 1. What exists today (audit)

| Area | Finding | Consequence |
|---|---|---|
| Data store | MongoDB/Mongoose (not SQL) | "Foreign keys/migrations" = ObjectId refs, indexes, idempotent scripts in `scripts/` |
| **Operational `Zone`** (`modules/zones/zone.model.js`) | Already has `cityCode`, polygon `geometry`, `currency`, `language`, `timezone`, `servicesEnabled[]`, `fareConfig`, `active`, and `findContaining(lng,lat)`. Unique on `(cityCode,name)` → a "city" can be several zones. **Rides, drivers and users do not reference it** (driver has a free-text `serviceZone:'default'`). | Reuse it as the geographic building block; do not invent a parallel boundary model |
| Rides | No city/zone field. Fare breakdown (base/distance/time/surge/peak/min-fare/tax/total) *is* stored per ride, plus `configVersion` (a number only) | Historical fares are already preserved as a breakdown; the *config* behind a version is not retained |
| Pricing | `Pricing` keyed by `(rideType, zone:String='default')`; edited in place via `upsertPricing`; **no history, no effective dates, no approval** | Needs versioned, effective-dated records |
| Auth / roles | `User.role ∈ {passenger,driver,admin}`; admin RBAC = `AdminRole` (module × action, optional amount cap) via `checkPermission`; **no city scope**. All `/admin/*` is `authenticate + authorize('admin')` (≈1,500 lines of routes, hundreds of unscoped queries) | Retrofitting scope into every admin query is the riskiest path |
| Realtime | Admin events go to one `admin:live` room | Needs per-city rooms |
| Audit | `AuditLog` exists (before/after, admin, entity) | Extend with city + role |
| Tests | Jest, `tests/modules/*` | Add `tests/modules/cities`, `branch-manager`, `security` cases |
| Recent changes | Surge rework (mandatory polygons, quotes), minimum-fare/peak itemisation just landed | Pricing work must build on these, not around them |

## 2. Target architecture

**City** (new collection) = the authoritative operating unit: `name, code (unique), country, state, timezone, currency, callingCode, center, status (draft|active|inactive), launchDate, servicesEnabled, pricingPolicy{ approvalRequired, limits{…} }, branchManagers…`. Existing `Zone` documents gain `city: ObjectId`, back-filled from `cityCode`. A city's boundary = union of its zones.

**Ride.city** (ObjectId, indexed) is set **server-side at booking** from `Zone.findContaining(pickup)` → its city; the client never supplies it. It is immutable for the life of the ride; fare and dispatch use it.

**Passenger ownership ≠ ride location.** `User` stays one global account. Add `registeredCity` (informational, set at signup, never auto-changed). A Branch Manager's passenger access is *derived*: passengers with ≥1 ride in the manager's city (plus registered there), and the ride history they see is **only rides in that city**. No cross-city history, no duplicate accounts.

**Drivers:** `Driver.operatingCity` (required) plus optional `additionalCities[]` approved by Super Admin (assignment records with effective dates). Dispatch only offers rides whose `city` is in the driver's active assignments; the ride's own city drives pricing.

**Roles:** new `User.role = 'branch_manager'` (so `authorize('admin')` rejects it by default — secure-by-default) with `assignedCities[]` stored server-side and a managed permission set. **Separate router `/api/v1/branch-manager/*`** over a scoped service layer where every query is forced through `cityScope(req.user)`; request-supplied `cityId` is never trusted. The Super Admin keeps the existing admin routes unchanged.

**Pricing governance:** `CityPricing` versions: `{city, rideType, fields…, effectiveFrom, effectiveUntil, version, status(pending|active|superseded|rejected), createdBy, approvedBy}`. Resolution order: platform default → city override → ride-type → time/surge rules, evaluated **as of the booking time** (so future-dated changes don't apply early). Super Admin sets per-field min/max limits and whether approval is required; branch edits are validated server-side against those. Each ride stores `pricingVersionId` plus its existing breakdown; completed rides are never recalculated.

**Isolation checklist:** lists, details, search, pagination, exports, reports, documents, notifications, sockets (`city:<id>` rooms), background jobs, and ride-history lookups all take the scope from the token's server-side assignment.

## 3. Permission matrix (summary)

| Capability | Super Admin | Branch Manager |
|---|---|---|
| Create/edit/(de)activate cities, assign managers | ✔ | ✘ |
| Platform defaults, commission limits, tax, pricing limits, approval policy | ✔ | ✘ |
| City pricing | ✔ (any city) | ✔ own city, within limits; approval if enabled |
| Passengers / drivers / rides | all cities | own city only |
| Driver approval / activation | ✔ | own city |
| Financial reports | platform-wide | own city, per permission |
| Audit log | all | own activity |
| Other managers / super-admin accounts | ✔ | ✘ |

## 4. Phases

1. **Audit** — this document.
2. **Data model & migration** — `City`, `CityPricing`, `Ride.city`, `Driver` assignments, `User.registeredCity`, indexes; idempotent back-fill with a default city from the existing operating zone; ambiguous rides flagged (`cityReview:true`), never guessed; dry-run + counts + rollback script.
3. **Backend & authorization** — cityScope middleware, branch-manager routes, city admin APIs, pricing engine resolution + limits/approval, audit, socket rooms, city status handling (booking block, safe handling of active rides).
4. **Super Admin UI** — City Management, branch-manager accounts, city analytics/comparison, pricing limits.
5. **Branch Manager panel** — separate routes/layout in `gen-taxi-admin`: dashboard, passengers, drivers, rides, pricing, services, reports, notifications, profile.
6. **Rider & driver apps** — city resolved by the server from location; "service unavailable" states; driver city rules.
7. **Tests & release** — Jest suites (access/IDOR, pricing, migration, regression), runbook, rollback.

Each phase is verified (tests + manual) before the next starts. Phases 2–3 (backend) come first, per your recommendation.

## 5. Risks

- Existing `/admin/*` routes stay unscoped by design; mitigated by keeping branch managers off them entirely.
- `Pricing.zone` is a string; migrating to city-aware resolution must keep the `'default'` fallback so current fares are byte-identical (regression test required).
- Back-filling historical rides from pickup coordinates may mis-assign edge cases → flagged, not forced.
- Surge zones are independent of cities today; a city's surge is still resolved by polygon, with city currency/timezone.
- Production deploy needs migration run **before** the new code path is enabled (feature flag `MULTI_CITY_ENABLED`).

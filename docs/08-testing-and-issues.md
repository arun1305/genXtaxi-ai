# 8. Testing & Known Issues

## 8.1 Automated
Backend: Jest (`npm test`). AI platform: 43 Node + 15 Python tests plus the `ai-eval` golden-set gate. Demand service: `pytest` (surge engine, baseline, bbox).

## 8.2 End-to-end run (Oct 2026)
A full local run drove the rider app, driver app and admin panel (iOS simulators + Chrome) with US test data (rider Daniel Carter, driver Michael Anderson, NYC routes, 30+ rides). Screenshots and the per-feature coverage table are in `screenshots/e2e/` (`REPORT.md`).
Verified end to end: signup, booking with promo, dispatch/accept, OTP, trip lifecycle, fare/earnings, ratings, history/receipts, cancel with fee, SOS → admin triage, surge zone → rider banner, payouts, admin dashboards/lists/settings, audit log.

## 8.3 Fixed during testing (committed Oct 2026)
Audit log page empty; USD/INR default mismatch; stale/hardcoded profile stats; rating stars; map fallback city; duplicate SOS and 0,0 location; payout period timezone bug; fake dev notifications; OTP keyboard hiding Verify; demand heatmap 422; vector-search empty-result fallback.

## 8.4 Open issues / not done
- Mobile screens hard-code `₹` (no real multi-currency).
- Wallet top-up failure shows no error to the user; SOS confirmation claims contacts were notified even with none.
- Gateway returns HTTP 200 for upstream 422 on demand proxy.
- Driver "Online hrs" does not accumulate.
- Atlas vector index and production knowledge base still to be created/published.
- Admin has no UI for roles, broadcasts, zones, loyalty, corporate.
- ride-offer window (~3 s modal on some flows) is easy to miss; consider longer countdown.

## 8.5 Not tested
Splash/onboarding, driver registration with document upload, driver decline/cancel, in-app card payment screen, sign-out, chat/calls, push notifications, AI assistant/My Feedback/admin AI pages against a live AI stack, real payment gateways.

# 2. Product & Feature Guide

## 2.1 Rider app
Authentication (phone + OTP, social login), profile registration, home map, destination/pickup search (Google Places), ride types with fare estimate and ETA, promo codes, payment method selection, ride request and live search, driver assignment (name, rating, vehicle, plate, pickup OTP), live tracking, share trip, SOS (hold 2 s), cancel with fee notice, trip completion with fare breakdown, rating + tags + review, ride history and receipts, wallet (balance, top-up, history), saved addresses, emergency contacts, notification preferences, help & support, terms/privacy, AI booking assistant, AI support chat, dark mode, pool/scheduled booking entry points.

## 2.2 Driver app
Phone/OTP login, onboarding and document upload, vehicle info (admin-managed), online/offline toggle, live ride offers (accept/decline with countdown), navigation to pickup, "arrived", OTP verification, start trip, in-trip navigation, complete trip with earnings breakdown, rate passenger, ride history, earnings (today/week/month/all with trip breakdown), wallet and withdrawals, scheduled availability, subscription plans (fixed fee vs commission), notifications, help & support, My Feedback (AI review insights), AI assistant.

## 2.3 Admin panel
Dashboard, analytics, live map (rides, drivers, SOS), dispatch (manual bookings), rides, users, drivers (approval/suspend/documents), vehicles, payouts, settings (provider integrations), audit log, ride types, document requirements, subscriptions, pricing, surge zones, promos/referrals, platform and branding pages, and AI pages (cost, currencies, knowledge base, handoff inbox, review insights, surge, AI ops). Details in doc 5.

## 2.4 Ride lifecycle
1. **Estimate** (`POST /rides/estimate`) → fare from distance/time/ride type/surge/promo.
2. **Request** (`POST /rides`) → status `searching`; pickup OTP generated.
3. **Dispatch** → nearest eligible driver gets `ride:offer`; decline/timeout → next driver/wider radius; none → `no_driver`.
4. **Accept** → `accepted`; rider sees driver + OTP.
5. **Arrived** → `driver_arrived`; driver verifies OTP (`/rides/:id/verify-pickup-otp`).
6. **Start** → `in_progress`.
7. **Complete** → `completed`; fare finalised, driver earning + revenue ledger written, payment status `paid` (cash) or `pending` (card/wallet until settled).
8. **Rate** (both sides). Cancellation allowed before start (fee tiers: grace / en-route / after-arrived).

Allowed transitions: `accepted→driver_arrived|cancelled`, `driver_arrived→in_progress|cancelled`, `in_progress→completed`.

## 2.5 Money
Fare = base + distance + time (+ surge, night surcharge, booking fee, stops) − discount, plus tax; platform fee (default 20 %) and driver share (80 %) come from the pricing config, versioned per ride. Driver subscriptions replace commission with a fixed fee. The app UI renders amounts in **₹ (INR)**; backend defaults were aligned to INR in Oct 2026. Multi-currency display is **not** implemented in the apps (symbol is hard-coded).

## 2.6 Safety
SOS creates an alert (deduplicated per user), tracking link, SMS to emergency contacts, admin live-map alert; admins triage and resolve with notes; unresolved alerts escalate after 5 min.

# 5. Admin Panel

React + Vite + Tailwind. Env: `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_MAP_DEFAULT_LAT/LNG`, AI service URLs (`VITE_AI_GATEWAY_URL`, `VITE_CURRENCY_SERVICE_URL`, `VITE_CHAT_ORCHESTRATOR_URL`, `VITE_INSIGHTS_SERVICE_URL`, `VITE_DEMAND_SERVICE_URL`). Run: `npm run dev` (port 5173). Seed an admin with `node scripts/seedAdmin.js` in the backend (**change the default password immediately**).

| Route | What it manages |
|---|---|
| `/dashboard` | KPIs (active rides, online drivers, revenue today, SOS, pending approvals), charts |
| `/analytics` | Overview, driver league, retention, exportable reports (CSV/PDF) |
| `/live-map` | Active rides, drivers, SOS alerts with triage/resolve |
| `/dispatch` | Manual (phone/walk-in) bookings, online drivers |
| `/rides` | All rides, filters, ride details, live monitor, scheduled |
| `/users`, `/drivers` | Lists, detail drawers, block/suspend/ban, driver approval, documents, audit trail |
| `/vehicles` | Fleet CRUD, verify, assign to driver |
| `/payouts` | Driver earnings, payout requests, transaction history, pay |
| `/pricing`, `/pricing/surge-zones` | Per-ride-type fares and commission; geofenced surge zones, live monitor, events |
| `/promos` | Promo codes and referral programme |
| `/subscriptions` | Driver plans and subscribers |
| `/ride-types`, `/document-types` | Categories; required driver documents |
| `/settings` | Dispatch radius; Maps, Payments, SMS, Email, Push, Call masking, Storage, Analytics integrations (secrets encrypted) |
| `/audit-log` | Append-only admin action log |
| `/platform`, `/branding` | Marketing/branding pages |
| `/ai/*` | cost, currencies, knowledge base, handoff inbox, review insights, surge, AI ops |

RBAC: admin roles are managed via `/admin/admin-roles` (no dedicated UI page).

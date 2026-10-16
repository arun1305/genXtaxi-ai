# 4. Mobile Apps (Expo / React Native)

## 4.1 Structure
`App.tsx`, `app.config.js` (variant → bundle IDs `com.gentaxi.passenger` / `com.gentaxi.driver`), `src/navigation/RootNavigator.tsx`, `src/screens/{auth,onboarding,passenger,driver,ride,payment,settings,shared,sos,chat,notifications}`, `src/store` (Zustand stores + Redux slices), `src/services/api/*` (axios client with token refresh), `socket.service.ts`, `src/i18n` (custom engine: `{t, locale, isRTL}`; FR/AR/EN), `src/theme`.

## 4.2 Configuration (`.env`, `EXPO_PUBLIC_*`)
`API_URL`, `GOOGLE_MAPS_KEY`, `STRIPE_PUBLISHABLE_KEY`, `ENABLE_AI_BOOKING`, `AI_GATEWAY_URL`, `CHAT_ORCHESTRATOR_URL`, `INSIGHTS_URL`, optional `DEFAULT_LAT/LNG` (fallback map centre), `MOCK_NOTIFICATIONS=1` (dev-only fake notifications).

## 4.3 Run in development
```
cd gen-taxi-frontend
EXPO_PUBLIC_API_URL=http://localhost:5001/api/v1 APP_VARIANT=passenger npx expo start --dev-client --port 8082
EXPO_PUBLIC_API_URL=http://localhost:5001/api/v1 APP_VARIANT=driver    npx expo start --dev-client --port 8081
```
Use the installed dev clients (iOS simulator / Android) and pick the Metro URL.

## 4.4 Build & release
- Android APK (local EAS, ~2–5 min each):
  `APP_VARIANT=driver EAS_NO_VCS=1 npx eas-cli build --local -p android --profile preview-driver --output ./gentaxi-driver-latest.apk --non-interactive` (and `passenger` / `preview-passenger`). Needs Java 17+, `ANDROID_HOME`.
- OTA updates: publish to branches **`preview-driver`** and **`preview-passenger`** (not `main`); double-restart the app to apply.
- Hermes limitation: no `AbortController` or regex `s` flag — avoid them in client code.
- Screenshots/automation: Maestro flows in `.maestro/`.

## 4.5 Notable behaviours
Pickup defaults to current GPS; dev builds may read `Documents/dev_user.json` to bypass login (driver, `__DEV__` only); SOS needs a GPS fix (falls back to last-known); notification screen uses the real API unless mock flag set.

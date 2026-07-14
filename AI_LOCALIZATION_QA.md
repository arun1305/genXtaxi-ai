# AI Localization QA (spec §5)

Scope: all AI-facing copy across the four features, in **French, Arabic (RTL),
English**, with correct RTL layout mirroring.

## Model-generated copy (runtime)
- Every system prompt instructs: *"Respond in the user's language; for Arabic use
  MSA and format for RTL."* — chatbot (`chat-orchestrator` system prompt), aspect
  extraction + summaries (`insights-service`), verified in code.
- Language is detected/persisted per user (`preferred_lang`) and passed through as
  `lang` to the gateway and summaries; per-language driver summaries are cached
  separately (spec §3.7).
- **Live-verified:** the eval harness FAQ suite passed 4/4 including a French and an
  **Arabic** question answered in-language by the real model.

## Static UI copy (translation keys)
Added FR/AR/EN keys for the new AI surfaces:
- `support.*` (chatbot screen): whereDriver, explainCharge, cancelRide, error,
  declined, confirmed, escalated, talkToHuman, placeholder, send.
- `feedback.*` (driver dashboard): notEnough, title, overall, strengths, improve,
  aspects, updated.
- Surge indicator reuses the existing `surge.explanation` key (already FR/AR/EN).
Files: `gen-taxi-frontend/src/i18n/locales/{en,fr,ar}.ts`.

The custom i18n `t(key, fallback?)` now accepts a string fallback (English) so a
missing key degrades gracefully instead of showing a raw key path.

## RTL layout (Arabic)
- Chatbot bubbles/chips/input flip via `isRTL` (bubble `alignSelf`, input
  `flexDirection: row-reverse`, `textAlign`, `writingDirection`).
- Driver feedback + reputation chips set `writingDirection` per `isRTL`.
- KB manager (admin) sets `dir="rtl"` on the Arabic document textarea.
- Money is formatted with `Intl.NumberFormat(locale, { style:'currency', currency })`
  (spec §1) — respects locale grouping/RTL.

## Sign-off checklist (native reviewer)
- [ ] FR: all `support.*` / `feedback.*` strings read naturally (not literal MT).
- [ ] AR: MSA, correct diacritics-free forms; RTL punctuation.
- [ ] AR: chatbot, feedback, and surge screens mirror correctly on device.
- [ ] Currency formats correct per locale (DZD/EUR/XOF grouping + symbol position).
- [ ] Model replies stay in the user's language across all four features.
- [ ] No hardcoded English leaked (run: `grep -rn "t('" src | ...` audit).

# PACK 191 — Payments v2 AI flow

## Scope

This pack updates the Payments page after the Goals and Limits consolidation.

## Changes

- `/payments` and legacy `/obligations` now render the same Payments page.
- Payments page keeps tabs:
  - Credit
  - Installment
  - Subscriptions
  - Other
- Mortgage remains grouped under Credit.
- New and edit flows open the Fina chat overlay instead of local forms.
- Payment cards show monthly payment, due date, paid amount, remaining debt and progress where applicable.
- Subscriptions include recurring payments from obligation summary when available.
- Payments CSS is split into logical fragments.
- Added missing reports CSS placeholder because the current archive imported it from the global manifest.
- Added RU/EN i18n strings for the new Payments layout and Fina commands.

## Files

- frontend/src/app/router/AppRouter.tsx
- frontend/src/pages/payments/PaymentsPage.tsx
- frontend/src/app/styles/pages/payments/payments.css
- frontend/src/app/styles/pages/payments/payments/payments-shell.css
- frontend/src/app/styles/pages/payments/payments/payments-cards.css
- frontend/src/app/styles/pages/payments/payments/payments-lists.css
- frontend/src/app/styles/pages/reports/reports.css
- frontend/src/shared/lib/i18n/locales/ru/misc.ts
- frontend/src/shared/lib/i18n/locales/en/misc.ts

## Checks

- npm run audit:css: passed
- npm run audit:predeploy:strict: passed
- npm run build: not runnable in the sandbox because node_modules are absent

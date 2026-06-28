# PACK 214 — Referral and accounts density polish

Scope:
- Referral page density aligned with the analytics page rhythm.
- Accounts page hero, summary, actions and cards made more compact.
- Account details sheet redesigned into compact analytics-style rows.
- Raw backend/constraint deletion errors are not shown directly in the account sheet.
- Page-specific accounts/referral CSS imports moved after shared density files so these screens are not overwritten by common CSS.

Changed files:
- frontend/src/app/styles/index.css
- frontend/src/app/styles/pages/referral/referral.css
- frontend/src/app/styles/pages/accounts/accounts/accounts-shell.css
- frontend/src/app/styles/pages/accounts/accounts/accounts-summary.css
- frontend/src/app/styles/pages/accounts/accounts/accounts-actions.css
- frontend/src/app/styles/pages/accounts/accounts/accounts-cards.css
- frontend/src/app/styles/pages/accounts/account-details-sheet.css
- frontend/src/features/accounts/ui/AccountDetailsSheet.tsx
- frontend/src/shared/lib/i18n/locales/ru/accounts.ts
- frontend/src/shared/lib/i18n/locales/en/accounts.ts

Checks run in sandbox:
- npm run audit:css — Problems: 0
- npm run audit:predeploy:strict — CSS structure findings: 0
- npm run audit:product-readiness — passed
- backend npm run audit:final — Problems: 0

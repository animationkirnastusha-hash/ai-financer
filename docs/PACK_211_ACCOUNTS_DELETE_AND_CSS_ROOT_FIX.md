# PACK 211 — Accounts delete and CSS root fix

## Scope

- Account deletion lifecycle.
- Accounts page CSS cascade cleanup.
- Account details delete confirmation inside the sheet instead of native browser confirm.

## Backend

`backend/src/modules/accounts/service.ts`

- Account deletion now also clears `FinancialCycleSettings.salaryAccountId` when the deleted account was selected as salary account.
- Existing cleanup for goals, loans, receipt scans, recurring payment payments, AI defaults, limits, recurring payments and linked transactions is kept.

## Frontend logic

`frontend/src/features/accounts/ui/AccountDetailsSheet.tsx`

- Removed `window.confirm` from account deletion.
- Added inline two-step delete confirmation inside the account sheet.
- Added visible delete error state.

`frontend/src/features/modals/ui/AccountModals.tsx`

- If the deleted account was selected as primary/income default in local settings, the setting is cleared immediately.

`frontend/src/shared/lib/i18n/locales/ru/accounts.ts`
`frontend/src/shared/lib/i18n/locales/en/accounts.ts`

- Added delete confirmation copy through dictionaries.

## CSS

`frontend/src/app/styles/pages/accounts/accounts.css`

- Converted to a page manifest.

New logical fragments:

- `frontend/src/app/styles/pages/accounts/accounts/accounts-shell.css`
- `frontend/src/app/styles/pages/accounts/accounts/accounts-summary.css`
- `frontend/src/app/styles/pages/accounts/accounts/accounts-actions.css`
- `frontend/src/app/styles/pages/accounts/accounts/accounts-cards.css`

Account-related rules were removed from shared areas that were overriding the accounts page:

- `frontend/src/app/styles/pages/shared-product-screens/accounts-taxonomy.css`
- `frontend/src/app/styles/pages/shared-product-screens/accounts-taxonomy-cards.css`
- `frontend/src/app/styles/pages/shared-product-screens/responsive.css`
- `frontend/src/app/styles/layout/mobile-adaptive/mobile-adaptive-cards.css`

Account delete confirmation styles were added to:

- `frontend/src/app/styles/pages/accounts/account-details-sheet.css`

This removes the cascade conflict where shared product/mobile styles were overriding the accounts page after `accounts.css` was imported.

## Checks run in sandbox

- `npm run audit:css` — Problems: 0
- `npm run audit:predeploy:strict` — CSS structure findings: 0
- TypeScript parser diagnostics for changed TS/TSX files: 0

Full `npm run build` was not run in the sandbox because the unpacked archive does not include `node_modules`.

# PACK 216 — Account delete backend cleanup

## Scope

Root backend fix for account deletion when linked rows still reference the account.

## Changes

- Account delete cleanup no longer filters direct foreign-key cleanup by `userId`.
- The service still verifies that the account belongs to the current user before cleanup.
- Direct dependent rows are cleaned by `accountId`, because stale/corrupt rows with a mismatched `userId` can still block the foreign key and break deletion.
- Transfer balance compensation remains owner-scoped and only runs for transactions owned by the current user.
- User-facing delete error text no longer says that links were already cleaned automatically.
- Added smoke test for deleting an account with expense and transfer links.

## Files

- `backend/src/modules/accounts/account-delete-cleanup.ts`
- `backend/src/modules/accounts/service.ts`
- `backend/src/modules/ai/ai-executor.service.ts`
- `backend/scripts/smoke/check-account-delete-cleanup.mjs`
- `backend/package.json`
- `frontend/src/shared/lib/i18n/locales/ru/accounts.ts`
- `frontend/src/shared/lib/i18n/locales/en/accounts.ts`

## Check

```bash
cd /root/ai-financer/backend
npm run build
npm run audit:final
npm run test:account-delete-cleanup
```

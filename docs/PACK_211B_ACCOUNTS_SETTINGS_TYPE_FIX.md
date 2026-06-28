# PACK 211B — Accounts settings type fix

## Scope

Build fix for pack 211.

## Changed

- `frontend/src/features/modals/ui/AccountModals.tsx`

## Reason

`setPrimaryAccountId` and `setIncomeAccountId` are settings actions that accept `string | null`.
Pack 211 cleaned these settings after account deletion by passing `null`, but the local prop type in `AccountModals.tsx` still allowed only `string`.

## Result

- Account deletion cleanup keeps working.
- TypeScript build no longer fails on `null` passed to account settings actions.

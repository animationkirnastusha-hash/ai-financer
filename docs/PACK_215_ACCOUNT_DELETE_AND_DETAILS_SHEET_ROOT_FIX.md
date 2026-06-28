# PACK 215 — account delete and account details sheet root fix

## Scope

- Account deletion must work for accounts that already have transactions, transfers, limits, recurring payments, goals, loans, receipt scans and default-account settings.
- Account details sheet must not render the old balance strip that overlaps the type/currency tiles.
- User-facing delete error must not tell the user to refresh the page.

## Backend

- Added `cleanupAccountsBeforeDelete` as a shared account deletion cleanup routine.
- Manual account deletion and AI account deletion now use the same cleanup path.
- Before deleting an account, backend detaches or removes linked data in a controlled order:
  - AI default accounts,
  - salary cycle account,
  - goals,
  - loans and loan payments,
  - recurring payment payments,
  - receipt scans,
  - linked transaction references,
  - account transactions and transfer links,
  - spending limits,
  - recurring payments.
- Final account deletion uses scoped `deleteMany` by `userId + accountId`.

## Frontend

- Removed the standalone balance card from the account details sheet.
- Balance is now shown inline in the sheet header together with account type and currency.
- Account badges are shown as a small status row instead of inside the removed panel.
- Delete error text now says to retry, not to refresh the page.

# PACK 218 — Home payments and goal completion

## Scope

Completes the home planning widgets after pack 217.

## Changes

- Home nearest payments now uses the full obligations summary, not only loans.
- Recurring payments/subscriptions from the payments module can now appear on the home screen.
- The nearest item is selected from active loans and active recurring payments by nearest date/days.
- The home payment widget shows payment count, type, period for recurring payments, account, date and amount.
- Debt progress remains only for credits/mortgages/installments where a real debt remainder exists.
- Goal widget keeps the compact ring placement; when it is the only planning widget it stays small instead of stretching into a large full-width card.
- Added missing RU/EN dictionary keys for new payment labels.

## Checks

- frontend audit:css — Problems: 0
- frontend audit:predeploy:strict — CSS structure findings: 0
- frontend audit:product-readiness — passed
- backend audit:final — Problems: 0

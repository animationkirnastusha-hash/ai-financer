# Backend integrity tests

This suite checks backend execution contracts without depending on the external AI model.

It creates structured pending actions directly in the database, confirms them through the public API, and verifies that accounts, transactions, goals, sections and categories really changed.

It does not parse financial user text. It only verifies already-structured tool contracts.

## Run

```bash
cd /root/ai-financer/backend

TEST_BASE_URL="http://localhost:3000/api" \
TEST_HEALTH_URL="http://localhost:3000/health" \
TEST_TELEGRAM_ID=516730814 \
TEST_ADMIN=1 \
npm run test:backend-integrity
```

## Full base verification

```bash
npm run test:base-full
```

This runs:

1. `test:backend-integrity` — confirms backend executor/pending lifecycle without the AI provider.
2. `test:base-ai` — black-box natural-language AI regression through the normal AI endpoint.

## What it checks

- token/auth contract;
- finance reset;
- static guard against financial command-parser patterns in the AI module;
- pending confirm creates account;
- pending confirm updates account;
- pending confirm creates expense and applies balance effect;
- pending confirm creates income, then edits it without duplicate transaction;
- pending confirm creates transfer and moves balances;
- pending confirm creates goal;
- pending confirm creates section and category;
- pending cancel does not mutate state.

If `test:backend-integrity` passes but `test:base-ai` fails, the executor/confirm backend path is probably healthy and the problem is in planner/validator/provider behavior.

If `test:backend-integrity` fails, fix backend lifecycle before testing natural-language AI.

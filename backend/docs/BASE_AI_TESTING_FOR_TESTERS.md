# Backend base AI testing for testers

Run this from the backend folder after deployment:

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

The test runner creates or reuses a test user, creates a JWT automatically, then checks the base product endpoints and AI actions.

Reports are saved to:

```text
test-results/base-ai-regression-*.md
test-results/base-ai-regression-*.json
```

## What must pass before Premium work

- auth
- read endpoints
- accounts
- sections/categories
- transactions
- goals
- budgets
- recurring payments
- settings/onboarding/progression/referral/analytics
- notifications
- admin dashboard endpoints
- AI account lifecycle
- AI transaction lifecycle
- AI edit last income without duplicate
- AI transfer
- AI goals lifecycle
- AI taxonomy lifecycle
- AI cancel without mutation
- AI 4+ action base limit

## Notes

This suite is a black-box API test. It does not implement financial parsers and does not extract amount/account/category from natural language. It only sends commands to the backend and verifies API state.

Use destructive checks only on a disposable database:

```bash
TEST_DESTRUCTIVE=1 npm run test:base-ai
```


### Patch 65

The console suite uses an explicit account-create command for the AI account test: account type, currency and balance are included so the test checks backend capability rather than a missing-details clarification.

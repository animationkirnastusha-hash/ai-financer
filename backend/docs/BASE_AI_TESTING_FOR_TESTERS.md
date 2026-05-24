# Base AI testing for testers

Before sending the app to testers, run:

```bash
cd /root/ai-financer/backend
npm run build
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:backend-integrity
TEST_BASE_URL="http://localhost:3000/api" TEST_HEALTH_URL="http://localhost:3000/health" TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

Interpretation:

- `test:backend-integrity` must be green. If it fails, do not test Premium; backend execution is not stable.
- `test:base-ai` checks the natural-language AI path. If it fails while integrity is green, the issue is the planner/provider layer, not the executor.

The runner resets finance data for the test user by default.

# Base AI regression suite

Run from backend:

```bash
TEST_BASE_URL="http://localhost:3000/api" \
TEST_HEALTH_URL="http://localhost:3000/health" \
TEST_TELEGRAM_ID=516730814 \
TEST_ADMIN=1 \
npm run test:base-ai
```

The runner creates/saves a test token automatically when needed. It resets finance data for the test user before the suite and again before mutating AI tests.

The AI flow is tested as a black-box client: parse command, receive pending action, confirm pending action, then verify backend state. The runner does not parse financial commands.

# HTTP confirm smoke

`npm run test:http-confirm` checks only the public HTTP confirmation endpoint.

It does not use the external AI provider and does not parse financial text. The test creates a ready pending action with a structured tool contract directly in the database, then confirms it through:

```text
POST /api/ai/confirm/:pendingActionId
```

Use it to separate frontend/controller confirmation problems from planner/provider problems.

Recommended order:

```bash
npm run build
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:backend-integrity
TEST_BASE_URL="http://localhost:3000/api" TEST_HEALTH_URL="http://localhost:3000/health" TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:http-confirm
TEST_BASE_URL="http://localhost:3000/api" TEST_HEALTH_URL="http://localhost:3000/health" TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

# Base AI regression suite

Run backend integrity first:

```bash
npm run build
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:backend-integrity
```

Then run the natural-language suite:

```bash
TEST_BASE_URL="http://localhost:3000/api" \
TEST_HEALTH_URL="http://localhost:3000/health" \
TEST_TELEGRAM_ID=516730814 \
TEST_ADMIN=1 \
npm run test:base-ai
```

`test:base-ai` sends real user-like text to `/api/ai/parse`, but confirms prepared actions directly through the compiled backend service by default. This removes HTTP confirm/rate-limit noise from product regression while still testing the external AI planner path.

To test HTTP confirm explicitly:

```bash
TEST_CONFIRM_MODE=http npm run test:base-ai
```

Recommended full run:

```bash
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-full
```

The suite does not parse financial commands. It sends text to the backend and checks state through API/DB.

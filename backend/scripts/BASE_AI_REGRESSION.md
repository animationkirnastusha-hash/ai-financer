# Base AI regression suite

Console regression suite for the base version of AI-Financer.

This is a black-box runner. It does not parse financial commands. Natural-language commands are sent to the backend AI endpoint, and the runner verifies resulting API state.

## Run

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

The runner auto-creates a test user and saves JWT to `.test-auth-token` when no token is provided.

## Fixed in patch 64

- Goals CRUD now uses `title`, matching the current backend contract.
- Budgets CRUD now creates an expense category and sends `categoryId`.
- Recurring CRUD now sends `category` and `period`, matching the current backend contract.
- Analytics test now sends supported `screen_view` event.
- AI goal assertions check both `title` and `name` for compatibility.
- AI create-account assertion reports only account names instead of dumping full account payloads.

## Modes

```bash
TEST_AI=0 npm run test:base-ai
TEST_STRICT_AI=0 npm run test:base-ai
TEST_KEEP_DATA=1 npm run test:base-ai
TEST_DESTRUCTIVE=1 npm run test:base-ai
```

Use `TEST_DESTRUCTIVE=1` only on an isolated database.

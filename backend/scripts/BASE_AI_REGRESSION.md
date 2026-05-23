# Base AI regression suite

This suite tests the backend API and the base AI flow from the console. It is intended for pre-tester checks before Premium work.

## Token

Generate a fresh token after every full database reset:

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:token
```

The token is printed to stdout and also saved to:

```text
backend/.test-auth-token
```

The regression suite automatically uses this file when `TEST_AUTH_TOKEN` is not provided.

## Run

```bash
cd /root/ai-financer/backend
TEST_BASE_URL="http://localhost:3000/api" \
TEST_HEALTH_URL="http://localhost:3000/health" \
TEST_ADMIN="1" \
npm run test:base-ai
```

You can also pass the token explicitly:

```bash
TEST_AUTH_TOKEN="PASTE_TOKEN_HERE" npm run test:base-ai
```

Do not split the token line from the final command. A bare `TEST_AUTH_TOKEN=...` on a separate shell line is not exported to the npm process.

## Modes

```bash
TEST_AI=0 npm run test:base-ai
```

Runs backend CRUD/read tests without AI.

```bash
TEST_STRICT_AI=0 npm run test:base-ai
```

Allows AI failures to be reported without failing the whole process.

```bash
TEST_DESTRUCTIVE=1 npm run test:base-ai
```

Runs destructive AI guard checks. Use only on an isolated test database.

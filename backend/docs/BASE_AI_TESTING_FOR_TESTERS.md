# Base AI testing for testers

Run this on an isolated test user/database.

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

The runner automatically creates a test token when needed and resets finance data for the test user before tests. Do not run destructive tests on a real user.

Optional flags:

```bash
TEST_AI=0 npm run test:base-ai          # backend CRUD only
TEST_STRICT_AI=0 npm run test:base-ai   # AI issues as softer checks
TEST_RESET_BEFORE=0 npm run test:base-ai # keep existing test data
```


## Patch 68 update

The base AI suite isolates manual CRUD tests from AI mutation tests. This prevents the AI planner from selecting accounts created by the earlier manual CRUD phase. The suite still sends normal user commands and verifies results through API state.

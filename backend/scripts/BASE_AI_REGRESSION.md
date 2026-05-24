# Base AI regression suite

Console black-box tests for the base version of AI-Financer.

The suite sends normal API requests and natural-language AI commands to the backend. It does not parse financial commands and does not replace production logic. Production command handling must remain: AI planner → tool contract → validator → executor.

## Run

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

By default the runner creates/loads a test JWT and resets finance data for the test user before the run. This prevents old accounts, pending actions and AI memory from contaminating AI checks.

Disable reset only when you intentionally want to test on existing data:

```bash
TEST_RESET_BEFORE=0 npm run test:base-ai
```

Reports:

```text
test-results/base-ai-regression-*.md
test-results/base-ai-regression-*.json
```


## Patch 68 notes

- The runner now resets finance data once before mutation AI tests as well as before the whole run.
- AI test entity names avoid the literal `ai` and English helper words because production planner can treat them as technical/non-user words.
- This remains a black-box test runner and does not parse financial commands.

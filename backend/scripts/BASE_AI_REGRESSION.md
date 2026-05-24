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

## Patch 69 note

The runner now confirms pending AI actions through `/ai/confirm/:pendingActionId` first and falls back to `/ai/confirm` with a JSON body. This matches the backend hardening that accepts the pending action id from route params, `pendingActionId`, or `id`.

The backend confirmation flow now claims pending actions inside the same Prisma transaction before executing the planned actions and marks them confirmed after execution. If execution fails, the transaction rolls back and the pending action is marked failed by the orchestrator.

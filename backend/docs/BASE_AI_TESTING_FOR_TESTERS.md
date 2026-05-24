# Base AI testing for testers

Use an isolated test user or isolated database. The suite checks backend read contracts, manual CRUD and base AI workflows.

Run:

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

Reports are saved to:

```text
test-results/base-ai-regression-*.md
test-results/base-ai-regression-*.json
```

If AI tests fail after `prepared.success=true`, inspect the `confirmed` block. A correct confirmed action must return `executed: true` and must change the relevant backend state.

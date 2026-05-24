# Backend integrity tests

This suite checks backend execution without using an external AI provider.

It creates prepared tool contracts directly, stores them as pending actions, confirms them through `AIService.confirmCommand`, and verifies the database state.

Run:

```bash
cd backend
npm run build
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:backend-integrity
```

Expected result: all tests pass.

If this suite fails, the bug is in backend execution: pending actions, validator, executor, balance mutation, or confirmation lifecycle.

If this suite passes but `test:base-ai` fails, the bug is higher: natural-language planning, AI provider output, or validator accepting the AI tool contract.

The suite includes a static guard against financial text parsers in the AI module. Financial commands must stay on the path:

```text
AI planner → tool contract → validator → executor
```

No regex or hand-written extraction of amount/account/category/section/goal from raw user text is allowed.

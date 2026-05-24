# HTTP confirm smoke test

`npm run test:http-confirm` verifies only the public HTTP confirmation endpoint.

The test creates a ready pending action directly in the database, calls:

```http
POST /api/ai/confirm/:pendingActionId
```

and then checks three things:

1. the HTTP response has `success: true` and `executed: true`;
2. the account was actually created in the database;
3. the pending action status became `confirmed`.

This test does not call the external AI provider and does not parse financial natural language.

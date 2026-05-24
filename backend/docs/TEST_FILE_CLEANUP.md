# Test file cleanup

Patch 77 temporarily added a TypeScript unit test under `src/modules/ai/__tests__`.
That file can be picked up by TypeScript/VS Code and requires `node:test` and `node:assert` typings in the source tree.

The project now uses console/integration runners instead:

- `npm run test:backend-integrity`
- `npm run test:base-ai`
- `npm run test:base-full`

Delete the old source test directory:

```bash
cd /root/ai-financer/backend
rm -rf src/modules/ai/__tests__
```

Do not keep unit tests inside `src/` until the backend has a dedicated test tsconfig.

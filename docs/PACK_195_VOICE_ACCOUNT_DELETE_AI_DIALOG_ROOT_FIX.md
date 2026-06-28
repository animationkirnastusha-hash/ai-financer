# PACK 195 — Voice/account delete/AI dialog root fix

## Scope

- Centralizes voice capture usage through `frontend/src/features/voice/manager/useUnifiedVoiceCapture.ts`.
- Keeps the existing recorder/STT implementation, but gives chat and floating voice one shared entry point and watchdog reset.
- Fixes chat answers so executed read-only AI results use backend result text instead of the generic “Action completed”.
- Keeps Fina prompt messages as assistant messages, not user-submitted commands, for goals/limits/payments flows.
- Adds hidden AI context to the first user answer after those assistant prompts, so the user sees only their own clean text.
- Removes “Help me / Помоги” wording from visible assistant prompts.
- Hardens account deletion by explicitly clearing account-linked spending limits before account deletion.
- Restores missing `reports.css` placeholder imported by `index.css`.

## Checks

- `frontend/scripts/audit-css.mjs`: Problems 0
- `frontend/scripts/predeploy-audit.mjs --strict`: blocking findings 0

Full frontend/backend builds were not completed in the sandbox because node_modules/@types are absent in the uploaded archive.

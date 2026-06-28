# PACK 204B — Voice optional-chain build fix

Fixes TypeScript build error in `frontend/src/features/voice/core/usePressToTalkVoice.ts`:

`TS2779: The left-hand side of an assignment expression may not be an optional property access.`

Only replaces the optional-chaining assignment with an explicit null check.

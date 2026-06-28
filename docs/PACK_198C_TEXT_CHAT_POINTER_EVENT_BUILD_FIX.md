# PACK 198C — Text chat pointer event build fix

## Scope

Build-only fix after pack 198b.

## Changed files

- `frontend/src/features/chat/ui/TextChatOverlay.tsx`

## Fix

TypeScript rejected direct conversion from `Event` to an object with `pointerId`.
The code now casts through `unknown` before reading `pointerId`.

## Not changed

- Voice hold logic from 198b is preserved.
- AI, finance flows, onboarding, backend and parsers are not touched.

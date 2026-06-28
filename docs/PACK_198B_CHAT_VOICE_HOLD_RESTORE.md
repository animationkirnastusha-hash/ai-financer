# PACK 198B — Chat voice hold restore

## Scope

This pack fixes the chat press-to-talk interaction after pack 198.

## Changed files

- `frontend/src/features/chat/ui/TextChatOverlay.tsx`

## Changes

- Restores immediate visual pressed state on pointer down.
- Keeps recording while the finger is held.
- Removes global `mouseup` and `touchend` release fallbacks from the chat voice path because they can fire as synthetic compatibility events on iOS/WebView and cut the hold interaction too early.
- Keeps the safe global `pointerup` release fallback with pointer id checking.
- Keeps `pointercancel`, `touchcancel`, blur, pagehide, visibility cleanup.
- Adds release de-duplication so button pointerup and window pointerup cannot stop the same voice session twice.
- Adds elapsedMs to release debug events.

## Not changed

- No AI planner changes.
- No financial parser changes.
- No backend business logic changes.
- No frontend onboarding parser is added back.

## Check

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run audit:css
npm run audit:predeploy:strict
```

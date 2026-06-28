# PACK 196 — Voice input manager rebuild

## Scope

This pack rebuilds the frontend voice capture lifecycle around a single manager layer.

## Changed files

- `frontend/src/features/voice/model/useVoiceInput.ts`
- `frontend/src/features/voice/manager/useUnifiedVoiceCapture.ts`
- `frontend/src/features/voice/manager/useVoiceHoldGesture.ts`
- `frontend/src/features/voice/manager/useVoiceReleaseGuards.ts`
- `frontend/src/features/voice/ui/VoiceFirstCompanionLayer.tsx`
- `frontend/src/features/chat/ui/TextChatOverlay.tsx`

## Fixes

- Chat voice no longer depends only on a React button `pointerup` event.
- Release is caught through `pointerup`, `mouseup`, `touchend`, `pointercancel`, `touchcancel`, `blur`, `pagehide`, and visibility change.
- The chat voice button becomes visually pressed immediately after the gesture starts, then is force-reset by release/cancel/watchdog.
- If the user releases before `MediaRecorder` has fully started, the manager marks the session as `releaseAfterStart` and stops as soon as recording starts.
- Permission and recording start operations now have hard timeouts, so the UI should not stay stuck after a WebView/microphone glitch.
- The floating companion voice gesture now uses the manager folder, not the old UI-local gesture hook.

## Notes

No AI parsers, command parsers, backend contracts, or finance logic were changed.

# PACK 200B — voice core compatibility build fix

## Purpose

Build fix after `pack-200-voice-core-single-recorder`.

Pack 200 replaced the active voice core but did not keep the public API expected by the current chat overlay and floating companion. This pack keeps the single-recorder logic and restores the public exports/signatures used by the rest of the app.

## What changed

- Restored `@/features/voice` exports:
  - `shouldIgnoreVoiceCommand`
  - `normalizeVoiceText`
  - `normalizeForVoiceText`
  - `useVoiceCommandDispatcher`
  - `useVoiceThought`
  - voice companion/session types
- Restored `usePressToTalkVoice` compatibility:
  - `source`
  - `maxDurationMs`
  - `permissionWasPrompted`
  - `cancel(reason)`
  - `isPressed`
  - `isCancelledBySwipe`
  - pointer handlers
- Kept the simplified recorder behavior:
  - no VAD gate
  - no duration-based upload block
  - uploads any non-empty blob over 64 bytes
  - uses recorder timeslices for more reliable chunks in iOS/WebView
- Added `voiceTypes.ts` as a compatibility bridge for older imports.

## Files

- `frontend/src/features/voice/index.ts`
- `frontend/src/features/voice/core/index.ts`
- `frontend/src/features/voice/core/voiceCapture.types.ts`
- `frontend/src/features/voice/core/voiceTypes.ts`
- `frontend/src/features/voice/core/voiceText.ts`
- `frontend/src/features/voice/core/voiceApi.ts`
- `frontend/src/features/voice/core/usePressToTalkVoice.ts`
- `frontend/src/features/voice/core/useVoiceCommandDispatcher.ts`
- `frontend/src/features/voice/core/useVoiceThought.ts`
- `frontend/src/features/voice/api/voice.api.ts`
- `frontend/src/features/voice/model/useVoiceInput.ts`
- `frontend/src/features/voice/model/useVoiceRecorder.ts`
- `frontend/src/features/voice/model/voice.types.ts`
- `frontend/src/features/voice/manager/useUnifiedVoiceCapture.ts`

## Checks

`npx tsc --noEmit --pretty false` passed on the archive with pack 200 + pack 200B applied.

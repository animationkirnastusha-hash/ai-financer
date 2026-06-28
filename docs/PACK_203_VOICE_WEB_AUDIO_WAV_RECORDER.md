# PACK 203 — Voice Web Audio WAV Recorder

## Purpose

Replace the active microphone recorder with a deterministic Web Audio WAV recorder.

## Files

- `frontend/src/features/voice/core/usePressToTalkVoice.ts`
- `backend/src/controllers/voice.controller.ts`

## Behavior

- One active voice session at a time.
- Uses `getUserMedia` + Web Audio API instead of `MediaRecorder`.
- Records mono PCM in memory.
- Encodes final audio as 16 kHz WAV.
- Sends `voice-*.wav` to `/api/voice/transcribe`.
- Does not use VAD to block upload.
- Does not use `MediaRecorder.start(timeslice)`.
- Avoids iOS/WebView mp4/m4a corruption path entirely.

## Check

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run audit:css
npm run audit:predeploy:strict
```

```bash
cd /root/ai-financer/backend
npm run build
pm2 restart ai-financer --update-env
pm2 save
```

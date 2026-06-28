# PACK 200 — voice core single recorder

Цель: убрать старый раздробленный frontend voice lifecycle и оставить один реальный слой записи.

## Что изменено

- Добавлен единый voice core:
  - `frontend/src/features/voice/core/voiceTypes.ts`
  - `frontend/src/features/voice/core/voiceApi.ts`
  - `frontend/src/features/voice/core/usePressToTalkVoice.ts`
  - `frontend/src/features/voice/core/index.ts`
- Публичный экспорт: `frontend/src/features/voice/index.ts`.
- Старые точки входа переведены в тонкие compatibility wrappers:
  - `frontend/src/features/voice/api/voice.api.ts`
  - `frontend/src/features/voice/model/useVoiceInput.ts`
  - `frontend/src/features/voice/model/useVoiceRecorder.ts`
  - `frontend/src/features/voice/manager/useUnifiedVoiceCapture.ts`
  - `frontend/src/features/voice/model/voice.types.ts`
- Старый VAD/no-speech gate больше не решает, отправлять аудио или нет. Если MediaRecorder дал blob, он уходит на `/api/voice/transcribe`.
- Backend voice debug пропускает новые поля: `sessionId`, `blobType`, `chunks`, `hasRecorder`, `stage`, `filename`.

## Важно

Этот пакет не добавляет финансовых парсеров. Голосовой слой только записывает звук, получает текст и отдаёт текст дальше в существующий AI/chat flow.

## Проверка

Frontend:

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run audit:css
npm run audit:predeploy:strict
```

Backend:

```bash
cd /root/ai-financer/backend
npm run build
pm2 restart ai-financer --update-env
pm2 save
```

## Ожидаемые логи

```text
[voice-debug] voice_start_requested
[voice-debug] voice_permission_granted
[voice-debug] voice_recorder_started
[voice-debug] voice_stop_requested
[voice-debug] voice_recorder_stopped
[voice-debug] voice_blob_ready
[voice-debug] voice_transcribe_sent
[voice-transcribe] transcribe_received
[voice-transcribe] transcribe_finished
[voice-debug] voice_text_received
```

## Что можно удалить после успешного build

Старые VAD/платформенные файлы больше не используются активным voice flow:

```text
frontend/src/features/voice/model/voiceRecorder.constants.ts
frontend/src/features/voice/model/voiceRecorder.helpers.ts
frontend/src/features/voice/model/voiceRecorder.types.ts
frontend/src/features/voice/model/voiceRecorderAndroid.ts
frontend/src/features/voice/model/voiceRecorderIos.ts
frontend/src/features/voice/model/voiceRecorderPlatform.ts
frontend/src/features/voice/model/voiceRecorderUploadGuards.ts
```

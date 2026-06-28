# Pack 201 — voice iOS audio format fix

Цель: убрать отправку битого/неподходящего аудио в STT после переписывания voice core.

## Что исправлено

1. `MediaRecorder.start(250)` больше не применяется для MP4/M4A/AAC.
   На iOS/WebView MP4 с timeslice может давать фрагменты, которые сервер принимает как файл, но OpenAI отклоняет как `Audio file might be corrupted or unsupported`.

2. Для WebM/Ogg timeslice остаётся, потому что эти контейнеры нормально переживают chunk-сборку.

3. Frontend теперь берёт фактический `recorder.mimeType`, а не только запрошенный mime type.
   Если браузер сам выбрал `audio/mp4`, файл уйдёт как `.m4a`, а не как `.webm`.

4. Backend дополнительно определяет реальный формат по сигнатуре файла:
   - WebM/Matroska
   - MP4/M4A
   - WAV
   - MP3
   - Ogg

5. Если multipart прислал неверный mimetype или имя файла, backend корректирует формат перед нормализацией/отправкой в STT.

## Файлы

- `frontend/src/features/voice/core/usePressToTalkVoice.ts`
- `backend/src/services/voice.service.ts`
- `backend/src/controllers/voice.controller.ts`

## Проверка

```bash
cd /root/ai-financer/backend
npm run build
pm2 restart ai-financer --update-env
pm2 save
```

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run audit:css
npm run audit:predeploy:strict
```

Потом:

```bash
cd /root/ai-financer
pm2 flush ai-financer
pm2 logs ai-financer --lines 0
```

Ожидаемая цепочка:

```text
voice_recorder_started
voice_recorder_stopped
voice_blob_ready
voice_transcribe_sent
[voice-transcribe] transcribe_received
[voice-transcribe] transcribe_finished
voice_text_received
```

Если снова будет 400, в логах нужно смотреть `mimeType`, `requestedMimeType`, `blobSize`, `originalName` и `audio_mime_corrected`.

# PACK 204 — Voice hybrid recorder root fix

Цель: убрать зависимость от одного ненадёжного способа записи в iPhone Telegram WebView.

Изменения:
- `usePressToTalkVoice` теперь запускает гибридную запись: Web Audio WAV + нативный MediaRecorder fallback на том же stream.
- Если Web Audio не отдаёт samples, но MediaRecorder дал валидный blob, на STT уходит MediaRecorder blob.
- Если Web Audio работает, на STT уходит WAV 16 kHz mono PCM.
- Для iOS MediaRecorder предпочитает mp4/m4a без timeslice.
- Для WebM/Ogg timeslice остаётся только как fallback.
- Один активный voice session на приложение сохранён.
- VAD не участвует в решении отправлять или не отправлять аудио.
- Backend debug allowlist расширен для hybrid-recorder полей.

Файлы:
- frontend/src/features/voice/core/usePressToTalkVoice.ts
- backend/src/controllers/voice.controller.ts

Проверка:
1. backend build + restart.
2. frontend build.
3. Включить VOICE_DEBUG_LOGS=1 на время проверки.
4. Проверить появление `POST /api/voice/transcribe`.

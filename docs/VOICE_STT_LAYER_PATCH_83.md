# Patch 83 — server STT voice layer

## Цель

Одинаковый голосовой UX на iPhone и Android: пользователь говорит «Фина», приложение распознаёт речь через серверный STT и отправляет только текст в существующий AI flow.

## Новая схема

```text
MediaRecorder на frontend
→ POST /api/voice/transcribe
→ OpenAI gpt-4o-mini-transcribe
→ текст
→ wake word filter: «Фина»
→ существующий AI planner → tool contract → validator → executor
```

Это не финансовый parser. Единственная техническая проверка на frontend — wake word «Фина». Финансовый смысл по-прежнему обрабатывается backend AI planner/tool contract.

## ENV

Добавить в `backend/.env` после покупки API-ключа:

```env
VOICE_STT_PROVIDER=openai
OPENAI_API_KEY=sk-...
VOICE_STT_MODEL=gpt-4o-mini-transcribe
VOICE_LANGUAGE=ru
VOICE_MAX_AUDIO_MB=8
```

До добавления ключа frontend покажет предупреждение, что серверное распознавание не настроено.

## Проверка

```bash
cd /root/ai-financer/backend
npm run build
pm2 restart ai-financer --update-env
```

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
```

Smoke без аудиофайла:

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:token
TEST_BASE_URL="http://localhost:3000/api" npm run test:voice-stt
```

Smoke с аудиофайлом:

```bash
TEST_BASE_URL="http://localhost:3000/api" \
TEST_VOICE_AUDIO="/root/test-voice.webm" \
npm run test:voice-stt
```

## Что не удалять

`useVoiceRecognition.ts` пока оставлен как fallback для desktop/dev, если MediaRecorder недоступен. Основной путь теперь `useVoiceRecorder.ts`.

# Patch 87 — Gladia STT без OpenAI

Пакет полностью убирает OpenAI из голосового STT-слоя и переключает распознавание на Gladia.

## Что меняется

Основной путь остается прежним:

```text
MediaRecorder → backend /api/voice/transcribe → STT provider → текст → wake word → AI planner
```

Финансовый смысл не извлекается regex-парсерами. STT делает только аудио → текст.

## Поддерживаемые STT provider

```text
gladia      основной provider
deepgram    запасной provider
assemblyai  запасной provider
mock        dev/test без внешнего STT
```

OpenAI и proxy-provider удалены из voice.service, frontend status и package.json.

## Backend .env для Gladia

```env
VOICE_STT_PROVIDER=gladia
GLADIA_API_KEY=...
VOICE_STT_MODEL=gladia-pre-recorded-v2
VOICE_LANGUAGE=ru
VOICE_MAX_AUDIO_MB=8
GLADIA_POLL_TIMEOUT_MS=25000
GLADIA_POLL_INTERVAL_MS=900
```

`VOICE_STT_MODEL` здесь информационный: у Gladia pre-recorded v2 модель выбирается на стороне API. Поле нужно для status/debug, чтобы видеть активный режим.

## Удалить из .env

```env
OPENAI_API_KEY=
OPENAI_TRANSCRIBE_MODEL=
VOICE_STT_PROXY_URL=
VOICE_STT_PROXY_KEY=
VOICE_STT_PROXY_MODEL=
```

Если эти строки оставить, новый код их не использует, но лучше убрать, чтобы не путаться.

## Что заменить

```text
backend/package.json
backend/package-lock.json
backend/src/services/voice.service.ts
backend/src/controllers/voice.controller.ts
backend/scripts/run-voice-stt-smoke.mjs

frontend/src/features/voice/api/voice.api.ts
frontend/src/features/voice/model/useVoiceRecorder.ts

docs/VOICE_STT_GLADIA_PATCH_87.md
```

## Команды после установки

```bash
cd /root/ai-financer/backend
npm install
npm run build
pm2 restart ai-financer --update-env
```

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
```

Если frontend через nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Проверка статуса

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:token
TOKEN="$(cat .test-auth-token)"

curl -s http://localhost:3000/api/voice/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

Ожидаемый ответ:

```json
{
  "success": true,
  "configured": true,
  "provider": "gladia",
  "model": "gladia-pre-recorded-v2",
  "maxAudioMb": 8,
  "language": "ru",
  "supportedProviders": ["gladia", "deepgram", "assemblyai", "mock"],
  "gladiaConfigured": true
}
```

## Проверка с аудио

```bash
TEST_BASE_URL="http://localhost:3000/api" \
TEST_VOICE_AUDIO="/root/test-voice.webm" \
node scripts/run-voice-stt-smoke.mjs
```

## Проверка в приложении

1. Полностью закрыть Mini App.
2. Открыть заново.
3. Разрешить микрофон.
4. Сказать: `Фина, кофе 100`.
5. Смотреть backend logs:

```bash
pm2 logs ai-financer --lines 100
```

Если есть `POST /api/voice/transcribe`, значит frontend отправляет аудио. Если Gladia возвращает текст, но команда не выполняется, проблема уже в AI planner/confirm flow, не в STT.

## Что удалить вручную

Из кода — ничего, если заменяешь файлы из архива.

Из backend зависимостей OpenAI удалён через `package.json` и `package-lock.json`. После `npm install` пакет `openai` должен уйти из `node_modules`, если больше нигде не используется.

Дополнительно можно проверить:

```bash
cd /root/ai-financer/backend
grep -R "openai\|OpenAI\|OPENAI" -n src package.json package-lock.json || true
```

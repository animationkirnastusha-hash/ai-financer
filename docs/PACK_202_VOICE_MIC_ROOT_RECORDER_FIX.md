# PACK 202 — voice mic root recorder fix

Цель пакета: восстановить рабочий микрофон без возврата к разбросанному старому слою.

## Что исправлено

1. `usePressToTalkVoice` переписан как единый recorder lifecycle:
   - один активный session;
   - один `MediaRecorder`;
   - один путь `press → permission → recorder → stop → blob → transcribe → text`;
   - без VAD-блокировки отправки;
   - без старых разрозненных hooks в UI.

2. iOS/WebView больше не пишет через WebM первым кандидатом.
   Для iPhone/iPad сначала выбирается:
   - `audio/mp4;codecs=mp4a.40.2`;
   - `audio/mp4`;
   - `audio/aac`.

3. Для MP4/M4A/AAC/Caf больше не используется `MediaRecorder.start(timeslice)`.
   Эти контейнеры финализируются только после `stop()`, иначе iPhone может отдавать битый файл.

4. Android/Desktop остаются на WebM/Ogg, где `timeslice` безопасен.

5. Отпускание пальца ловится через:
   - `pointerup`;
   - `mouseup`;
   - `touchend`;
   - `pointercancel`;
   - `touchcancel`;
   - `blur`;
   - `pagehide`;
   - `visibilitychange`.

6. Backend debug whitelist дополнен полями `durationMs` и `timesliceMs`, чтобы видеть реальную цепочку без лишнего шума.

## Файлы

- `frontend/src/features/voice/core/usePressToTalkVoice.ts`
- `frontend/src/features/voice/core/voiceApi.ts`
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

## Логи

```bash
cd /root/ai-financer
pm2 flush ai-financer
pm2 logs ai-financer --lines 0
```

Нормальная цепочка:

```text
voice_press_start
voice_start_requested
voice_permission_granted
voice_recorder_started
voice_release
voice_recorder_stopped
voice_blob_ready
voice_transcribe_sent
[voice-transcribe] transcribe_received
[voice-transcribe] transcribe_finished
voice_text_received
```

Удалять файлы после этого пакета не нужно.

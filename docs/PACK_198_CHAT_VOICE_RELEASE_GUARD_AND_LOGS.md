# Pack 198 — Chat voice release guard and useful logs

## Что исправлено

1. Чатовый голос больше не зависит только от `pointerup` на кнопке.
2. Добавлены глобальные события отпускания/отмены для iOS Telegram WebView:
   - `pointerup`
   - `mouseup`
   - `touchend`
   - `pointercancel`
   - `touchcancel`
   - `blur`
   - `pagehide`
   - `visibilitychange`, только когда страница реально скрыта.
3. Если палец отпущен до фактического старта `MediaRecorder`, stop откладывается и выполняется сразу после старта.
4. Если UI остался визуально зажатым, idle-state recovery снимает зажатое состояние.
5. Добавлен guard, который принудительно завершает зависшее удержание.
6. VAD-событие `vad_silence_detected_manual_hold` теперь логируется один раз за запись, чтобы не спамить `/api/voice/debug`.
7. Backend voice debug теперь пропускает в логи поля `source`, `voiceState`, `pointerActive`, `isPressed`, `deferredStop`.

## Что не трогалось

- AI planner.
- Парсеры финансовых команд.
- Создание транзакций/счетов.
- Backend STT provider.

## Проверка

После установки включить подробные voice-логи через `VOICE_DEBUG_LOGS=1`, перезапустить backend и проверить голос в чате.

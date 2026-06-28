# PACK 199 — voice layer rewrite

Цель: убрать разброс голосовой логики между chat / floating companion / model / manager и оставить один публичный voice core.

## Новый основной слой

- `frontend/src/features/voice/index.ts`
- `frontend/src/features/voice/core/voiceCapture.types.ts`
- `frontend/src/features/voice/core/voiceText.ts`
- `frontend/src/features/voice/core/voiceApi.ts`
- `frontend/src/features/voice/core/usePressToTalkVoice.ts`
- `frontend/src/features/voice/core/useVoiceCommandDispatcher.ts`
- `frontend/src/features/voice/core/useVoiceThought.ts`
- `frontend/src/features/voice/core/index.ts`

## Что изменено

1. Чатовый голос и внешний голос теперь используют один hook: `usePressToTalkVoice`.
2. Управление pointer lifecycle, MediaRecorder, permission, stop/cancel/reset, upload/transcribe теперь находится в `features/voice/core`.
3. Старые `features/voice/model/*` и `features/voice/manager/*` больше не используются в актуальном flow.
4. Убрана пачка разрозненных chat-specific release guards из `TextChatOverlay.tsx`.
5. Внешний компаньон больше не использует старую session machine и hold gesture.
6. Debug-события урезаны до нормальной цепочки: press, permission, recorder started/stopped, blob, transcribe, text.
7. Добавлен отсутствующий `reports.css`, чтобы закрыть missing-css-import.

## Парсеры

Финансовые парсеры не добавлялись. Голосовой слой не разбирает суммы, категории, счета и операции. Он только пишет звук, отправляет аудио в STT и передаёт текст дальше в обычный AI/chat flow.

## Что можно удалить после установки

После успешного build можно удалить старые неиспользуемые файлы/папки:

```text
frontend/src/features/voice/api
frontend/src/features/voice/manager
frontend/src/features/voice/model
frontend/src/features/voice/ui/VoiceKeyboardEntry.tsx
frontend/src/features/voice/ui/VoiceLockActions.tsx
frontend/src/features/voice/ui/VoicePendingConfirmModal.tsx
frontend/src/features/voice/ui/companion/useVoiceCompanionThought.ts
frontend/src/features/voice/ui/companion/useVoiceHoldGesture.ts
```

Перед удалением в архиве проверено: актуальные импорты на эти старые пути не остаются.

## Проверки в песочнице

- TypeScript parser: OK по изменённым TS/TSX файлам.
- `npm run audit:css`: Problems 0.
- `npm run audit:predeploy:strict`: blocking findings 0.
- Полный frontend build в песочнице не запускался из-за отсутствующих `node_modules`.

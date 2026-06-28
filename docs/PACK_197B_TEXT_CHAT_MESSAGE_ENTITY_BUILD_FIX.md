# PACK 197B — TextChatOverlay MessageEntity build fix

## Исправлено

- Убран лишний `content` из setup-сообщений в `TextChatOverlay.tsx`.
- Тип `MessageEntity` поддерживает поле `text`, но не поддерживает `content`.
- Логика pack-197 сохранена: onboarding новичка идёт последовательностью вопросов Фины, без frontend-парсеров суммы, счёта и типа счёта.

## Файлы

- `frontend/src/features/chat/ui/TextChatOverlay.tsx`

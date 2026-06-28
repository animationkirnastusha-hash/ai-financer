# PACK 205C — remove voice frontend build fix

Исправляет сборочные хвосты после удаления voice-слоя.

## Файлы

- frontend/src/features/chat/lib/useFinaPullGesture.ts
- frontend/src/shared/lib/i18n/locales/en/misc.ts
- frontend/src/shared/lib/i18n/locales/ru/misc.ts

## Что исправлено

1. Убран лишний параметр `mode: 'text'` из открытия `ai-text-overlay`.
2. Удалены дубли `ai.menu.text.title` и `ai.menu.text.caption` в EN словаре.
3. Удалены дубли `ai.menu.text.title` и `ai.menu.text.caption` в RU словаре.
4. Voice-слой не возвращался.

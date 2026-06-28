# PACK 205 — Remove voice layer

Пак полностью выводит голосовой слой из активного проекта.

## Что убрано из активной логики

- Плавающая голосовая Фина больше не монтируется в AppShell.
- Чатовый overlay стал текстовым: без микрофона, удержания, voice upload, voice pending state и voice session payload.
- Первый запуск в чате начинается сразу с создания первого счёта, без шага микрофона.
- Настройки голосового ввода удалены из страницы настроек и companion-страницы.
- Frontend больше не импортирует `features/voice` и voice CSS.
- Backend больше не монтирует `/api/voice` routes.
- Backend smoke/release-check больше не проверяет voice/status.
- AI source оставлен только `text`.
- Telegram bot больше не обрабатывает audio/voice как команду.
- Subscription/Store больше не содержит voice limits, voice bundles и voice usage.

## Что нужно удалить руками

Удаляются старые файлы и папки голосового слоя. Пак не содержит apply-скриптов.

См. команды в ответе к паку.

## Проверка

Backend:

```bash
cd /root/ai-financer/backend
npm run build
npm run audit:final
npm run release:check
```

Frontend:

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run audit:css
npm run audit:predeploy:strict
```

## Примечание

Старые записи в базе, если они уже были созданы как usage/audit events для voice, физически не мигрируются. Активный код больше их не создаёт и не использует.

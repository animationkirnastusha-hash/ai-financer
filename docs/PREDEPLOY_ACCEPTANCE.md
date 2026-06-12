# Ai-financer — predeploy acceptance

## Обязательные команды перед тестерами

Backend:
```bash
cd /root/ai-financer/backend
npm run build
npx prisma migrate deploy
npx prisma migrate status
npm run audit:final
npm run release:check
```

Если HTTP smoke требует явный URL:
```bash
TEST_BASE_URL="http://localhost:3000/api" npm run release:check
```

Frontend:
```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run predeploy:full
```

## Обязательные env-проверки

Backend `.env`:
```env
DATABASE_URL=...
JWT_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_PAYMENTS_WEBHOOK_SECRET=...
VOICE_DEBUG_LOGS=0
```

Для STT — только актуальный провайдер, без лишних активных fallback-режимов:
```env
VOICE_STT_PROVIDER=...
VOICE_MAX_AUDIO_MB=...
VOICE_LANGUAGE=ru
```

## Telegram Payments webhook

Проверить:
```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq
```

Ожидаемо:
```text
/api/payments/telegram/webhook
```

Webhook без `secret_token` не должен принимать платёжные события.

## Критерии готовности к тестерам

Можно отдавать тестерам, если:

- [ ] Backend build passed.
- [ ] Prisma migrate deploy/status passed.
- [ ] Backend audit passed.
- [ ] Backend release check passed или известна только не критичная HTTP-base-url причина.
- [ ] Frontend build passed.
- [ ] Frontend predeploy full passed.
- [ ] Store виден Free.
- [ ] Premium/Business скрыты без доступа.
- [ ] Admin не получает Premium/Business автоматически.
- [ ] Обычные малые расходы не требуют лишнего confirm.
- [ ] Крупные/сомнительные/опасные действия требуют confirm.
- [ ] Нет самозапросов голосом после молчания.
- [ ] Данные не исчезают визуально при плохом интернете.

## Что не делать перед тестерами

- Не добавлять банки.
- Не добавлять СБП/карты.
- Не добавлять крипту.
- Не добавлять новые крупные AI-фичи.
- Не переписывать AI pipeline без конкретного бага.
- Не делать большие CSS-перестройки без необходимости.
- Не добавлять финансовые regex-парсеры.

## Что можно исправлять точечно

- Сборочные ошибки.
- Ошибки confirm/cancel.
- Ошибки оплаты/webhook.
- Ошибки голосового lifecycle.
- Плохой i18n в затронутых файлах.
- Наложения модалок/кнопок.
- Явные UI-сломы на iPhone/Telegram WebView.

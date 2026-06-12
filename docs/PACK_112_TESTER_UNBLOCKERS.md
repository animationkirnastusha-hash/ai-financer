# Pack 112 — tester unblockers

Короткий стабилизационный пакет перед внешними тестами.

## Что исправлено

1. Telegram payment webhook больше не может молча работать без `TELEGRAM_PAYMENTS_WEBHOOK_SECRET`.
   В production секрет обязателен через `env.ts`, а сам webhook отклоняет запрос без секрета.

2. Confirm/cancel в чате больше не блокируется после первой ошибки.
   `actionId` удаляется из `handlingPendingActionIds` в `finally`, поэтому повторная попытка снова сработает.

3. Дефолтный порог автоподтверждения для обычных расходов поднят с 500 до 5000.
   Бытовые расходы меньше раздражают пользователя лишними подтверждениями. Строгий режим остаётся строгим.

4. Существующие настройки AI с прежними дефолтами обновляются миграцией:
   `500/1000 -> 5000`, `100000 -> 200000`.

5. Voice debug logs теперь выключены по умолчанию.
   Логи включаются только при `VOICE_DEBUG_LOGS=1`. Из whitelist убраны `userAgent`, `url`, `transcriptPreview`.

6. `VoicePendingConfirmModal` переведён на i18n-словарь.

## Что не трогалось

- AI pipeline не переписывался.
- Финансовые regex/parser-слои не добавлялись.
- Voice lifecycle не менялся.
- Store/Premium/Business gating не менялся.
- Новые фичи не добавлялись.

## Проверка

```bash
cd /root/ai-financer/backend
npm run build
npx prisma migrate deploy
npx prisma migrate status
npm run audit:final
pm2 restart ai-financer --update-env
pm2 save

cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run predeploy:full
```

## Runtime checks

1. Запрос на `/api/payments/telegram/webhook` без `x-telegram-bot-api-secret-token` должен отклоняться.
2. Если confirm/cancel упал из-за сети, повторная попытка должна снова работать.
3. Обычный расход до 5000 не должен уходить в лишний pending, если команда понятная и счёт определён.
4. Voice confirm modal должен показывать RU/EN тексты из словаря.

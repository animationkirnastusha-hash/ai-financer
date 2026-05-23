# Backend base testing guide for testers

## Быстрый запуск

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

Токен создавать вручную больше не нужно: runner сам создаст тестового пользователя и сохранит `.test-auth-token`, если токена нет.

## Явное создание токена

```bash
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:token
```

## Отчёты

```text
test-results/base-ai-regression-*.md
test-results/base-ai-regression-*.json
```

## Что проверяется

- auth;
- базовые read endpoints;
- accounts/transactions/sections/categories/goals/budgets/recurring;
- settings/onboarding/progression/referral/notifications;
- admin endpoints;
- AI create/update/cancel/confirm flows;
- безопасное изменение последнего дохода без дубля;
- лимит 3 действий для базовой версии.

Тестовый runner не парсит финансовые команды. Он отправляет текст в backend и проверяет результат через API.

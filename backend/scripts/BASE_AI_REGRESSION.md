# Base AI regression suite

## Исправленный запуск без ручной вставки токена

Теперь `npm run test:base-ai` сам создаёт тестового пользователя и JWT, если токен не передан и файла `.test-auth-token` нет.

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

Отдельно создать токен можно так:

```bash
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:token
```

Скрипт сохранит:

```text
.test-auth-token
.test-auth-token.env
```

Если хочешь передать токен вручную:

```bash
TEST_AUTH_TOKEN="PASTE_TOKEN" TEST_ADMIN=1 npm run test:base-ai
```

Не вставляй токен отдельной строкой без `export`; bash не передаст его в npm-процесс.

## Важно

Это black-box тесты. Они не являются финансовым command-parser и не меняют production AI pipeline.

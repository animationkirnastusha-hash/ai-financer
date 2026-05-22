# AI-Financer Product Tests

Скрипт `scripts/run-product-tests.mjs` гоняет API как внешний пользователь: через HTTP, JWT и реальные endpoints. Он не подменяет backend-сервисы и не использует текстовые парсеры команд. AI-команды отправляются в `/api/ai/parse` обычным человеческим текстом.

## Что проверяется

- health endpoint;
- auth login/me;
- core read endpoints;
- счета: создать, изменить, список, баланс;
- разделы и категории: создать, изменить, переместить;
- операции: расход, доход, перевод, изменение, статистика, latest;
- цели: создать, изменить, список;
- referral info;
- product analytics event;
- admin access rule;
- AI commands:
  - создать счёт;
  - переименовать счёт;
  - сделать счёт основным;
  - создать цель;
  - создать раздел;
  - создать категорию в разделе;
  - показать категории и разделы;
  - создать расход через естественную команду;
  - off-topic ответ без финансового действия;
  - delete-all guard, только при явном `TEST_DESTRUCTIVE=1`.

## Локальный запуск

Если backend запущен локально в development mode:

```bash
cd backend
npm run test:product
```

По умолчанию скрипт бьёт в:

```text
http://127.0.0.1:3000/api
```

## Запуск против сервера Selectel

На production-like сервере dev-login обычно выключен, поэтому нужен JWT пользователя.

PowerShell:

```powershell
cd backend
$env:TEST_BASE_URL="https://YOUR_BACKEND_DOMAIN/api"
$env:TEST_AUTH_TOKEN="PASTE_JWT_HERE"
$env:TEST_ADMIN="1"
npm run test:product
```

Bash:

```bash
cd backend
TEST_BASE_URL="https://YOUR_BACKEND_DOMAIN/api" \
TEST_AUTH_TOKEN="PASTE_JWT_HERE" \
TEST_ADMIN=1 \
npm run test:product
```

JWT можно временно взять из frontend localStorage после входа в Telegram WebApp. Не отправляй этот токен в чат и не коммить его.

## Важные env

```text
TEST_BASE_URL         API base URL. Default: http://127.0.0.1:3000/api
TEST_HEALTH_URL       Optional health URL. Default is inferred from TEST_BASE_URL.
TEST_AUTH_TOKEN       JWT. Required outside development login.
TEST_AI               1/0. Default: 1.
TEST_ADMIN            1/0. Set 1 if token belongs to admin.
TEST_DESTRUCTIVE      1/0. Default: 0. Runs high-risk AI delete-all confirmation test.
TEST_KEEP_DATA        1/0. Default: 0. Keeps created test entities.
TEST_TIMEOUT_MS       Default: 25000.
```

## Отчёты

После запуска создаются:

```text
backend/test-results/product-smoke-*.md
backend/test-results/product-smoke-*.json
```

Если что-то упало, пришли `.md`-отчёт или конкретную ошибку из консоли.

## Безопасность

Скрипт создаёт сущности с префиксом `Автотест ...` и удаляет их в конце. Команда `удали все счета` не выполняется по умолчанию. Она проверяется только как high-risk preview/confirmation guard при `TEST_DESTRUCTIVE=1`.

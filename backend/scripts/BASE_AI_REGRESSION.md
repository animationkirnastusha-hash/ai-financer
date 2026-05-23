# Base AI regression suite

Этот сценарий нужен перед передачей базовой версии тестерам и перед началом Premium-разработки.

Он проверяет backend через HTTP, как внешний клиент:

- health/auth;
- чтение основных endpoints;
- ручной CRUD: счета, разделы, категории, операции, цели, бюджеты, регулярные платежи;
- настройки AI, onboarding, referral, progression, companion, premium capabilities;
- admin endpoints, если токен админский;
- AI-команды базовой версии через настоящий `/api/ai/parse` + `/api/ai/confirm`;
- pending cancel;
- запрет на 4+ действия в одном запросе для базовой версии;
- защиту от критического бага: “измени последний доход” не должен создавать новый доход.

## Важно

Скрипт не является production parser. Он не добавляет парсеры в приложение. Он отправляет обычные текстовые команды в backend и проверяет результат через API.

Production-логика должна оставаться такой:

```text
AI planner → tool contract → validator → executor
```

Без regex/ручного извлечения суммы, счёта, категории, раздела, цели или смысла команды из текста.

## Подготовка токена после сброса базы

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:token
```

Скопируй JWT из вывода.

## Основной запуск

```bash
cd /root/ai-financer/backend

TEST_BASE_URL="http://localhost:3000/api" \
TEST_HEALTH_URL="http://localhost:3000/health" \
TEST_AUTH_TOKEN="ВСТАВЬ_НОВЫЙ_ТОКЕН" \
TEST_ADMIN="1" \
npm run test:base-ai
```

## Мягкий режим, если AI нестабилен из-за модели/API

```bash
TEST_STRICT_AI=0 npm run test:base-ai
```

В этом режиме AI-ошибки попадут в warnings, а не всегда будут валить весь прогон.

## Без AI, только backend CRUD/read endpoints

```bash
TEST_AI=0 npm run test:base-ai
```

## Опасные destructive-тесты

По умолчанию команда “удали все счета” не исполняется. Она только проверяется как high-risk/pending, если включить isolated DB.

```bash
TEST_DESTRUCTIVE=1 npm run test:base-ai
```

Включать только на отдельной тестовой базе.

## Отчёты

После каждого запуска создаются файлы:

```text
test-results/base-ai-regression-*.md
test-results/base-ai-regression-*.json
```

Markdown-отчёт можно отправлять тестерам или использовать как чек-лист регрессии.

# Base AI regression suite

Запуск полного backend-regression для базовой версии:

```bash
cd /root/ai-financer/backend
TEST_BASE_URL="http://localhost:3000/api" \
TEST_HEALTH_URL="http://localhost:3000/health" \
TEST_TELEGRAM_ID=516730814 \
TEST_ADMIN=1 \
npm run test:base-ai
```

Runner сам создаёт тестовый JWT, если `TEST_AUTH_TOKEN` и `.test-auth-token` отсутствуют.

По умолчанию runner делает финансовый reset тестового пользователя перед прогоном и отдельный reset перед AI mutation-тестами. Отключить можно так:

```bash
TEST_RESET_BEFORE=0 npm run test:base-ai
```

AI-запросы выполняются с задержкой и retry на `TOO_MANY_REQUESTS`, чтобы тесты не падали из-за rate-limit cooldown. Настройки:

```bash
TEST_AI_DELAY_MS=900
TEST_AI_RETRY_MAX=6
TEST_AI_LIMIT_RESET_MS=65000
```

Финансовых парсеров в тестах нет. Runner отправляет естественный текст в backend и проверяет состояние через API.

# Base AI regression suite

Консольный black-box suite для базовой версии Ai-financer. Он проверяет backend API и AI lifecycle через реальные HTTP-запросы.

Запуск:

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:base-ai
```

Runner сам создаёт тестовый JWT, если `TEST_AUTH_TOKEN` и `.test-auth-token` отсутствуют.

Важно: runner не парсит финансовые команды. Он отправляет текст в backend так же, как клиент. Production-обработка остаётся через `AI planner → tool contract → validator → executor`.

Что исправлено в patch-66:

- подтверждение AI-действий стало устойчивее: если backend вернул `batch executed=false` и pending action, runner подтверждает действие даже при некорректном флаге `requiresConfirmation`;
- тест создания счёта стал явно задавать тип, название, валюту и баланс;
- goals/budgets/recurring/analytics используют реальные backend contracts;
- отчёт по AI create account теперь показывает prepared и confirmed, если счёт не создан.

# Predeploy audit report

Generated: 2026-06-08T19:55:05.628Z

## Summary

- Hardcoded Russian candidates: 2072
- Technical/user-visible word candidates: 217
- Translation key leak candidates: 15
- CSS structure findings: 0
- Large files: 12
- Env leaks: 0

## Hardcoded Russian candidates
| file | line | text |
| --- | --- | --- |
| src/features/ai-core/ui/AIAssistantDock.tsx | 28 | aria-label="Открыть Фину" |
| src/features/ai-core/ui/AICoreOrb.tsx | 101 | <CompanionButton size="lg" mood={moodFromState(state, isActive, isVoiceLocked)} label="Фина" tabIndex={-1} /> |
| src/features/ai-core/ui/AIMenuSheet.tsx | 48 | <div className="text-sm font-medium text-white">Текстовый ввод</div> |
| src/features/ai-core/ui/AIMenuSheet.tsx | 59 | <div className="text-sm font-medium text-white">Показать команды</div> |
| src/features/ai-core/ui/AIMenuSheet.tsx | 70 | <div className="text-sm font-medium text-white">Голосовой режим</div> |
| src/features/audit-log/lib/formatAuditLogItem.ts | 18 | return `Выполнено AI-действие${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`; |
| src/features/audit-log/lib/formatAuditLogItem.ts | 20 | return 'AI выполнил действие'; |
| src/features/audit-log/lib/formatAuditLogItem.ts | 25 | return `Ожидает подтверждения${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`; |
| src/features/audit-log/lib/formatAuditLogItem.ts | 27 | return 'AI ожидает подтверждения'; |
| src/features/audit-log/lib/formatAuditLogItem.ts | 32 | return `Подготовлен черновик${categoryName ? ` · ${categoryName}` : ''}${amount ? ` · ${amount}` : ''}`; |
| src/features/audit-log/lib/formatAuditLogItem.ts | 34 | return 'AI подготовил черновик действия'; |
| src/features/audit-log/ui/AuditLogCard.tsx | 20 | if (status === 'executed') return 'Выполнено'; |
| src/features/audit-log/ui/AuditLogCard.tsx | 21 | if (status === 'pending_confirmation') return 'Ожидает подтверждения'; |
| src/features/audit-log/ui/AuditLogCard.tsx | 22 | if (status === 'previewed') return 'Черновик'; |
| src/features/audit-log/ui/AuditLogCard.tsx | 23 | if (status === 'failed') return 'Ошибка'; |
| src/features/audit-log/ui/AuditLogCard.tsx | 24 | if (status === 'cancelled') return 'Отменено'; |
| src/features/audit-log/ui/AuditLogCard.tsx | 25 | if (status === 'undone') return 'Откачено'; |
| src/features/audit-log/ui/AuditLogCard.tsx | 27 | return status \|\| 'Неизвестно'; |
| src/features/auth/model/auth.store.ts | 106 | : 'Не удалось авторизоваться', |
| src/features/auth/model/auth.store.ts | 132 | error: error instanceof Error ? error.message : 'Код входа не подошёл', |
| src/features/chat/lib/chatMessage.ts | 14 | text = 'Думаю...', |
| src/features/chat/lib/formatAIMessage.ts | 18 | return `Записал расход ${amount}${categoryName ? ` · ${categoryName}` : ''}.`; |
| src/features/chat/lib/formatAIMessage.ts | 22 | return `Подготовил расход ${amount}${categoryName ? ` · ${categoryName}` : ''}${description ? ` · ${description}` : ''}.`; |
| src/features/chat/lib/formatAIMessage.ts | 28 | return `Записал доход ${amount}.`; |
| src/features/chat/lib/formatAIMessage.ts | 32 | return `Подготовил доход ${amount}.`; |
| src/features/chat/lib/formatAIMessage.ts | 38 | return `Выполнил перевод ${amount}.`; |
| src/features/chat/lib/formatAIMessage.ts | 42 | return `Подготовил перевод ${amount}.`; |
| src/features/chat/model/useChatController.ts | 132 | const assistantText = response.message \|\| 'Готово'; |
| src/features/chat/model/useChatController.ts | 180 | text: 'Связь нестабильна. Команда не выполнена, повтори позже или отправь текстом ещё раз.', |
| src/features/chat/model/useChatController.ts | 181 | content: 'Связь нестабильна. Команда не выполнена, повтори позже или отправь текстом ещё раз.', |
| src/features/chat/model/useChatController.ts | 201 | const assistantText = response?.message \|\| '✅ Действие подтверждено.'; |
| src/features/chat/model/useChatController.ts | 220 | text: 'Не удалось подтвердить действие. Возможно, оно уже выполнено, отменено или истекло.', |
| src/features/chat/model/useChatController.ts | 221 | content: 'Не удалось подтвердить действие. Возможно, оно уже выполнено, отменено или истекло.', |
| src/features/chat/model/useChatController.ts | 242 | const assistantText = response?.message \|\| 'Действие отменено.'; |
| src/features/chat/model/useChatController.ts | 271 | const assistantText = response?.message \|\| '↩️ Операция отменена.'; |
| src/features/chat/model/useChatController.ts | 294 | text: 'Не удалось отменить операцию. Возможно, она уже отменена или изменена.', |
| src/features/chat/model/useChatController.ts | 295 | content: 'Не удалось отменить операцию. Возможно, она уже отменена или изменена.', |
| src/features/chat/ui/AIStatusBar.tsx | 28 | ? `AI подготовил ${pendingCount} ${pendingCount === 1 ? 'действие' : 'действия'} для проверки` |
| src/features/chat/ui/AIStatusBar.tsx | 29 | : 'AI готов: можно писать расходы, доходы, счета, категории и разделы'} |
| src/features/chat/ui/AIStatusBar.tsx | 51 | {pendingCount > 0 ? `${pendingCount} на проверке` : 'Нет действий'} |
| src/features/chat/ui/ChatScreen.tsx | 56 | : 'нет событий'; |
| src/features/chat/ui/Composer.tsx | 26 | placeholder="Напиши, что нужно сделать..." |
| src/features/chat/ui/FinancePreviewCard.tsx | 106 | {isConfirming ? 'Выполняю...' : 'Подтвердить'} |
| src/features/chat/ui/FinancePreviewCard.tsx | 110 | {isCancelling ? 'Отменяю...' : 'Отмена'} |
| src/features/chat/ui/TextChatOverlay.tsx | 39 | const cleanName = normalizeForWake(companionName \|\| 'Фина'); |
| src/features/chat/ui/TextChatOverlay.tsx | 40 | const aliases = Array.from(new Set([cleanName, 'фина', 'финна', 'фину', 'фине', 'финой', 'fina'].filter(Boolean))); |
| src/features/chat/ui/TextChatOverlay.tsx | 70 | ?? accounts.find((account) => String(account.name ?? '').toLowerCase().includes('нал')) |
| src/features/chat/ui/TextChatOverlay.tsx | 71 | ?? accounts.find((account) => String(account.name ?? '').toLowerCase().includes('карт')) |
| src/features/chat/ui/TextChatOverlay.tsx | 82 | const [voiceHint, setVoiceHint] = useState<string \| null>(mode === 'voice' ? 'Слушаю' : null); |
| src/features/chat/ui/TextChatOverlay.tsx | 106 | const companionName = useSettingsStore((state) => state.companionName \|\| 'Фина'); |
| src/features/chat/ui/TextChatOverlay.tsx | 140 | setVoiceHint('Не расслышала'); |
| src/features/chat/ui/TextChatOverlay.tsx | 143 | setVoiceHint('Думаю'); |
| src/features/chat/ui/TextChatOverlay.tsx | 173 | const latestTitle = latest?.title \|\| latest?.description \|\| 'последнюю операцию'; |
| src/features/chat/ui/TextChatOverlay.tsx | 176 | accountName ? `расход 300 кофе с ${accountName}` : 'расход 300 кофе', |
| src/features/chat/ui/TextChatOverlay.tsx | 177 | accountName ? `доход 5000 на ${accountName}` : 'доход 5000', |
| src/features/chat/ui/TextChatOverlay.tsx | 178 | accountName ? `поставь лимит на ${accountName} 20000 в месяц` : 'поставь общий лимит расходов 80000 в месяц', |
| src/features/chat/ui/TextChatOverlay.tsx | 179 | 'покажи лимиты', |
| src/features/chat/ui/TextChatOverlay.tsx | 180 | 'создай цель отпуск 120000', |
| src/features/chat/ui/TextChatOverlay.tsx | 183 | if (latest?.id && latestAmount) prompts.unshift(`измени ${latestTitle} на ${latestAmount}`); |
| src/features/chat/ui/TextChatOverlay.tsx | 199 | setVoiceHint('Распознаю'); |
| src/features/chat/ui/TextChatOverlay.tsx | 214 | setVoiceHint('Слушаю'); |
| src/features/chat/ui/TextChatOverlay.tsx | 230 | setVoiceHint('Нужен доступ к микрофону'); |
| src/features/chat/ui/TextChatOverlay.tsx | 232 | setVoiceHint('Секунду'); |
| src/features/chat/ui/TextChatOverlay.tsx | 234 | setVoiceHint('Не удалось начать запись'); |
| src/features/chat/ui/TextChatOverlay.tsx | 282 | setVoiceHint('Думаю'); |
| src/features/commands/model/commandCatalog.ts | 12 | label: 'Добавить расход', |
| src/features/commands/model/commandCatalog.ts | 13 | description: 'AI поймёт сумму, категорию и счёт из обычной фразы.', |
| src/features/commands/model/commandCatalog.ts | 14 | command: 'кофе 300', |
| src/features/commands/model/commandCatalog.ts | 19 | label: 'Добавить доход', |
| src/features/commands/model/commandCatalog.ts | 20 | description: 'AI покажет проверку и попросит подтверждение, если оно нужно.', |
| src/features/commands/model/commandCatalog.ts | 21 | command: 'доход 50000 на основной счет', |
| src/features/commands/model/commandCatalog.ts | 26 | label: 'Перевести деньги', |
| src/features/commands/model/commandCatalog.ts | 27 | description: 'AI подготовит безопасное действие с подтверждением.', |
| src/features/commands/model/commandCatalog.ts | 28 | command: 'переведи 3000 с карты на накопительный', |
| src/features/commands/model/commandCatalog.ts | 33 | label: 'Создать цель', |
| src/features/commands/model/commandCatalog.ts | 34 | description: 'Цели можно создать голосом или вручную.', |
| src/features/commands/model/commandCatalog.ts | 35 | command: 'создай цель отпуск 120000', |
| src/features/commands/model/commandCatalog.ts | 40 | label: 'Переименовать счёт', |
| src/features/commands/model/commandCatalog.ts | 41 | description: 'AI изменит существующий счёт, а не создаст новый.', |
| src/features/commands/model/commandCatalog.ts | 42 | command: 'переименуй счет карта в основная карта', |
| src/features/commands/model/commandCatalog.ts | 47 | label: 'Удалить все счета', |
| src/features/commands/model/commandCatalog.ts | 48 | description: 'Опасное действие. AI обязательно покажет подтверждение.', |
| src/features/commands/model/commandCatalog.ts | 49 | command: 'удали все счета', |
| src/features/commands/model/commandCatalog.ts | 54 | label: 'Создать счёт', |
| src/features/commands/model/commandCatalog.ts | 55 | description: 'Счета можно создавать через AI без поиска нужной формы.', |
| src/features/commands/model/commandCatalog.ts | 56 | command: 'создай счет отпуск', |
| src/features/commands/model/commandCatalog.ts | 61 | label: 'Сделать счёт основным', |
| src/features/commands/model/commandCatalog.ts | 62 | description: 'Настройки финансов доступны обычным языком.', |
| src/features/commands/model/commandCatalog.ts | 63 | command: 'сделай наличку основной', |
| src/features/commands/model/commandCatalog.ts | 68 | label: 'Включить строгий режим', |
| src/features/commands/model/commandCatalog.ts | 69 | description: 'AI-поведение можно менять без ручного поиска настроек.', |
| src/features/commands/model/commandCatalog.ts | 70 | command: 'включи строгий финансовый режим', |
| src/features/commands/model/commandCatalog.ts | 75 | label: 'Спросить статистику', |
| src/features/commands/model/commandCatalog.ts | 76 | description: 'Базовая аналитика остаётся понятной и не похожей на BI-панель.', |
| src/features/commands/model/commandCatalog.ts | 77 | command: 'сколько я потратил за неделю', |
| src/features/commands/model/commandCatalog.ts | 82 | label: 'Сравнить месяцы', |
| src/features/commands/model/commandCatalog.ts | 83 | description: 'AI помогает увидеть финансовую динамику человеческим языком.', |
| src/features/commands/model/commandCatalog.ts | 84 | command: 'сравни этот месяц с прошлым', |
| src/features/commands/model/commandCatalog.ts | 89 | label: 'Открыть главную', |
| src/features/commands/model/commandCatalog.ts | 90 | description: 'Быстрый переход к живой финансовой сводке.', |
| src/features/commands/model/commandCatalog.ts | 91 | command: 'покажи главную', |
| src/features/commands/model/commandCatalog.ts | 96 | label: 'Открыть операции', |
| src/features/commands/model/commandCatalog.ts | 97 | description: 'Переход к истории операций.', |
| src/features/commands/model/commandCatalog.ts | 98 | command: 'покажи историю операций', |
| src/features/commands/model/commandCatalog.ts | 103 | label: 'Открыть счета', |
| src/features/commands/model/commandCatalog.ts | 104 | description: 'Быстрый переход к счетам и балансам.', |
| src/features/commands/model/commandCatalog.ts | 105 | command: 'открой мои счета', |
| src/features/commands/model/commandCatalog.ts | 110 | label: 'Открыть аналитику', |
| src/features/commands/model/commandCatalog.ts | 111 | description: 'Переход к понятной финансовой аналитике.', |
| src/features/commands/model/commandCatalog.ts | 112 | command: 'покажи аналитику', |
| src/features/commands/model/commandCatalog.ts | 117 | label: 'Открыть цели', |
| src/features/commands/model/commandCatalog.ts | 118 | description: 'Переход к спокойным долгосрочным целям.', |
| src/features/commands/model/commandCatalog.ts | 119 | command: 'открой цели', |
| src/features/commands/model/commandCatalog.ts | 124 | label: 'Открыть помощника', |
| src/features/commands/model/commandCatalog.ts | 125 | description: 'Переход к помощнику.', |
| src/features/commands/model/commandCatalog.ts | 126 | command: 'открой помощника', |
| src/features/commands/model/commandCatalog.ts | 131 | label: 'Открыть настройки', |
| src/features/commands/model/commandCatalog.ts | 132 | description: 'Переход к настройкам AI, голоса и финансов.', |
| src/features/commands/model/commandCatalog.ts | 133 | command: 'открой настройки', |
| src/features/commands/model/commandCatalog.ts | 138 | label: 'Открыть разделы и категории', |
| src/features/commands/model/commandCatalog.ts | 139 | description: 'Переход во вложенную настройку структуры финансов.', |
| src/features/commands/model/commandCatalog.ts | 140 | command: 'открой разделы и категории', |
| src/features/commands/ui/CommandListSheet.tsx | 4 | money: 'Деньги', |
| src/features/commands/ui/CommandListSheet.tsx | 5 | organization: 'Структура', |
| src/features/commands/ui/CommandListSheet.tsx | 6 | analysis: 'Аналитика', |
| src/features/commands/ui/CommandListSheet.tsx | 7 | navigation: 'Навигация', |
| src/features/commands/ui/CommandListSheet.tsx | 8 | settings: 'Настройки', |
| src/features/companion/ui/CompanionPresence.tsx | 32 | const message = state?.message \|\| 'Готова помогать с расходами, счетами, целями и привычками.'; |
| src/features/companion/ui/CompanionPresence.tsx | 36 | if (streak >= 7) return `Серия ${streak} дней. XP копится быстрее.`; |
| src/features/companion/ui/CompanionPresence.tsx | 37 | if (xp > 0) return `До следующего уровня: ${Math.max(0, nextLevelBase - xp)} XP.`; |
| src/features/companion/ui/CompanionPresence.tsx | 38 | return 'XP появится после первых действий.'; |
| src/features/companion/ui/CompanionPresence.tsx | 42 | return <CompanionButton mood={state?.mood ?? 'idle'} onClick={() => navigateTo('companion')} label="Помощник" />; |
| src/features/companion/ui/CompanionPresence.tsx | 48 | <button type="button" className="app-companion-presence__avatar" onClick={() => navigateTo('companion')} aria-label="Открыть помощника"> |
| src/features/companion/ui/CompanionPresence.tsx | 49 | <CompanionButton size="lg" mood={state?.mood ?? 'idle'} label="Помощник" /> |
| src/features/companion/ui/CompanionPresence.tsx | 53 | <div className="app-eyebrow">Помощник</div> |
| src/features/companion/ui/CompanionPresence.tsx | 54 | <div className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white">Финансовый компаньон</div> |
| src/features/companion/ui/CompanionPresence.tsx | 59 | <span>Уровень {level}</span> |
| src/features/companion/ui/CompanionPresence.tsx | 64 | <div className="app-xp-panel__future">Скоро XP станет ресурсом</div> |
| src/features/companion/ui/CompanionPresence.tsx | 70 | <button type="button" onClick={() => navigateTo('companion')} className="app-secondary-button">Открыть прогресс</button> |
| src/features/currency/lib/currency.ts | 11 | { code: 'RUB', label: 'Российский рубль', symbol: '₽', countries: ['RU'] }, |
| src/features/currency/lib/currency.ts | 12 | { code: 'USD', label: 'Доллар США', symbol: '$', countries: ['US'] }, |
| src/features/currency/lib/currency.ts | 13 | { code: 'EUR', label: 'Евро', symbol: '€', countries: ['DE', 'FR', 'ES', 'IT', 'FI', 'NL', 'PT', 'AT', 'BE', 'IE', 'LV', 'LT', 'EE'] }, |
| src/features/currency/lib/currency.ts | 14 | { code: 'KZT', label: 'Казахстанский тенге', symbol: '₸', countries: ['KZ'] }, |
| src/features/currency/lib/currency.ts | 15 | { code: 'UZS', label: 'Узбекский сум', symbol: 'soʻm', countries: ['UZ'] }, |
| src/features/currency/lib/currency.ts | 16 | { code: 'KGS', label: 'Кыргызский сом', symbol: 'с', countries: ['KG'] }, |
| src/features/currency/lib/currency.ts | 17 | { code: 'AMD', label: 'Армянский драм', symbol: '֏', countries: ['AM'] }, |
| src/features/currency/lib/currency.ts | 18 | { code: 'GEL', label: 'Грузинский лари', symbol: '₾', countries: ['GE'] }, |
| src/features/currency/lib/currency.ts | 19 | { code: 'AZN', label: 'Азербайджанский манат', symbol: '₼', countries: ['AZ'] }, |
| src/features/currency/lib/parseCurrencyIntent.ts | 9 | return text.toLowerCase().replace(/[ё]/g, 'е').replace(/[^a-zа-я0-9\s$€₽]/gi, ' ').replace(/\s+/g, ' ').trim(); |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 61 | if (period === 'day') return 'День'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 62 | if (period === 'week') return 'Неделя'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 63 | return 'Месяц'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 67 | return mode === 'expense' ? 'Расходы' : 'Доходы'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 101 | const categoryName = item.category?.name?.trim() \|\| (mode === 'expense' ? 'Без категории' : 'Доходы'); |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 102 | const sectionName = item.category?.section?.name?.trim() \|\| item.section?.name?.trim() \|\| 'Без раздела'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 119 | const categoryName = item.category?.name?.trim() \|\| (mode === 'expense' ? 'Без категории' : 'Доходы'); |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 120 | const sectionName = item.category?.section?.name?.trim() \|\| item.section?.name?.trim() \|\| 'Без раздела'; |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 61 | name: 'Все деньги', |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 64 | caption: accounts.length ? `${accounts.length} сч.` : 'счета ещё не созданы', |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 74 | caption: account.type === 'cash' ? 'наличные' : account.type === 'card' ? 'карта' : account.type === 'savings' ? 'накопления' : 'счёт', |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 102 | <div className="app-eyebrow">Баланс</div> |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 107 | <button type="button" onClick={() => go(-1)} aria-label="Предыдущий счёт">‹</button> |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 108 | <span>{active.kind === 'total' ? 'Итого' : active.currency}</span> |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 109 | <button type="button" onClick={() => go(1)} aria-label="Следующий счёт">›</button> |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 116 | <div className="app-home-metric"><span>Доходы</span><b>{formatMoney(income, mainCurrency, { sign: 'plus' })}</b></div> |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 117 | <div className="app-home-metric"><span>Расходы</span><b>{formatMoney(expenses, mainCurrency, { sign: 'minus' })}</b></div> |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 118 | <div className="app-home-metric"><span>Итог</span><b>{formatMoney(delta, mainCurrency, { sign: 'auto' })}</b></div> |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 125 | <button type="button" onClick={onOpenAccounts}>Открыть счета</button> |
| src/features/dashboard/ui/HomeCashflowChart.tsx | 37 | <div className="app-eyebrow">Траты и доходы</div> |
| src/features/dashboard/ui/HomeCashflowChart.tsx | 48 | <button type="button" data-active={mode === 'expense'} onClick={() => onModeChange('expense')}>Расходы</button> |
| src/features/dashboard/ui/HomeCashflowChart.tsx | 49 | <button type="button" data-active={mode === 'income'} onClick={() => onModeChange('income')}>Доходы</button> |
| src/features/dashboard/ui/HomeCashflowChart.tsx | 52 | <button type="button" className="app-home-chart-preview" onClick={onOpenDetails} aria-label="Открыть диаграмму"> |
| src/features/dashboard/ui/HomeCashflowChart.tsx | 57 | <b>{hasData ? formatMoney(analytics.total, 'RUB', { sign: mode === 'expense' ? 'minus' : 'plus' }) : 'Пока пусто'}</b> |
| src/features/dashboard/ui/HomeCashflowChart.tsx | 58 | <small>{hasData && primary ? `${primary.name} — ${primary.percent}%` : 'Добавь первую операцию за выбранный период'}</small> |
| src/features/dashboard/ui/HomeCashflowChart.tsx | 63 | {mode === 'expense' ? 'Добавить расход' : 'Добавить доход'} |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 7 | return transaction.title \|\| transaction.description \|\| transaction.category?.name \|\| 'Операция'; |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 39 | <p>{sorted.length} опер. · {formatMoney(total \|\| group.amount, 'RUB')}</p> |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 41 | <button type="button" className="app-icon-button" onClick={onClose} aria-label="Закрыть">×</button> |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 46 | <div className="app-empty-button">Операций в этой категории больше нет.</div> |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 53 | <div className="mt-1 truncate text-xs text-white/40">{formatTransactionDate(transaction.date)} · {transaction.account?.name ?? 'Счёт'}</div> |
| src/features/dashboard/ui/HomeChartDetailsModal.tsx | 32 | <p>{analytics.total > 0 ? formatMoney(analytics.total, 'RUB') : 'Операций пока нет'}</p> |
| src/features/dashboard/ui/HomeChartDetailsModal.tsx | 34 | <button type="button" className="app-icon-button" onClick={onClose} aria-label="Закрыть">×</button> |
| src/features/dashboard/ui/HomeChartDetailsModal.tsx | 42 | <button type="button" onClick={(event) => { event.stopPropagation(); onOpenAnalytics(); }}>Открыть полную аналитику</button> |
| src/features/dashboard/ui/HomeChartDetailsModal.tsx | 43 | <button type="button" onClick={(event) => { event.stopPropagation(); onOpenReport(); }}>Скачать отчёт</button> |
| src/features/dashboard/ui/HomeChartDetailsModal.tsx | 48 | <div className="app-empty-button">Добавь первую операцию — здесь появится разбор по категориям.</div> |
| src/features/dashboard/ui/HomeChartDetailsModal.tsx | 54 | <small>{group.sectionName} · {group.count} опер.</small> |
| src/features/dashboard/ui/HomeFinanceInsight.tsx | 18 | ? `${modeLabel(mode)} за период “${periodLabel(period).toLowerCase()}”: ${formatMoney(analytics.total, 'RUB')}. Больше всего — ${first.name}.` |
| src/features/dashboard/ui/HomeFinanceInsight.tsx | 19 | : `За выбранный период пока нет ${mode === 'expense' ? 'расходов' : 'доходов'}.`; |
| src/features/dashboard/ui/HomeFinanceInsight.tsx | 23 | <div className="app-eyebrow">Вывод Фины</div> |
| src/features/goals/ui/GoalEditSheet.tsx | 39 | setError('Укажи название и сумму цели.'); |
| src/features/goals/ui/GoalEditSheet.tsx | 54 | if (!window.confirm(`Удалить цель «${goal.title}»?`)) return; |
| src/features/goals/ui/GoalEditSheet.tsx | 63 | title={goal ? 'Цель' : 'Новая цель'} |
| src/features/goals/ui/GoalEditSheet.tsx | 64 | subtitle="Короткая форма. Можно также сказать: “создай цель отпуск 120000”." |
| src/features/goals/ui/GoalEditSheet.tsx | 67 | {goal && onDelete ? <Button variant="secondary" onClick={remove} disabled={isSaving}>Удалить</Button> : <Button variant="secondary" onClick={onClose} disabled={isSaving}>Отмена</Button>} |
| src/features/goals/ui/GoalEditSheet.tsx | 68 | <Button onClick={submit} disabled={!canSave}>{isSaving ? 'Сохраняю...' : 'Сохранить'}</Button> |
| src/features/goals/ui/GoalEditSheet.tsx | 74 | <span>Название</span> |
| src/features/goals/ui/GoalEditSheet.tsx | 75 | <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Отпуск" /> |
| src/features/goals/ui/GoalEditSheet.tsx | 79 | <span>Цель</span> |
| src/features/goals/ui/GoalEditSheet.tsx | 83 | <span>Сейчас</span> |
| src/features/goals/ui/GoalEditSheet.tsx | 88 | <span>Валюта</span> |

## Technical/user-visible word candidates
| file | line | word | text |
| --- | --- | --- | --- |
| src/app/providers/AuthBootstrap.tsx | 3 | api | import { authApi, type FallbackInfoResponse } from '@/features/chat/api/auth.api'; |
| src/app/providers/AuthBootstrap.tsx | 111 | target | target="_blank" |
| src/app/providers/AuthBootstrap.tsx | 127 | target | onChange={(event) => setCode(event.target.value)} |
| src/features/accounts/ui/AccountDetailsSheet.tsx | 2 | api | import type { AccountDto } from '@/features/accounts/api/accounts.api'; |
| src/features/accounts/ui/AccountTransferSheet.tsx | 3 | api | import type { AccountDto } from '@/features/accounts/api/accounts.api'; |
| src/features/accounts/ui/AccountTransferSheet.tsx | 137 | target | onChange={(event) => setAmount(event.target.value)} |
| src/features/accounts/ui/AccountTransferSheet.tsx | 147 | target | onChange={(event) => setDescription(event.target.value)} |
| src/features/accounts/ui/CreateAccountSheet.tsx | 93 | target | <input value={draft.name} disabled={isSubmitting} onChange={(event) => updateDraft({ name: event.target.value })} placeholder={t('accounts.create.namePlaceholder')} /> |
| src/features/accounts/ui/CreateAccountSheet.tsx | 120 | target | <input inputMode="decimal" value={draft.initialBalance} disabled={isSubmitting} onChange={(event) => updateDraft({ initialBalance: event.target.value })} placeholder="0" /> |
| src/features/accounts/ui/EditAccountModal.tsx | 2 | api | import type { AccountDto, UpdateAccountPayload } from '@/features/accounts/api/accounts.api'; |
| src/features/accounts/ui/EditAccountModal.tsx | 83 | target | <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent text-base outline-none" /> |
| src/features/accounts/ui/EditAccountModal.tsx | 88 | target | <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-transparent text-base outline-none"> |
| src/features/accounts/ui/EditAccountModal.tsx | 93 | target | <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-transparent text-base outline-none"> |
| src/features/accounts/ui/EditAccountModal.tsx | 100 | target | <input inputMode="numeric" value={balance} onChange={(e) => setBalance(e.target.value)} className="w-full bg-transparent text-base outline-none" /> |
| src/features/business-workspace/ui/BusinessSetupCard.tsx | 2 | api | import type { BusinessWorkspaceAccountDto, BusinessWorkspaceDto, BusinessProfileType } from '@/features/business-workspace/api/businessWorkspace.api'; |
| src/features/business-workspace/ui/BusinessSetupCard.tsx | 78 | target | <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t('business.setup.namePlaceholder')} /> |
| src/features/business-workspace/ui/BusinessSetupCard.tsx | 82 | target | <input value={taxMode} onChange={(event) => setTaxMode(event.target.value)} placeholder={t('business.setup.taxPlaceholder')} /> |
| src/features/business-workspace/ui/BusinessSetupCard.tsx | 86 | target | <select value={incomeAccountId} onChange={(event) => setIncomeAccountId(event.target.value)} disabled={!hasAccounts}> |
| src/features/business-workspace/ui/BusinessSetupCard.tsx | 93 | target | <select value={expenseAccountId} onChange={(event) => setExpenseAccountId(event.target.value)} disabled={!hasAccounts}> |
| src/features/business-workspace/ui/BusinessSetupCard.tsx | 100 | target | <input inputMode="numeric" value={monthlyIncomePlan} onChange={(event) => setMonthlyIncomePlan(event.target.value)} placeholder="150000" /> |
| src/features/business-workspace/ui/BusinessSetupCard.tsx | 104 | target | <input inputMode="numeric" value={monthlyExpensePlan} onChange={(event) => setMonthlyExpensePlan(event.target.value)} placeholder="70000" /> |
| src/features/business-workspace/ui/BusinessSetupCard.tsx | 108 | target | <input inputMode="numeric" value={reminderDay} onChange={(event) => setReminderDay(event.target.value)} placeholder="25" /> |
| src/features/business-workspace/ui/BusinessSummaryCards.tsx | 1 | api | import type { BusinessWorkspaceSummaryDto } from '@/features/business-workspace/api/businessWorkspace.api'; |
| src/features/chat/ui/ChatScreen.tsx | 11 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/chat/ui/Composer.tsx | 25 | target | onChange={(event) => setValue(event.target.value)} |
| src/features/chat/ui/TextChatOverlay.tsx | 564 | target | <input ref={receiptCameraInputRef} type="file" accept={RECEIPT_ACCEPTED_TYPES} capture="environment" className="sr-only" onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)} /> |
| src/features/chat/ui/TextChatOverlay.tsx | 565 | target | <input ref={receiptFileInputRef} type="file" accept={RECEIPT_ACCEPTED_TYPES} className="sr-only" onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)} /> |
| src/features/chat/ui/TextChatOverlay.tsx | 571 | target | onChange={(event) => setValue(event.target.value)} |
| src/features/companion/ui/CompanionPresence.tsx | 3 | api | import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api'; |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 2 | api | import type { AccountDto } from '@/features/accounts/api/accounts.api'; |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 35 | target | function conversionText(amount: number, from: AppCurrency, target: AppCurrency, rates: Rates) { |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 36 | target | if (from === target) return getCurrencyProfile(from).label; |
| src/features/dashboard/ui/HomeBalanceCarousel.tsx | 38 | target | return `≈ ${formatMoney(fromRub(rub, target, rates), target)}`; |
| src/features/dashboard/ui/HomeCashflowChart.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/dashboard/ui/HomeChartDetailsModal.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/dashboard/ui/HomeFinanceInsight.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/goals/ui/GoalEditSheet.tsx | 2 | api | import type { GoalDto } from '@/features/goals/api/goals.api'; |
| src/features/goals/ui/GoalEditSheet.tsx | 75 | target | <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Отпуск" /> |
| src/features/goals/ui/GoalEditSheet.tsx | 80 | target | <input inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="120000" /> |
| src/features/goals/ui/GoalEditSheet.tsx | 84 | target | <input inputMode="decimal" value={currentAmount} onChange={(event) => setCurrentAmount(event.target.value)} placeholder="0" /> |
| src/features/goals/ui/GoalEditSheet.tsx | 89 | target | <select value={currency} onChange={(event) => setCurrency(event.target.value)}> |
| src/features/goals/ui/GoalEditSheet.tsx | 97 | target | <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Для чего эта цель" /> |
| src/features/modals/ui/AccountModals.tsx | 5 | api | import type { AccountDto, UpdateAccountPayload } from '@/features/accounts/api/accounts.api'; |
| src/features/modals/ui/FinanceEntityModals.tsx | 1 | api | import { goalsApi } from '@/features/goals/api/goals.api'; |
| src/features/modals/ui/FinanceEntityModals.tsx | 5 | api | import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api'; |
| src/features/modals/ui/FinanceEntityModals.tsx | 9 | api | import type { DeleteTransactionBalanceMode, TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/modals/ui/HomeFinanceModals.tsx | 4 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/modals/ui/ObligationModals.tsx | 1 | api | import type { AccountDto } from '@/features/accounts/api/accounts.api'; |
| src/features/modals/ui/ObligationModals.tsx | 4 | api | import type { CreateLoanPayload, LoanDto, UpdateLoanPayload } from '@/features/obligations/api/obligations.api'; |
| src/features/modals/ui/UtilityModals.tsx | 1 | api | import type { AccountDto } from '@/features/accounts/api/accounts.api'; |
| src/features/modals/ui/UtilityModals.tsx | 2 | api | import type { CategoryDto } from '@/features/sections/api/sections.api'; |
| src/features/obligations/ui/LoanEditSheet.tsx | 3 | api | import type { AccountDto } from '@/features/accounts/api/accounts.api'; |
| src/features/obligations/ui/LoanEditSheet.tsx | 4 | api | import type { CreateLoanPayload, LoanDto, LoanType } from '@/features/obligations/api/obligations.api'; |
| src/features/obligations/ui/LoanEditSheet.tsx | 178 | target | onChange={(event) => setTitle(event.target.value)} |
| src/features/obligations/ui/LoanEditSheet.tsx | 188 | target | onChange={(event) => setCreditor(event.target.value)} |
| src/features/obligations/ui/LoanEditSheet.tsx | 195 | target | <select value={currency} onChange={(event) => setCurrency(event.target.value)}> |
| src/features/obligations/ui/LoanEditSheet.tsx | 236 | target | <input type="checkbox" checked={autoCreateExpense} onChange={(event) => setAutoCreateExpense(event.target.checked)} /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 254 | target | <input inputMode="numeric" value={currentDebt} onChange={(event) => setCurrentDebt(event.target.value)} placeholder="500000" /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 260 | target | <input inputMode="numeric" value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} placeholder={isSubscription ? '899' : '18000'} /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 266 | target | <input inputMode="numeric" value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} placeholder="700000" /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 282 | target | <input inputMode="decimal" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="12.9" /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 288 | target | <input inputMode="numeric" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} placeholder="36" /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 293 | target | <input inputMode="numeric" value={paidMonths} onChange={(event) => setPaidMonths(event.target.value)} placeholder="4" /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 307 | target | <input inputMode="numeric" value={paymentDay} onChange={(event) => setPaymentDay(event.target.value)} placeholder="15" /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 312 | target | <input type="date" value={nextPaymentDate} onChange={(event) => setNextPaymentDate(event.target.value)} /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 317 | target | <input inputMode="numeric" value={reminderDaysBefore} onChange={(event) => setReminderDaysBefore(event.target.value)} placeholder="1" /> |
| src/features/obligations/ui/LoanEditSheet.tsx | 324 | target | <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например: гасить досрочно при возможности" /> |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 4 | api | import { goalsApi } from '@/features/goals/api/goals.api'; |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 97 | target | onChange={(event) => setAccount(account.id, { enabled: event.target.checked })} |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 104 | target | <input value={account.name} onChange={(event) => setAccount(account.id, { name: event.target.value })} /> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 114 | target | onChange={(event) => setAccount(account.id, { balance: Number(event.target.value) \|\| 0 })} |
| src/features/onboarding/ui/steps/GoalsStep.tsx | 33 | target | <input value={goal.title} onChange={(event) => patchGoal({ title: event.target.value })} /> |
| src/features/onboarding/ui/steps/GoalsStep.tsx | 38 | target | <input type="number" min="0" inputMode="decimal" value={goal.targetAmount} onChange={(event) => patchGoal({ targetAmount: Number(event.target.value) \|\| 0 })} /> |
| src/features/onboarding/ui/steps/LoansStep.tsx | 43 | target | <input value={loan.title} onChange={(event) => patchLoan({ title: event.target.value })} /> |
| src/features/onboarding/ui/steps/LoansStep.tsx | 49 | target | <input type="number" min="0" inputMode="decimal" value={loan.remainingAmount} onChange={(event) => patchLoan({ remainingAmount: Number(event.target.value) \|\| 0 })} /> |
| src/features/onboarding/ui/steps/LoansStep.tsx | 53 | target | <input type="number" min="0" inputMode="decimal" value={loan.monthlyPayment} onChange={(event) => patchLoan({ monthlyPayment: Number(event.target.value) \|\| 0 })} /> |
| src/features/onboarding/ui/steps/LoansStep.tsx | 60 | target | <input type="number" min="1" max="31" inputMode="numeric" value={loan.paymentDay} onChange={(event) => patchLoan({ paymentDay: Math.max(1, Math.min(31, Number(event.target.value) \|\| 1)) })} /> |
| src/features/onboarding/ui/steps/LoansStep.tsx | 64 | target | <input type="number" min="0" inputMode="decimal" value={loan.rate ?? ''} onChange={(event) => patchLoan({ rate: Number(event.target.value) \|\| undefined })} /> |
| src/features/onboarding/ui/steps/PremiumTrialStep.tsx | 21 | feature | <div className="onboarding-feature-list"> |
| src/features/onboarding/ui/steps/RemindersStep.tsx | 45 | target | onChange={(event) => patchReminders({ [key]: event.target.checked })} |
| src/features/onboarding/ui/steps/VoiceSandboxStep.tsx | 16 | target | <input type="checkbox" checked={voice.voiceEnabled} onChange={(event) => patchVoice({ voiceEnabled: event.target.checked })} /> |
| src/features/onboarding/ui/steps/VoiceSandboxStep.tsx | 20 | target | <input type="checkbox" checked={voice.textFallbackEnabled} onChange={(event) => patchVoice({ textFallbackEnabled: event.target.checked })} /> |
| src/features/payments/api/payments.api.ts | 105 | mock | completeMock: (orderId: string) => apiClient.post<CompleteMockPaymentResult>(`/payments/orders/${encodeURIComponent(orderId)}/mock-complete`), |
| src/features/payments/ui/StorePaymentActions.tsx | 3 | api | import { paymentsApi, type StorePaymentCatalogDto, type StorePaymentDuration, type StorePaymentProduct, type StorePaymentProvider } from '@/features/payments/api/payments.api'; |
| src/features/payments/ui/StorePaymentActions.tsx | 93 | mock | if (provider === 'mock') { |
| src/features/payments/ui/StorePaymentActions.tsx | 175 | mock | <button type="button" className="store-payment-admin-access-button" disabled={isBusy \|\| !selected} onClick={() => createOrder('mock')}> |
| src/features/payments/ui/StorePaymentActions.tsx | 176 | mock | {isBusy && busyProvider === 'mock' ? t('store.payment.preparing') : t('store.payment.grantAccess')} |
| src/features/pending-actions/ui/PendingActionCard.tsx | 245 | target | onChange={(event) => updateActionField(index, field, event.target.value)} |
| src/features/premium/ui/PremiumFeatureGate.tsx | 7 | feature | feature: string; |
| src/features/premium/ui/PremiumFeatureGate.tsx | 14 | feature | export function PremiumFeatureGate({ feature, title, caption, children, className }: Props) { |
| src/features/premium/ui/PremiumFeatureGate.tsx | 18 | feature | const isAllowed = Boolean(subscription?.features?.[feature] \|\| subscription?.access.hasPremium \|\| subscription?.access.hasBusiness); |
| src/features/premium/ui/PremiumFeatureGate.tsx | 25 | feature | className={`premium-feature-gate ${className ?? ''}`.trim()} |
| src/features/premium/ui/PremiumFeatureGate.tsx | 33 | feature | <span className="premium-feature-gate__badge">{t('premium.gate.badge')}</span> |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 10 | feature | 'premium.sheet.feature.forecast', |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 11 | feature | 'premium.sheet.feature.reports', |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 12 | feature | 'premium.sheet.feature.receipts', |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 13 | feature | 'premium.sheet.feature.voice', |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 71 | feature | <div className="premium-upgrade-feature-grid"> |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 72 | feature | {sheetFeatures.map((feature) => ( |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 73 | feature | <div key={feature} className="premium-upgrade-feature"> |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 74 | feature | <div>{t(feature)}</div> |
| src/features/product-analytics/ui/ProductAnalyticsTracker.tsx | 4 | api | import { productAnalyticsApi } from '@/features/product-analytics/api/productAnalytics.api'; |
| src/features/receipt-scans/ui/ReceiptPreviewCard.tsx | 1 | api | import type { ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api'; |
| src/features/receipt-scans/ui/ReceiptQuickAction.tsx | 29 | usage | const remaining = subscription?.usage?.receiptScansThisMonth?.remaining; |
| src/features/receipt-scans/ui/ReceiptQuickAction.tsx | 64 | target | <input ref={cameraInputRef} type="file" accept={RECEIPT_ACCEPTED_TYPES} capture="environment" className="sr-only" onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)} /> |
| src/features/receipt-scans/ui/ReceiptQuickAction.tsx | 65 | target | <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPTED_TYPES} className="sr-only" onChange={(event) => void handleReceiptFile(event.target.files?.[0] ?? null)} /> |
| src/features/receipt-scans/ui/ReceiptScanList.tsx | 1 | api | import type { ReceiptScanDto } from '@/features/receipt-scans/api/receiptScans.api'; |
| src/features/receipt-scans/ui/ReceiptUploadCard.tsx | 46 | target | onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} |
| src/features/sections/ui/CategoryEditSheet.tsx | 2 | api | import type { CategoryDto, SectionDto } from '@/features/sections/api/sections.api'; |
| src/features/sections/ui/CategoryEditSheet.tsx | 74 | target | <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Кофе" autoFocus /> |
| src/features/sections/ui/CategoryEditSheet.tsx | 79 | target | <select value={sectionId ?? ''} onChange={(event) => setSectionId(event.target.value \|\| null)}> |
| src/features/sections/ui/CreateSectionSheet.tsx | 70 | target | onChange={(event) => setIcon(event.target.value)} |
| src/features/sections/ui/CreateSectionSheet.tsx | 78 | target | onChange={(event) => setName(event.target.value)} |
| src/features/sections/ui/CreateSectionSheet.tsx | 89 | target | onChange={(event) => setDescription(event.target.value)} |
| src/features/sections/ui/SectionCard.tsx | 1 | api | import type { SectionDto, CategoryDto } from '@/features/sections/api/sections.api'; |
| src/features/sections/ui/SectionEditSheet.tsx | 2 | api | import type { SectionDto } from '@/features/sections/api/sections.api'; |
| src/features/sections/ui/SectionEditSheet.tsx | 61 | target | <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Например, Дом" autoFocus /> |
| src/features/sections/ui/TaxonomySettingsPanel.tsx | 153 | target | onChange={(event) => setSectionIcon(event.target.value)} |
| src/features/sections/ui/TaxonomySettingsPanel.tsx | 160 | target | onChange={(event) => setSectionName(event.target.value)} |
| src/features/sections/ui/TaxonomySettingsPanel.tsx | 182 | target | onChange={(event) => setCategoryIcon(event.target.value)} |
| src/features/sections/ui/TaxonomySettingsPanel.tsx | 189 | target | onChange={(event) => setCategoryName(event.target.value)} |
| src/features/settings/ui/PlanCard.tsx | 49 | feature | {features.map((feature) => ( |
| src/features/settings/ui/PlanCard.tsx | 50 | feature | <div key={feature} className="text-sm text-white/75"> |
| src/features/settings/ui/PlanCard.tsx | 51 | feature | • {feature} |
| src/features/store/ui/StoreFeatureSection.tsx | 15 | feature | const handleFeatureClick = (feature: StoreFeature) => { |
| src/features/store/ui/StoreFeatureSection.tsx | 16 | feature | if (feature.title === 'store.features.receipts.title') { |
| src/features/store/ui/StoreFeatureSection.tsx | 23 | feature | title: t(feature.title), |
| src/features/store/ui/StoreFeatureSection.tsx | 24 | feature | description: t(feature.caption), |
| src/features/store/ui/StoreFeatureSection.tsx | 30 | feature | <section className="app-card monetization-section store-feature-section"> |
| src/features/store/ui/StoreFeatureSection.tsx | 38 | feature | <div className="store-feature-grid"> |
| src/features/store/ui/StoreFeatureSection.tsx | 39 | feature | {features.map((feature) => ( |
| src/features/store/ui/StoreFeatureSection.tsx | 40 | feature | <button type="button" key={feature.title} className="store-feature-card" onClick={() => handleFeatureClick(feature)}> |
| src/features/store/ui/StoreFeatureSection.tsx | 41 | feature | <strong>{t(feature.title)}</strong> |
| src/features/store/ui/StoreFeatureSection.tsx | 42 | feature | <span>{t(feature.caption)}</span> |
| src/features/store/ui/StoreStatusCard.tsx | 1 | api | import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api'; |
| src/features/store/ui/StoreTrialCard.tsx | 1 | api | import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api'; |
| src/features/store/ui/StoreUsageCard.tsx | 1 | api | import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api'; |
| src/features/store/ui/StoreUsageCard.tsx | 10 | usage | const usage = subscription?.usage; |
| src/features/store/ui/StoreUsageCard.tsx | 11 | usage | if (!usage) return null; |
| src/features/store/ui/StoreUsageCard.tsx | 14 | usage | <section className="app-card monetization-section store-usage-card"> |
| src/features/store/ui/StoreUsageCard.tsx | 17 | usage | <div className="app-eyebrow">{t('store.usage.eyebrow')}</div> |
| src/features/store/ui/StoreUsageCard.tsx | 18 | usage | <h2>{t('store.usage.title')}</h2> |
| src/features/store/ui/StoreUsageCard.tsx | 20 | usage | <span>{t('store.usage.today')}</span> |
| src/features/store/ui/StoreUsageCard.tsx | 22 | usage | <div className="store-usage-grid"> |
| src/features/store/ui/StoreUsageCard.tsx | 24 | usage | <strong>{usage.voiceCommandsToday.remaining}</strong> |
| src/features/store/ui/StoreUsageCard.tsx | 25 | usage | <span>{t('store.usage.voiceLeft', { limit: usage.voiceCommandsToday.limit })}</span> |
| src/features/store/ui/StoreUsageCard.tsx | 28 | usage | <strong>{usage.receiptScansThisMonth.remaining}</strong> |
| src/features/store/ui/StoreUsageCard.tsx | 29 | usage | <span>{t('store.usage.receiptsLeft', { limit: usage.receiptScansThisMonth.limit })}</span> |
| src/features/store/ui/StoreUsageCard.tsx | 32 | usage | <strong>{usage.advancedReportsThisMonth.remaining}</strong> |
| src/features/store/ui/StoreUsageCard.tsx | 33 | usage | <span>{t('store.usage.reportsLeft', { limit: usage.advancedReportsThisMonth.limit })}</span> |
| src/features/subscription/api/subscription.api.ts | 49 | feature | feature: (feature: string) => apiClient.get<SubscriptionFeatureAccessDto>(`/subscription/features/${encodeURIComponent(feature)}`), |
| src/features/transactions/ui/EditTransactionModal.tsx | 2 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/transactions/ui/EditTransactionModal.tsx | 50 | target | onChange={(event) => setAmount(event.target.value)} |
| src/features/transactions/ui/EditTransactionModal.tsx | 60 | target | onChange={(event) => setDescription(event.target.value)} |
| src/features/transactions/ui/LastTransactionCard.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/transactions/ui/MonthlyStatsCard.tsx | 1 | api | import type { MonthlyStatsDto } from '@/features/transactions/api/transactions.api'; |
| src/features/transactions/ui/TimelineEventCard.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/transactions/ui/TransactionCreateSheet.tsx | 119 | target | <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: колбаса" autoFocus /> |
| src/features/transactions/ui/TransactionCreateSheet.tsx | 125 | target | <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="350" /> |
| src/features/transactions/ui/TransactionCreateSheet.tsx | 131 | target | <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Необязательно: магазин, детали покупки, комментарий" /> |
| src/features/transactions/ui/TransactionCreateSheet.tsx | 137 | target | <select value={accountId} onChange={(event) => setAccountId(event.target.value)}> |
| src/features/transactions/ui/TransactionCreateSheet.tsx | 146 | target | <select value={toAccountId ?? ''} onChange={(event) => setToAccountId(event.target.value \|\| null)}> |
| src/features/transactions/ui/TransactionDetailsSheet.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/transactions/ui/TransactionEditSheet.tsx | 5 | api | import type { DeleteTransactionBalanceMode, TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/transactions/ui/TransactionEditSheet.tsx | 223 | target | <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: колбаса" /> |
| src/features/transactions/ui/TransactionEditSheet.tsx | 229 | target | <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Например 350" /> |
| src/features/transactions/ui/TransactionEditSheet.tsx | 235 | target | <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Необязательно: магазин, детали покупки, комментарий" /> |
| src/features/transactions/ui/TransactionEditSheet.tsx | 241 | target | <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="[color-scheme:dark]" /> |
| src/features/transactions/ui/TransactionsHistoryDrawer.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/transactions/ui/TransactionsTimeline.tsx | 1 | api | import type { TransactionDto } from '@/features/transactions/api/transactions.api'; |
| src/features/voice/ui/VoiceFirstCompanionLayer.tsx | 6 | api | import { logVoiceDebugEvent } from '@/features/voice/api/voice.api'; |
| src/features/voice/ui/VoiceFirstCompanionLayer.tsx | 541 | target | className="voice-first-companion__press-target" |
| src/pages/accounts/AccountsPage.tsx | 3 | api | import type { AccountDto } from '@/features/accounts/api/accounts.api'; |
| src/pages/admin/AdminPage.tsx | 2 | api | import { adminApi, type AdminEvent, type AdminOverview, type AdminUser } from '@/features/admin/api/admin.api'; |
| src/pages/admin/AdminPage.tsx | 6 | api | import { HttpError } from '@/shared/api/http'; |
| src/pages/admin/AdminPage.tsx | 332 | target | onChange={(event) => setSubscriptionDays((state) => ({ ...state, [item.id]: event.target.value }))} |
| src/pages/companion/CompanionPage.tsx | 3 | api | import { companionApi, type CompanionStateDto } from '@/shared/api/companion.api'; |
| src/pages/companion/CompanionPage.tsx | 95 | target | <input type="checkbox" checked={voiceRepliesEnabled} onChange={(event) => setVoiceRepliesEnabled(event.target.checked)} /> |
| src/pages/companion/CompanionPage.tsx | 99 | target | <input type="checkbox" checked={textInputEnabled} onChange={(event) => setTextInputEnabled(event.target.checked)} /> |
| src/pages/goals/GoalsPage.tsx | 2 | api | import { goalsApi, type GoalDto } from '@/features/goals/api/goals.api'; |
| src/pages/goals/GoalsPage.tsx | 39 | target | acc.target += Number(goal.targetAmount) \|\| 0; |
| src/pages/goals/GoalsPage.tsx | 41 | target | }, { current: 0, target: 0 }), [activeGoals]); |
| src/pages/goals/GoalsPage.tsx | 42 | target | const totalProgress = clampProgress((totals.current / Math.max(totals.target, 1)) * 100); |
| src/pages/goals/GoalsPage.tsx | 62 | target | <div><strong>{formatMoney(Math.max(totals.target - totals.current, 0), 'RUB')}</strong><small>осталось</small></div> |
| src/pages/receipt-scans/ReceiptScansPage.tsx | 35 | feature | feature="receiptScan" |
| src/pages/referral/ReferralPage.tsx | 2 | api | import { referralApi, type ReferralInfoDto, type ReferralTransactionDto } from '@/features/referral/api/referral.api'; |
| src/pages/referral/ReferralPage.tsx | 121 | target | <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('referral.apply.placeholder')} /> |
| src/pages/sections/SectionsPage.tsx | 4 | api | import type { CategoryDto } from '@/features/sections/api/sections.api'; |
| src/pages/settings/SettingsPage.tsx | 7 | api | import { dataResetApi, type DataResetMode } from '@/features/data-reset/api/dataReset.api'; |
| src/pages/settings/SettingsPage.tsx | 50 | target | <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> |
| src/pages/settings/SettingsPage.tsx | 248 | target | <input className="app-currency-rate-input" inputMode="decimal" value={usdDraft} onChange={(event) => setUsdDraft(event.target.value)} onBlur={saveUsdRate} /> |
| src/pages/settings/SettingsPage.tsx | 253 | target | <input className="app-currency-rate-input" inputMode="decimal" value={eurDraft} onChange={(event) => setEurDraft(event.target.value)} onBlur={saveEurRate} /> |
| src/pages/spending-limits/SpendingLimitsPage.tsx | 2 | api | import { fetchAccounts, type AccountDto } from '@/features/accounts/api/accounts.api'; |
| src/pages/spending-limits/SpendingLimitsPage.tsx | 3 | api | import { fetchCategories, type CategoryDto } from '@/features/sections/api/sections.api'; |
| src/pages/spending-limits/SpendingLimitsPage.tsx | 12 | api | } from '@/features/spending-limits/api/spendingLimits.api'; |
| src/pages/spending-limits/SpendingLimitsPage.tsx | 189 | target | <span>{t('limits.form.target')}</span> |
| src/pages/spending-limits/SpendingLimitsPage.tsx | 190 | target | <select value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value as SpendingLimitTargetType })}> |
| src/pages/spending-limits/SpendingLimitsPage.tsx | 191 | target | <option value="account">{t('limits.target.account')}</option> |
| src/pages/spending-limits/SpendingLimitsPage.tsx | 192 | target | <option value="category">{t('limits.target.category')}</option> |

## Translation key leak candidates
| file | line | key | text |
| --- | --- | --- | --- |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 10 | premium.sheet.feature.forecast | 'premium.sheet.feature.forecast', |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 11 | premium.sheet.feature.reports | 'premium.sheet.feature.reports', |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 12 | premium.sheet.feature.receipts | 'premium.sheet.feature.receipts', |
| src/features/premium/ui/PremiumUpgradeSheet.tsx | 13 | premium.sheet.feature.voice | 'premium.sheet.feature.voice', |
| src/features/store/model/storeCatalog.ts | 25 | store.premium.item.analytics | 'store.premium.item.analytics', |
| src/features/store/model/storeCatalog.ts | 26 | store.premium.item.reports | 'store.premium.item.reports', |
| src/features/store/model/storeCatalog.ts | 27 | store.premium.item.receipts | 'store.premium.item.receipts', |
| src/features/store/model/storeCatalog.ts | 28 | store.premium.item.voice | 'store.premium.item.voice', |
| src/features/store/model/storeCatalog.ts | 38 | store.business.item.workspace | 'store.business.item.workspace', |
| src/features/store/model/storeCatalog.ts | 39 | store.business.item.reports | 'store.business.item.reports', |
| src/features/store/model/storeCatalog.ts | 50 | store.referral.item.invite | 'store.referral.item.invite', |
| src/features/store/model/storeCatalog.ts | 51 | store.referral.item.purchase | 'store.referral.item.purchase', |
| src/features/store/model/storeCatalog.ts | 52 | store.referral.item.balance | 'store.referral.item.balance', |
| src/features/store/ui/StoreFeatureSection.tsx | 16 | store.features.receipts.title | if (feature.title === 'store.features.receipts.title') { |
| src/features/voice/api/voice.api.ts | 131 | voice.webm | filename = 'voice.webm', |

## CSS structure findings
Нет найденных проблем.

## Large files
| file | lines | threshold |
| --- | --- | --- |
| src/features/sections/lib/categoryIcons.ts | 2028 | 420 |
| src/shared/lib/i18n.ts | 1605 | 420 |
| src/app/styles/pages/dashboard.css | 670 | 420 |
| src/app/styles/pages/obligations.css | 669 | 420 |
| src/features/voice/model/useVoiceRecorder.ts | 615 | 420 |
| src/app/styles/features/chat/text-chat-overlay.css | 612 | 420 |
| src/app/styles/pages/onboarding-setup.css | 607 | 420 |
| src/features/chat/ui/TextChatOverlay.tsx | 591 | 360 |
| src/features/voice/ui/VoiceFirstCompanionLayer.tsx | 569 | 360 |
| src/app/styles/components/buttons-controls.css | 528 | 420 |
| src/app/styles/screens/product-screens.css | 462 | 420 |
| src/pages/admin/AdminPage.tsx | 461 | 360 |

## Env leaks
Нет найденных проблем.

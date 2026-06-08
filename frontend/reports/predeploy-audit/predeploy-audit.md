# Predeploy audit report

Generated: 2026-06-08T21:39:25.832Z

## Summary

- Hardcoded Russian candidates: 1001
- Technical/user-visible word candidates: 0
- Translation key leak candidates: 0
- CSS structure findings: 0
- Large files: 10
- Env leaks: 0

## Hardcoded Russian candidates
| file | line | text |
| --- | --- | --- |
| src/features/ai-core/ui/AIAssistantDock.tsx | 28 | aria-label="Открыть Фину" |
| src/features/ai-core/ui/AICoreOrb.tsx | 101 | <CompanionButton size="lg" mood={moodFromState(state, isActive, isVoiceLocked)} label="Фина" tabIndex={-1} /> |
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
| src/features/chat/ui/ChatScreen.tsx | 56 | : 'нет событий'; |
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
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 61 | if (period === 'day') return 'День'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 62 | if (period === 'week') return 'Неделя'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 63 | return 'Месяц'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 67 | return mode === 'expense' ? 'Расходы' : 'Доходы'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 101 | const categoryName = item.category?.name?.trim() \|\| (mode === 'expense' ? 'Без категории' : 'Доходы'); |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 102 | const sectionName = item.category?.section?.name?.trim() \|\| item.section?.name?.trim() \|\| 'Без раздела'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 119 | const categoryName = item.category?.name?.trim() \|\| (mode === 'expense' ? 'Без категории' : 'Доходы'); |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 120 | const sectionName = item.category?.section?.name?.trim() \|\| item.section?.name?.trim() \|\| 'Без раздела'; |
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
| src/features/insights/lib/buildInsights.ts | 37 | title: `AI ждёт подтверждения: ${pendingActions.length}`, |
| src/features/insights/lib/buildInsights.ts | 40 | ? 'Есть одно действие, требующее внимания.' |
| src/features/insights/lib/buildInsights.ts | 41 | : 'Есть несколько AI-действий, требующих внимания.', |
| src/features/insights/lib/buildInsights.ts | 42 | ctaLabel: 'Открыть pending', |
| src/features/insights/lib/buildInsights.ts | 51 | title: `AI выполнил действий: ${executedCount}`, |
| src/features/insights/lib/buildInsights.ts | 52 | description: 'AI уже провёл операции и сохранил их в аудит-логе.', |
| src/features/insights/lib/buildInsights.ts | 53 | ctaLabel: 'Открыть audit', |
| src/features/insights/lib/buildInsights.ts | 62 | title: `AI подготовил черновиков: ${previewedCount}`, |
| src/features/insights/lib/buildInsights.ts | 63 | description: 'AI распознаёт команды и собирает структурированные операции.', |
| src/features/insights/lib/buildInsights.ts | 72 | title: `Ожидают подтверждения: ${pendingAuditCount}`, |
| src/features/insights/lib/buildInsights.ts | 73 | description: 'В аудите есть действия, которые пока не завершены.', |
| src/features/insights/lib/buildInsights.ts | 74 | ctaLabel: 'Проверить', |
| src/features/insights/lib/buildInsights.ts | 83 | title: 'AI готов к работе', |
| src/features/insights/lib/buildInsights.ts | 85 | 'Начни с команды вроде «кофе 350», «+50000 зарплата» или «перевёл 10000».', |
| src/features/modals/ui/ObligationModals.tsx | 31 | const confirmed = window.confirm(`Удалить «${loan.title}»? Платежи и напоминания по нему тоже будут удалены.`); |
| src/features/modals/ui/UtilityModals.tsx | 40 | <div className="app-eyebrow">Счета</div> |
| src/features/modals/ui/UtilityModals.tsx | 41 | <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">Правила кошелька</h2> |
| src/features/modals/ui/UtilityModals.tsx | 42 | <p className="mt-2 text-sm leading-6 text-white/50">Выбери основную валюту и быстро проверь важные счета.</p> |
| src/features/modals/ui/UtilityModals.tsx | 46 | <div className="text-xs text-white/42">Основная валюта</div> |
| src/features/modals/ui/UtilityModals.tsx | 55 | <div className="app-settings-tile"><small>Главный счёт</small><b>{accounts.find((item) => item.id === primaryAccountId)?.name \|\| 'Не выбран'}</b></div> |
| src/features/modals/ui/UtilityModals.tsx | 56 | <div className="app-settings-tile"><small>Доходы</small><b>{accounts.find((item) => item.id === incomeAccountId)?.name \|\| 'Не выбран'}</b></div> |
| src/features/modals/ui/UtilityModals.tsx | 60 | <button type="button" onClick={() => closeModal('accounts-tools')} className="app-secondary-button w-full">Готово</button> |
| src/features/modals/ui/UtilityModals.tsx | 72 | <div className="app-eyebrow">Категории</div> |
| src/features/modals/ui/UtilityModals.tsx | 73 | <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">Порядок для расходов и доходов</h2> |
| src/features/modals/ui/UtilityModals.tsx | 74 | <p className="mt-2 text-sm leading-6 text-white/50">Разделы объединяют категории и помогают видеть, куда уходят деньги.</p> |
| src/features/modals/ui/UtilityModals.tsx | 79 | <button type="button" onClick={() => closeModal('taxonomy-tools')} className="app-secondary-button">Закрыть</button> |
| src/features/modals/ui/UtilityModals.tsx | 80 | <button type="button" onClick={() => openModal({ type: 'section-edit', section: null })} className="app-primary-button">Новый раздел</button> |
| src/features/modals/ui/UtilityModals.tsx | 98 | <div className="app-eyebrow">Категории</div> |
| src/features/modals/ui/UtilityModals.tsx | 99 | <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">{section === 'ungrouped' ? 'Без раздела' : section.name}</h2> |
| src/features/modals/ui/UtilityModals.tsx | 101 | {section === 'ungrouped' ? null : <button type="button" onClick={() => openModal({ type: 'section-edit', section })} className="app-secondary-button">Править</button>} |
| src/features/modals/ui/UtilityModals.tsx | 104 | {modalCategories.length === 0 ? <div className="app-empty-inline">Категорий пока нет.</div> : null} |
| src/features/modals/ui/UtilityModals.tsx | 108 | <small>{category.type === 'income' ? 'Доходы' : category.type === 'both' ? 'Расходы и доходы' : 'Расходы'}</small> |
| src/features/modals/ui/UtilityModals.tsx | 115 | <button type="button" onClick={() => closeModal('taxonomy-section')} className="app-secondary-button">Закрыть</button> |
| src/features/modals/ui/UtilityModals.tsx | 116 | <button type="button" onClick={() => openModal({ type: 'category-edit', sectionId: section === 'ungrouped' ? null : section.id })} className="app-primary-button">Категория</button> |
| src/features/notifications/model/notifications.store.ts | 44 | set({ error: error instanceof Error ? error.message : 'Не удалось загрузить уведомления.' }); |
| src/features/notifications/model/notifications.store.ts | 64 | set({ error: error instanceof Error ? error.message : 'Не удалось загрузить настройки уведомлений.' }); |
| src/features/notifications/model/notifications.store.ts | 106 | set({ error: error instanceof Error ? error.message : 'Не удалось сохранить настройки.' }); |
| src/features/notifications/ui/NotificationSheet.tsx | 82 | <div className="app-eyebrow">Уведомления</div> |
| src/features/notifications/ui/NotificationSheet.tsx | 83 | <h2>Что важно</h2> |
| src/features/notifications/ui/NotificationSheet.tsx | 84 | <p>{unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Новых уведомлений нет'}</p> |
| src/features/notifications/ui/NotificationSheet.tsx | 90 | aria-label="Настройки уведомлений" |
| src/features/notifications/ui/NotificationSheet.tsx | 98 | <button type="button" className="notification-sheet__icon-button notification-sheet__icon-button--close" onClick={onClose} aria-label="Закрыть">×</button> |
| src/features/notifications/ui/NotificationSheet.tsx | 114 | <div className="notification-empty">Загружаю уведомления…</div> |
| src/features/notifications/ui/NotificationSheet.tsx | 117 | <b>Пока пусто</b> |
| src/features/notifications/ui/NotificationSheet.tsx | 118 | <span>Здесь появятся платежи, просрочки и важные события.</span> |
| src/features/obligations/model/obligations.store.ts | 29 | return error instanceof Error ? error.message : 'Не удалось выполнить действие'; |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 47 | if (!nearest?.nextPaymentDate) return 'дата не указана'; |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 50 | if (days < 0) return `${base} · просрочено`; |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 51 | if (days === 0) return `${base} · сегодня`; |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 52 | if (days === 1) return `${base} · завтра`; |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 53 | return `${base} · через ${days} дн.`; |

## Technical/user-visible word candidates
Нет найденных проблем.

## Translation key leak candidates
Нет найденных проблем.

## CSS structure findings
Нет найденных проблем.

## Large files
| file | lines | threshold |
| --- | --- | --- |
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

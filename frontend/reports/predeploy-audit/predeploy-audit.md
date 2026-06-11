# Predeploy audit report

Generated: 2026-06-11T19:32:25.517Z

## Summary

- Hardcoded Russian candidates: 1203
- Technical/user-visible word candidates: 0
- Translation key leak candidates: 3
- CSS structure findings: 0
- Large files: 8
- Env leaks: 0

## Hardcoded Russian candidates
| file | line | text |
| --- | --- | --- |
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
| src/features/chat/ui/text-chat-overlay/helpers.ts | 9 | const cleanName = normalizeForWake(companionName \|\| 'Фина'); |
| src/features/chat/ui/text-chat-overlay/helpers.ts | 12 | [cleanName, 'фина', 'финна', 'фину', 'фине', 'финой', 'fina'].filter( |
| src/features/chat/ui/text-chat-overlay/helpers.ts | 75 | .includes('нал'), |
| src/features/chat/ui/text-chat-overlay/helpers.ts | 80 | .includes('карт'), |
| src/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts.ts | 22 | latest?.title \|\| latest?.description \|\| 'последнюю операцию'; |
| src/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts.ts | 25 | accountName ? `расход 300 кофе с ${accountName}` : 'расход 300 кофе', |
| src/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts.ts | 26 | accountName ? `доход 5000 на ${accountName}` : 'доход 5000', |
| src/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts.ts | 28 | ? `поставь лимит на ${accountName} 20000 в месяц` |
| src/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts.ts | 29 | : 'поставь общий лимит расходов 80000 в месяц', |
| src/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts.ts | 30 | 'покажи лимиты', |
| src/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts.ts | 31 | 'создай цель отпуск 120000', |
| src/features/chat/ui/text-chat-overlay/useTextChatContextualPrompts.ts | 35 | prompts.unshift(`измени ${latestTitle} на ${latestAmount}`); |
| src/features/chat/ui/TextChatOverlay.tsx | 90 | (state) => state.companionName \|\| "Фина", |
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
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 64 | if (period === 'day') return 'День'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 65 | if (period === 'week') return 'Неделя'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 66 | return 'Месяц'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 70 | return mode === 'expense' ? 'Расходы' : 'Доходы'; |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 102 | return transaction.category?.section?.name?.trim() \|\| transaction.section?.name?.trim() \|\| (mode === 'expense' ? 'Другое' : 'Доходы'); |
| src/features/dashboard/lib/homeFinanceAnalytics.ts | 106 | return transaction.category?.name?.trim() \|\| (mode === 'expense' ? 'Другое' : 'Доход'); |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 7 | return transaction.title \|\| transaction.description \|\| transaction.category?.name \|\| 'Операция'; |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 39 | <p>{sorted.length} опер. · {formatMoney(total \|\| group.amount, 'RUB')}</p> |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 41 | <button type="button" className="app-icon-button" onClick={onClose} aria-label="Закрыть">×</button> |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 46 | <div className="app-empty-button">Операций в этой категории больше нет.</div> |
| src/features/dashboard/ui/HomeCategoryOperationsModal.tsx | 53 | <div className="mt-1 truncate text-xs text-white/40">{formatTransactionDate(transaction.date)} · {transaction.account?.name ?? 'Счёт'}</div> |
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
| src/features/obligations/ui/HomeObligationsWidget.tsx | 67 | <span>Ближайший платёж скрыт</span> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 70 | <button type="button" className="app-obligations-widget__ghost" onClick={() => navigateTo('obligations')}>Открыть</button> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 79 | <span className="app-obligations-widget__label">Ближайший платёж</span> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 85 | <button type="button" className="app-obligations-widget__icon" aria-label={widgetState === 'expanded' ? 'Свернуть' : 'Раскрыть'} onClick={() => setState(widgetState === 'expanded' ? 'compact' : 'expanded')}> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 94 | <span>В месяц: {formatMoney(summary.monthlyPaymentTotal, nearest.currency)}</span> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 95 | <span>Остаток: {formatMoney(summary.totalDebt, nearest.currency)}</span> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 98 | <button type="button" className="app-secondary-button" onClick={() => openModal({ type: 'obligation-edit', loan: nearest })}>Изменить</button> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 99 | <button type="button" className="app-secondary-button" onClick={() => setState('hidden')}>Скрыть</button> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 100 | <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(nearest.id)}>Оплатил</button> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 105 | <button type="button" className="app-secondary-button" onClick={() => setState('hidden')}>Скрыть</button> |
| src/features/obligations/ui/HomeObligationsWidget.tsx | 106 | <button type="button" className="app-primary-button" disabled={isMutating} onClick={() => markPaid(nearest.id)}>Оплатил</button> |
| src/features/obligations/ui/LoanEditSheet.tsx | 7 | { value: 'loan', label: 'Кредит' }, |
| src/features/obligations/ui/LoanEditSheet.tsx | 8 | { value: 'mortgage', label: 'Ипотека' }, |
| src/features/obligations/ui/LoanEditSheet.tsx | 9 | { value: 'installment', label: 'Рассрочка' }, |
| src/features/obligations/ui/LoanEditSheet.tsx | 10 | { value: 'subscription', label: 'Подписка' }, |
| src/features/obligations/ui/LoanEditSheet.tsx | 11 | { value: 'other', label: 'Другое' }, |
| src/features/obligations/ui/LoanEditSheet.tsx | 90 | setError(isSubscription ? 'Укажи название подписки.' : 'Укажи название обязательства.'); |
| src/features/obligations/ui/LoanEditSheet.tsx | 96 | setError('Укажи сумму регулярного платежа.'); |
| src/features/obligations/ui/LoanEditSheet.tsx | 123 | setError(error instanceof Error ? error.message : 'Не удалось сохранить обязательство'); |
| src/features/obligations/ui/LoanEditSheet.tsx | 132 | title={loan ? 'Изменить обязательство' : 'Новое обязательство'} |
| src/features/obligations/ui/LoanEditSheet.tsx | 143 | <button type="button" className="app-secondary-button" onClick={onClose} disabled={isSaving}>Отмена</button> |
| src/features/obligations/ui/LoanEditSheet.tsx | 145 | {isSaving ? 'Сохраняю...' : 'Сохранить'} |
| src/features/obligations/ui/LoanEditSheet.tsx | 154 | <div className="app-obligation-type-grid" aria-label="Тип обязательства"> |
| src/features/obligations/ui/LoanEditSheet.tsx | 171 | <strong>Основное</strong> |
| src/features/obligations/ui/LoanEditSheet.tsx | 175 | <span>{isSubscription ? 'Название подписки' : 'Название'}</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 179 | placeholder={isSubscription ? 'Netflix, Spotify, связь' : 'Ипотека, автокредит, рассрочка'} |
| src/features/obligations/ui/LoanEditSheet.tsx | 185 | <span>{isSubscription ? 'Сервис' : 'Банк / организация'}</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 189 | placeholder={isSubscription ? 'Онлайн-кинотеатр' : 'Сбер, Т-Банк, магазин'} |
| src/features/obligations/ui/LoanEditSheet.tsx | 194 | <span>Валюта</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 206 | <strong>Списание</strong> |
| src/features/obligations/ui/LoanEditSheet.tsx | 210 | <div className="app-obligation-account-picker" role="radiogroup" aria-label="Счёт списания"> |
| src/features/obligations/ui/LoanEditSheet.tsx | 217 | <span>Без счёта</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 218 | <small>Только напоминание</small> |
| src/features/obligations/ui/LoanEditSheet.tsx | 238 | <strong>Списывать как расход</strong> |
| src/features/obligations/ui/LoanEditSheet.tsx | 239 | <small>При оплате</small> |
| src/features/obligations/ui/LoanEditSheet.tsx | 247 | <strong>{isSubscription \|\| isOther ? 'Платёж' : 'Суммы'}</strong> |
| src/features/obligations/ui/LoanEditSheet.tsx | 253 | <span>Остаток</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 259 | <span>{isSubscription ? 'Списание' : 'Платёж'}</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 265 | <span>Общая сумма</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 275 | <strong>{isInstallment ? 'Срок рассрочки' : 'Условия'}</strong> |
| src/features/obligations/ui/LoanEditSheet.tsx | 281 | <span>Ставка, %</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 287 | <span>Срок</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 292 | <span>Оплачено</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 301 | <strong>Напоминание</strong> |
| src/features/obligations/ui/LoanEditSheet.tsx | 306 | <span>День</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 311 | <span>Ближайший</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 316 | <span>За дней</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 323 | <span>Заметка</span> |
| src/features/obligations/ui/LoanEditSheet.tsx | 324 | <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например: гасить досрочно при возможности" /> |
| src/features/onboarding/model/onboarding.store.ts | 11 | { id: 'cash', enabled: true, name: 'Наличка', type: 'cash', balance: 0 }, |
| src/features/onboarding/model/onboarding.store.ts | 12 | { id: 'card', enabled: true, name: 'Карта', type: 'card', balance: 0 }, |
| src/features/onboarding/model/onboarding.store.ts | 17 | title: 'Кредит', |
| src/features/onboarding/model/onboarding.store.ts | 24 | title: 'Подушка безопасности', |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 31 | { id: 'welcome', title: 'Старт' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 32 | { id: 'microphone', title: 'Микрофон' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 33 | { id: 'voice_intro', title: 'Фина' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 34 | { id: 'currency', title: 'Валюта' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 35 | { id: 'accounts', title: 'Счета' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 36 | { id: 'loans', title: 'Кредиты' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 37 | { id: 'goals', title: 'Цели' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 38 | { id: 'reminders', title: 'Напоминания' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 39 | { id: 'finish', title: 'Готово' }, |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 48 | return user?.firstName \|\| user?.username \|\| 'друг'; |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 158 | note: 'Создано при первом запуске', |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 167 | setFinishError(error instanceof Error ? error.message : 'Не удалось завершить настройку'); |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 189 | <div className="onboarding-step-tabs" aria-label="Шаги настройки"> |
| src/features/onboarding/ui/LaunchOnboardingSheet.tsx | 225 | {isFinishing ? 'Сохраняю…' : isLastStep ? 'Завершить' : 'Дальше'} |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 11 | label: '1. Создать наличку', |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 12 | phrase: 'создай счёт Наличка, у меня там 5000 рублей', |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 13 | hint: 'Если сумма другая, скажи свою сумму. Можно оставить 0 рублей.', |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 16 | label: '2. Создать карту', |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 17 | phrase: 'создай счёт Карта, у меня там 20000 рублей', |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 18 | hint: 'Если у тебя несколько карт, создай основную. Остальные добавишь позже.', |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 36 | eyebrow="Счета" |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 37 | title="Создай наличку и карту голосом" |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 38 | description="У почти каждого есть наличные и карта. Сейчас ты зажмёшь Фину, скажешь две команды и сразу создашь первые счета в приложении." |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 42 | <strong>Сначала разреши микрофон</strong> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 43 | <span>Вернись на шаг “Микрофон” и нажми “Разрешить микрофон”. Иначе Фина не сможет начать запись по удержанию.</span> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 49 | <strong>Как выполнить этот шаг</strong> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 50 | <span>Зажми Фину внизу справа, скажи команду, отпусти. Если Фина покажет подтверждение — проверь и подтверди.</span> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 52 | <em>Фина видна поверх этого шага специально для тренировки.</em> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 99 | <span>{account.id === 'cash' ? 'Наличные' : 'Карта'}</span> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 103 | <span>Название</span> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 108 | <span>Стартовый баланс</span> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 124 | <strong>После двух команд нажми “Дальше”</strong> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 125 | <span>Онбординг не создаёт дубли. Счета появятся через обычный голосовой механизм Фины, как в приложении после настройки.</span> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 131 | <strong>Можно позже</strong> |
| src/features/onboarding/ui/steps/AccountsStep.tsx | 132 | <span>Без счетов приложение тоже откроется, но для расходов Фина будет чаще просить уточнение.</span> |
| src/features/onboarding/ui/steps/CurrencyStep.tsx | 5 | { code: 'RUB', title: '₽ RUB', caption: 'Россия' }, |
| src/features/onboarding/ui/steps/CurrencyStep.tsx | 6 | { code: 'USD', title: '$ USD', caption: 'Доллары' }, |
| src/features/onboarding/ui/steps/CurrencyStep.tsx | 7 | { code: 'EUR', title: '€ EUR', caption: 'Евро' }, |

## Technical/user-visible word candidates
Нет найденных проблем.

## Translation key leak candidates
| file | line | key | text |
| --- | --- | --- | --- |
| src/features/accounts/ui/AccountDetailsSheet.tsx | 54 | accounts.type.default | ACCOUNT_TYPE_KEYS[String(account.type ?? "")] ?? "accounts.type.default", |
| src/features/accounts/ui/EditAccountModal.tsx | 129 | accounts.type.default | {t(ACCOUNT_TYPE_KEYS[item] ?? "accounts.type.default")} |
| src/features/chat/model/chatController.navigation.ts | 28 | common.section | return t(keys[screen] ?? "common.section"); |

## CSS structure findings
Нет найденных проблем.

## Large files
| file | lines | threshold |
| --- | --- | --- |
| src/features/chat/ui/TextChatOverlay.tsx | 600 | 360 |
| src/features/voice/model/useVoiceRecorder.ts | 570 | 420 |
| src/app/styles/screens/product-screens.css | 462 | 420 |
| src/app/styles/pages/dashboard/dashboard-hero.css | 446 | 420 |
| src/app/styles/pages/obligations/obligations-summary.css | 444 | 420 |
| src/app/styles/pages/onboarding-setup/onboarding-setup-shell.css | 444 | 420 |
| src/app/styles/features/chat/text-chat-overlay/text-chat-overlay-shell.css | 442 | 420 |
| src/app/styles/components/buttons-controls/buttons-controls-core.css | 441 | 420 |

## Env leaks
Нет найденных проблем.

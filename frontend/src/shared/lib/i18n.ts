import { useCallback, useMemo } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import type { AppLanguage } from '@/features/settings/model/settings.types';
import { dictionary } from '@/shared/lib/i18n/locales';
import { extraRuntimeTextDictionary } from '@/shared/lib/i18n.extra';

export type { I18nKey } from '@/shared/lib/i18n/locales';

const runtimeTextDictionary: Record<string, string> = {
  'Авторизация через Telegram...': 'Authorization through Telegram...',
  'Введи 6 цифр из сообщения бота.': 'Enter the 6 digits from the bot message.',
  'Вход через Telegram': 'Telegram sign in',
  'Не удалось подтвердить вход через Telegram.': 'Could not confirm Telegram sign in.',
  'Если используешь сторонний Telegram-клиент, войди через одноразовый код из бота.': 'If you use a third-party Telegram client, sign in with a one-time code from the bot.',
  '1. Открой бота и отправь команду /login.': '1. Open the bot and send /login.',
  '2. Скопируй 6-значный код.': '2. Copy the 6-digit code.',
  '3. Введи код здесь.': '3. Enter the code here.',
  'Открыть бота': 'Open bot',
  'Ссылка на бота не настроена. Можно открыть бота вручную и отправить /login.': 'The bot link is not configured. You can open the bot manually and send /login.',
  'Код из бота': 'Code from bot',
  'Проверяю...': 'Checking...',
  'Войти': 'Sign in',
  'Официальный Telegram продолжит входить автоматически. Код нужен только если клиент не передал безопасные данные входа.': 'The official Telegram app will continue signing in automatically. The code is only needed if the client did not pass secure sign-in data.',

  'Главная': 'Home',
  'Счета': 'Accounts',
  'Операции': 'Transactions',
  'Аналитика': 'Analytics',
  'Настройки': 'Settings',
  'Цели': 'Goals',
  'Категории': 'Categories',
  'Разделы': 'Sections',
  'Обязательства': 'Obligations',
  'Premium': 'Premium',
  'Премиум': 'Premium',
  'ИИ-бухгалтер': 'AI accountant',
  'Админка': 'Admin',
  'Рефералы': 'Referrals',
  'Меню': 'Menu',
  'Назад': 'Back',
  'Домой': 'Home',
  'Закрыть': 'Close',
  'Готово': 'Done',
  'Сохранить': 'Save',
  'Скачать': 'Download',
  'Предпросмотр': 'Preview',
  'Повторить': 'Retry',
  'Удалить': 'Delete',
  'Удалить счёт': 'Delete account',
  'Отмена': 'Cancel',
  'Отменить': 'Cancel',
  'Изменить': 'Edit',
  'Подробнее': 'Details',
  'Скрыть': 'Hide',
  'Свернуть': 'Collapse',
  'Раскрыть': 'Expand',
  'Дальше': 'Next',
  'Пропустить': 'Skip',
  'Выбрать': 'Select',
  'Скопировать': 'Copy',

  'Куда перейти': 'Where to go',
  'Баланс, счета и картина денег': 'Balance, accounts and money picture',
  'Карты, наличные и накопления': 'Cards, cash and savings',
  'Накопления и планы': 'Savings and plans',
  'Кредиты, подписки и напоминания': 'Loans, subscriptions and reminders',
  'Разделы расходов и доходов': 'Expense and income sections',
  'Тарифы и возможности': 'Plans and features',
  'Для ИП, самозанятых и бизнеса': 'For freelancers and business',
  'Приглашения и бонусы': 'Invites and bonuses',
  'Пользователи и инструменты': 'Users and tools',

  'Общий баланс': 'Total balance',
  'Все счета объединены': 'All accounts combined',
  'Все деньги по местам': 'All money in place',
  'Счета, наличные, карты и накопления без лишнего шума.': 'Accounts, cash, cards and savings without clutter.',
  'Кошелёк': 'Wallet',
  'Баланс и структура': 'Balance and structure',
  'Создать счёт': 'Create account',
  'Создать счет': 'Create account',
  'Новый счёт': 'New account',
  'Новый счет': 'New account',
  'Карта, наличные или цель': 'Card, cash or goal',
  'Перевод': 'Transfer',
  'Между своими счетами': 'Between your accounts',
  'главная валюта': 'main currency',
  'главный': 'primary',
  'Главный': 'Primary',
  'Доход сюда': 'Income here',
  'Имя защищено': 'Name protected',
  'Без трат': 'No spending',
  'Без переводов': 'No transfers',
  'Загружаю счета...': 'Loading accounts...',
  'Счета не загрузились': 'Accounts failed to load',
  'Наличные': 'Cash',
  'Карта': 'Card',
  'Накопления': 'Savings',
  'Счёт': 'Account',
  'Счет': 'Account',
  'счёт': 'account',
  'счет': 'account',
  'карта': 'card',
  'наличные': 'cash',
  'накопления': 'savings',
  'Стартовый баланс': 'Starting balance',
  'Сделать перевод': 'Make transfer',
  'Выбери счёт, куда перевести деньги.': 'Choose the account to transfer money to.',
  'Не удалось сделать перевод.': 'Could not make the transfer.',

  'Доход': 'Income',
  'Доходы': 'Income',
  'Расход': 'Expense',
  'Расходы': 'Expenses',
  'Переводы': 'Transfers',
  'Все': 'All',
  'Оба': 'Both',
  'Итого': 'Total',
  'Итог': 'Balance',
  'Сумма': 'Amount',
  'Описание': 'Description',
  'Название': 'Name',
  'Заметка': 'Note',
  'Тип': 'Type',
  'Баланс': 'Balance',
  'Откуда': 'From',
  'Куда': 'To',
  'Дата': 'Date',
  'Без даты': 'No date',
  'Сегодня': 'Today',
  'Вчера': 'Yesterday',
  'сегодня': 'today',
  'завтра': 'tomorrow',
  'Введите сумму больше нуля': 'Enter an amount greater than zero',
  'Введи сумму больше нуля.': 'Enter an amount greater than zero.',
  'Выбери счёт.': 'Choose an account.',
  'Для перевода нужен другой счёт получателя.': 'A different destination account is required for transfer.',
  'Изменить операцию': 'Edit transaction',
  'Операция': 'Transaction',
  'Живая лента операций': 'Live transaction feed',
  'Добавить расход': 'Add expense',
  'Добавить доход': 'Add income',
  'Открыть диаграмму': 'Open chart',
  'Открыть полную аналитику': 'Open full analytics',
  'Скачать отчёт': 'Download report',
  'Скачать отчет': 'Download report',
  'Операций пока нет': 'No transactions yet',
  'Добавь первую операцию — здесь появится разбор по категориям.': 'Add the first transaction — category breakdown will appear here.',

  'Месяц': 'Month',
  '3 месяца': '3 months',
  'Год': 'Year',
  'Всё': 'All time',
  'Свой': 'Custom',
  'День': 'Day',
  'Неделя': 'Week',
  'Формат': 'Format',
  'Период': 'Period',
  'Расширенный отчёт': 'Advanced report',
  'Расширенный отчет': 'Advanced report',
  'Бизнес-отчёт': 'Business report',
  'Бизнес-отчет': 'Business report',
  'Экспорт операций': 'Transaction export',
  'Простая выгрузка доходов, расходов и переводов за выбранный период.': 'Simple export of income, expenses and transfers for the selected period.',
  'Подробный финансовый отчёт с категориями, счетами, целями и обязательствами.': 'Detailed financial report with categories, accounts, goals and obligations.',
  'Сводка для себя, партнёра или бухгалтера: доходы, расходы и итог периода.': 'Summary for yourself, a partner or an accountant: income, expenses and period total.',
  'В расширенный отчёт входят счета, категории, цели и обязательства. Для бизнес-режима добавляется отдельная сводка по прибыли.': 'The advanced report includes accounts, categories, goals and obligations. Business mode adds a separate profit summary.',
  'Готовлю…': 'Preparing…',

  'Что важно': 'What matters',
  'Новых уведомлений нет': 'No new notifications',
  'Пока пусто': 'Nothing here yet',
  'Здесь появятся платежи, просрочки и важные события.': 'Payments, overdue items and important events will appear here.',
  'Прочитать все': 'Mark all as read',
  'Прочитано': 'Read',
  'Тест напоминания': 'Reminder test',
  'Это проверка доставки уведомления в Telegram.': 'This is a Telegram notification delivery test.',

  'Голос': 'Voice',
  'Голосовой ввод': 'Voice input',
  'Голос выключен': 'Voice off',
  'Разреши микрофон': 'Allow microphone',
  'Микрофон': 'Microphone',
  'Микрофон включается только на время удержания кнопки Фины.': 'The microphone turns on only while holding Fina.',
  'Ответы голосом': 'Voice replies',
  'Текстовое поле': 'Text field',
  'Зажми для голоса': 'Hold to speak',
  'Зажми Фину': 'Hold Fina',
  'Слушаю': 'Listening',
  'Распознаю': 'Recognizing',
  'Выполняю': 'Processing',
  'Готова': 'Ready',
  'Готово.': 'Done.',
  'Проверь действие.': 'Check the action.',
  'Нужно уточнение.': 'Need clarification.',
  'Открыть текстовый ввод': 'Open text input',
  'Отменить запись': 'Cancel recording',
  'Управление записью': 'Recording controls',
  'Напиши, что нужно сделать...': 'Write what needs to be done...',
  'Очистить ввод': 'Clear input',
  'Отправить': 'Send',
  'Подсказки': 'Hints',
  'История': 'History',
  'Открыть чат, если сейчас неудобно говорить': 'Open chat if speaking is inconvenient now',
  'Список быстрых команд для навигации': 'Quick command list for navigation',
  'Что сделать?': 'What to do?',

  'Категория': 'Category',
  'Без категории': 'Uncategorized',
  'Без раздела': 'No section',
  'Раздел': 'Section',
  'Новая категория': 'New category',
  'Новый раздел': 'New section',
  'Создать категорию': 'Create category',
  'Создать раздел': 'Create section',
  'Добавить раздел': 'Add section',
  'Категории и структура': 'Categories and structure',
  'Продукты': 'Groceries',
  'Кофе': 'Coffee',
  'Такси': 'Taxi',
  'Зарплата': 'Salary',
  'Развлечения': 'Entertainment',
  'Работа': 'Work',
  'Дом': 'Home',
  'Подписки': 'Subscriptions',

  'Цель': 'Goal',
  'Новая цель': 'New goal',
  'Добавить цель': 'Add goal',
  'Цели не загрузились': 'Goals failed to load',
  'Укажи название и сумму цели.': 'Specify the goal name and amount.',
  'Короткая форма. Можно также сказать: “создай цель отпуск 120000”.': 'Short form. You can also say: “create a goal vacation 120000”.',
  'Цели помогают видеть, зачем ты экономишь и сколько осталось до результата.': 'Goals help you see why you save and how much is left.',
  'Подушка безопасности': 'Safety cushion',
  'Отпуск': 'Vacation',
  'Ноутбук': 'Laptop',
  'Погасить кредит быстрее': 'Pay off the loan faster',

  'Кредит': 'Loan',
  'Ипотека': 'Mortgage',
  'Рассрочка': 'Installment',
  'Подписка': 'Subscription',
  'Другое': 'Other',
  'Новое обязательство': 'New obligation',
  'Изменить обязательство': 'Edit obligation',
  'Тип обязательства': 'Obligation type',
  'Счёт списания': 'Payment account',
  'Счет списания': 'Payment account',
  'Суммы': 'Amounts',
  'Платёж': 'Payment',
  'Платеж': 'Payment',
  'Условия': 'Terms',
  'Ставка, %': 'Rate, %',
  'Срок': 'Term',
  'Оплачено': 'Paid',
  'Ближайший': 'Next',
  'За дней': 'Days before',
  'Дата платежа не указана': 'Payment date is not set',
  'Счёт не выбран': 'Account not selected',
  'Счет не выбран': 'Account not selected',
  'Укажи название обязательства.': 'Specify the obligation name.',
  'Укажи название подписки.': 'Specify the subscription name.',
  'Укажи сумму регулярного платежа.': 'Specify the recurring payment amount.',
  'Не удалось сохранить обязательство': 'Could not save obligation',

  'Управление': 'Control',
  'Язык': 'Language',
  'Валюты': 'Currencies',
  'Главная валюта и курсы': 'Main currency and rates',
  'Данные': 'Data',
  'Очистка финансов или полный сброс': 'Clear finance data or full reset',
  'Профиль': 'Profile',
  'Разделы приложения': 'App sections',
  'Очистить финансы': 'Clear finance data',
  'Сбросить всё': 'Reset all',
  'Сбросить все': 'Reset all',
  'Очистить все финансовые данные? XP, уровень и прогресс останутся.': 'Clear all finance data? XP, level and progress will remain.',
  'Сбросить всё по аккаунту? Финансы, XP, уровень, достижения и прогресс будут обнулены. Профиль останется.': 'Reset the whole account? Finance data, XP, level, achievements and progress will be reset. The profile will remain.',
  'Финансовые данные очищены.': 'Finance data cleared.',
  'Аккаунт обнулён.': 'Account reset.',
  'Не удалось выполнить сброс.': 'Could not reset data.',
  'Конвертация': 'Conversion',
  'Показывать пересчёт выбранного счёта в другой валюте.': 'Show selected account converted to another currency.',

  'Пробный период': 'Trial period',
  'Статус подписки': 'Subscription status',
  'Premium-возможности': 'Premium features',
  'Лимиты голосовых команд': 'Voice command limits',
  'Выдача Premium из админки': 'Grant Premium from admin',
  'Реферальные награды': 'Referral rewards',
  'Оплата': 'Payment',
  'оплата': 'payment',
  'Попробовать Premium 7 дней': 'Try Premium for 7 days',
  'Глубокий финансовый анализ': 'Deep financial analysis',
  'Фото чека': 'Receipt scan',
  'Красивые отчёты PDF / Excel': 'Beautiful PDF / Excel reports',
  'Банковские интеграции': 'Bank integrations',
  'Фина Бухгалтер': 'Fina Accountant',
  'Текущий план': 'Current plan',

  'Самозанятый': 'Self-employed',
  'ИП': 'Sole proprietor',
  'Малый бизнес': 'Small business',
  'Профиль бизнеса': 'Business profile',
  'Налоговый режим': 'Tax regime',
  'Налоговые напоминания': 'Tax reminders',
  'Экспорт для бухгалтера': 'Export for accountant',
  'Доходы бизнеса': 'Business income',
  'Расходы бизнеса': 'Business expenses',
  'Документы': 'Documents',
  'Отчёты': 'Reports',
  'Отчеты': 'Reports',

  'Первый запуск': 'First launch',
  'Старт': 'Start',
  'Можно начинать': 'Ready to start',
  'Завершить': 'Finish',
  'Что будет настроено': 'What will be set up',
  'Выбери основную валюту': 'Choose the main currency',
  'В ней будут показываться баланс, цели и первые счета. Потом валюту можно изменить в настройках.': 'Balance, goals and first accounts will use it. You can change currency later in settings.',
  'Через голос': 'By voice',
  'Позже': 'Later',
  'Россия': 'Russia',
  'Доллары': 'Dollars',
  'Евро': 'Euro',
  'Казахстан': 'Kazakhstan',
  'Узбекистан': 'Uzbekistan',
  'Кыргызстан': 'Kyrgyzstan',
  'Армения': 'Armenia',
  'Грузия': 'Georgia',
  'Азербайджан': 'Azerbaijan',
  'Есть кредиты или рассрочки?': 'Have loans or installments?',
  'Да, добавить': 'Yes, add',
  'Нет или позже': 'No or later',
  'Можно добавить в приложении': 'Can be added later',
  'Когда напоминать о важном?': 'When to remind about important things?',
  'В день события': 'On the day',
  'За 1 день': '1 day before',
  'За 3 дня': '3 days before',
  'Не напоминать': 'Do not remind',

  'Выполнено': 'Done',
  'Ожидает подтверждения': 'Awaiting confirmation',
  'Черновик': 'Draft',
  'Ошибка': 'Error',
  'Отменено': 'Cancelled',
  'Неизвестно': 'Unknown',
  'Проверь соединение с сервером и попробуй ещё раз.': 'Check the server connection and try again.',
  'Не удалось загрузить данные': 'Could not load data',
};

const normalizedRuntimeDictionary = new Map(
  Object.entries({ ...runtimeTextDictionary, ...extraRuntimeTextDictionary }).map(([key, value]) => [normalizeText(key), value]),
);

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function translateDynamicText(value: string): string | null {
  const normalized = normalizeText(value);
  const unread = normalized.match(/^(\d+) непрочитанных$/i);
  if (unread) return `${unread[1]} unread`;

  const accounts = normalized.match(/^(\d+)\s+(счетов|счётов|счета|счёта|счет|счёт)$/i);
  if (accounts) return `${accounts[1]} ${accounts[1] === '1' ? 'account' : 'accounts'}`;

  const unreadNotifications = normalized.match(/^(\d+)\s+новых уведомлен/i);
  if (unreadNotifications) return `${unreadNotifications[1]} new notifications`;

  const juneDate = normalized.match(/^(\d{1,2}) июня$/i);
  if (juneDate) return `${juneDate[1]} June`;

  return null;
}

export function translate(language: AppLanguage, key: string, params?: Record<string, string | number>) {
  const table = (dictionary[language] ?? dictionary.ru) as Record<string, string>;
  const ruTable = dictionary.ru as Record<string, string>;
  let value: string = table[key] ?? ruTable[key] ?? key;
  if (params) {
    for (const [param, replacement] of Object.entries(params)) {
      value = value.replaceAll(`{${param}}`, String(replacement));
    }
  }
  return value;
}

export function translateRuntimeText(language: AppLanguage, value: string) {
  if (language === 'ru') return value;

  const normalized = normalizeText(value);
  if (!normalized) return value;

  const exact = normalizedRuntimeDictionary.get(normalized);
  if (exact) return value.replace(normalized, exact);

  const dynamic = translateDynamicText(normalized);
  if (dynamic) return value.replace(normalized, dynamic);

  return value;
}

export function hasRuntimeTranslation(value: string) {
  const normalized = normalizeText(value);
  return normalizedRuntimeDictionary.has(normalized) || Boolean(translateDynamicText(normalized));
}

export function useI18n() {
  const language = useSettingsStore((state) => state.appLanguage);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );

  const rt = useCallback((value: string) => translateRuntimeText(language, value), [language]);

  return useMemo(() => ({ language, t, rt }), [language, t, rt]);
}
import type { UserLocale } from '../users/lib/user-locale';

export const DEFAULT_BOT_LOCALE: UserLocale = 'en';

const botText = {
  en: {
    openApp: 'Open Fina',
    chooseLanguageTitle: 'Choose your language.',
    chooseLanguageCaption: 'After that I will use the same language in the bot and in the Mini App.',
    languageEnglish: 'English',
    languageRussian: 'Русский',
    languageSaved: 'Language saved',
    start: 'Fina helps track expenses, income, accounts, goals and reports. Send a money request here or open the Mini App.',
    startExamples: 'Examples: “Spent on coffee”, “Received salary”, “Create a vacation goal”.',
    openStore: 'Open Store',
    storefrontTitle: 'Fina',
    storefrontIntro: 'AI service for personal finance tracking in Telegram. You can use the app for expenses, income, accounts, goals, limits, reminders, financial calendar and analytics.',
    storefrontPremiumTitle: 'Premium',
    storefrontPremiumPrice: '399 RUB per month',
    storefrontPremiumDescription: 'Extended voice input, analytics, goals, limits, reminders and financial calendar.',
    storefrontBusinessTitle: 'Business',
    storefrontBusinessPrice: '899 RUB per month',
    storefrontBusinessDescription: 'Extended tools for work and business finance tracking.',
    storefrontOneTimeTitle: 'One-time packages',
    storefrontVoicePack: 'Voice command package: 99 RUB',
    storefrontReceiptPack: 'Receipt package: 199 RUB',
    storefrontOrderHint: 'To order, open the app and choose a tariff in the Store.',
    loginCode: 'Login code: <b>{code}</b>\n\nIt is valid for {minutes} minutes. Do not share it with anyone.',
    unknownCommand: 'Write an expense or income in normal words. Slash commands are not needed here.',
    done: 'Done.',
    written: 'Recorded.',
    checkAction: 'Check the action.',
    needConfirm: 'Confirmation is needed.',
    clarify: 'Please add the missing details.',
    failed: 'I could not complete the request.',
    limitEnded: 'This feature limit seems to be over. Check limits in the Store or write the command as text.',
    badRequest: 'I could not read the request. Write it a bit shorter.',
    unauthorized: 'I could not link this message to your profile. Open Fina from Telegram and try again.',
    voiceUnavailable: 'Voice messages are not available now. Write the command as text.',
    voiceTooLarge: 'The voice message is too long. Record a shorter one or write text.',
    voiceUnsupported: 'I could not read this voice format. Write the command as text.',
    voiceProvider: 'I could not recognize the voice message. Write text or try again later.',
    voiceEmpty: 'I did not catch the voice message. Write text or record it again.',
    unsupportedMessage: 'I currently understand text and voice messages. Write an expense or income in normal words.',
    confirm: 'Confirm',
    cancel: 'Cancel',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    unavailable: 'Action is unavailable',
  },
  ru: {
    openApp: 'Открыть Фину',
    chooseLanguageTitle: 'Выберите язык.',
    chooseLanguageCaption: 'После выбора бот и приложение будут использовать один язык.',
    languageEnglish: 'English',
    languageRussian: 'Русский',
    languageSaved: 'Язык сохранён',
    start: 'Фина помогает вести расходы, доходы, счета, цели и отчёты. Напишите финансовый запрос здесь или откройте приложение.',
    startExamples: 'Примеры: «Потратил на кофе», «Получил зарплату», «Создай цель на отпуск».',
    openStore: 'Открыть магазин',
    storefrontTitle: 'Фина',
    storefrontIntro: 'AI сервис для учета личных финансов в Telegram. В приложении можно вести расходы, доходы, счета, цели, лимиты, напоминания, финансовый календарь и аналитику.',
    storefrontPremiumTitle: 'Premium',
    storefrontPremiumPrice: '399 рублей в месяц',
    storefrontPremiumDescription: 'Расширенный голосовой ввод, аналитика, цели, лимиты, напоминания и финансовый календарь.',
    storefrontBusinessTitle: 'Business',
    storefrontBusinessPrice: '899 рублей в месяц',
    storefrontBusinessDescription: 'Расширенные возможности для учета рабочих и бизнес финансов.',
    storefrontOneTimeTitle: 'Разовые пакеты',
    storefrontVoicePack: 'Пакет голосовых команд: 99 рублей',
    storefrontReceiptPack: 'Пакет чеков: 199 рублей',
    storefrontOrderHint: 'Для оформления заказа откройте приложение и выберите тариф в магазине.',
    loginCode: 'Код входа: <b>{code}</b>\n\nОн действует {minutes} минут. Не отправляйте его другим людям.',
    unknownCommand: 'Напишите расход или доход обычной фразой. Команды с косой чертой здесь не нужны.',
    done: 'Готово.',
    written: 'Записала.',
    checkAction: 'Проверьте действие.',
    needConfirm: 'Нужно подтверждение.',
    clarify: 'Уточните, пожалуйста, детали.',
    failed: 'Не получилось выполнить запрос.',
    limitEnded: 'Похоже, лимит для этой функции закончился. Проверьте лимиты в магазине или напишите команду текстом.',
    badRequest: 'Не получилось разобрать запрос. Напишите его чуть короче.',
    unauthorized: 'Не получилось связать сообщение с пользователем. Откройте Фину из Telegram и попробуйте снова.',
    voiceUnavailable: 'Голосовые сообщения сейчас недоступны. Напишите команду текстом.',
    voiceTooLarge: 'Голосовое слишком длинное. Запишите короче или напишите текстом.',
    voiceUnsupported: 'Не получилось прочитать формат голосового. Напишите команду текстом.',
    voiceProvider: 'Не получилось распознать голосовое. Напишите команду текстом или попробуйте позже.',
    voiceEmpty: 'Не расслышала голосовое. Напишите команду текстом или попробуйте записать ещё раз.',
    unsupportedMessage: 'Сейчас я понимаю текстовые и голосовые сообщения. Напишите расход или доход обычной фразой.',
    confirm: 'Подтвердить',
    cancel: 'Отменить',
    confirmed: 'Подтверждено',
    cancelled: 'Отменено',
    unavailable: 'Действие недоступно',
  },
} satisfies Record<UserLocale, Record<string, string>>;

export function botT(locale: UserLocale, key: keyof typeof botText.en, params?: Record<string, string | number>) {
  let value = botText[locale][key] || botText.en[key] || key;
  Object.entries(params ?? {}).forEach(([paramKey, paramValue]) => {
    value = value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
  });
  return value;
}

export function getBotLanguageLabels() {
  return {
    en: botText.en.languageEnglish,
    ru: botText.ru.languageRussian,
  };
}


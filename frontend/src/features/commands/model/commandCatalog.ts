export type CommandCatalogItem = {
  id: string;
  label: string;
  description: string;
  command: string;
  group: 'money' | 'organization' | 'analysis' | 'navigation' | 'settings';
};

export const navigationCommands: CommandCatalogItem[] = [
  {
    id: 'expense-coffee',
    label: 'Добавить расход',
    description: 'AI поймёт сумму, категорию и счёт из обычной фразы.',
    command: 'кофе 300',
    group: 'money',
  },
  {
    id: 'income-salary',
    label: 'Добавить доход',
    description: 'AI покажет проверку и попросит подтверждение, если оно нужно.',
    command: 'доход 50000 на основной счет',
    group: 'money',
  },
  {
    id: 'transfer-saving',
    label: 'Перевести деньги',
    description: 'AI подготовит безопасное действие с подтверждением.',
    command: 'переведи 3000 с карты на накопительный',
    group: 'money',
  },
  {
    id: 'create-goal',
    label: 'Создать цель',
    description: 'Цели можно создать голосом или вручную.',
    command: 'создай цель отпуск 120000',
    group: 'organization',
  },
  {
    id: 'rename-account',
    label: 'Переименовать счёт',
    description: 'AI изменит существующий счёт, а не создаст новый.',
    command: 'переименуй счет карта в основная карта',
    group: 'organization',
  },
  {
    id: 'delete-all-accounts',
    label: 'Удалить все счета',
    description: 'Опасное действие. AI обязательно покажет подтверждение.',
    command: 'удали все счета',
    group: 'organization',
  },
  {
    id: 'create-account-travel',
    label: 'Создать счёт',
    description: 'Счета можно создавать через AI без поиска нужной формы.',
    command: 'создай счет отпуск',
    group: 'organization',
  },
  {
    id: 'set-primary-cash',
    label: 'Сделать счёт основным',
    description: 'Настройки финансов доступны обычным языком.',
    command: 'сделай наличку основной',
    group: 'settings',
  },
  {
    id: 'strict-mode',
    label: 'Включить строгий режим',
    description: 'AI-поведение можно менять без ручного поиска настроек.',
    command: 'включи строгий финансовый режим',
    group: 'settings',
  },
  {
    id: 'stats-week',
    label: 'Спросить статистику',
    description: 'Базовая аналитика остаётся понятной и не похожей на BI-панель.',
    command: 'сколько я потратил за неделю',
    group: 'analysis',
  },
  {
    id: 'stats-month-compare',
    label: 'Сравнить месяцы',
    description: 'AI помогает увидеть финансовую динамику человеческим языком.',
    command: 'сравни этот месяц с прошлым',
    group: 'analysis',
  },
  {
    id: 'open-dashboard',
    label: 'Открыть главную',
    description: 'Быстрый переход к живой финансовой сводке.',
    command: 'покажи главную',
    group: 'navigation',
  },
  {
    id: 'open-transactions',
    label: 'Открыть операции',
    description: 'Переход к истории операций.',
    command: 'покажи историю операций',
    group: 'navigation',
  },
  {
    id: 'open-accounts',
    label: 'Открыть счета',
    description: 'Быстрый переход к счетам и балансам.',
    command: 'открой мои счета',
    group: 'navigation',
  },
  {
    id: 'open-analytics',
    label: 'Открыть аналитику',
    description: 'Переход к понятной финансовой аналитике.',
    command: 'покажи аналитику',
    group: 'navigation',
  },
  {
    id: 'open-goals',
    label: 'Открыть цели',
    description: 'Переход к спокойным долгосрочным целям.',
    command: 'открой цели',
    group: 'navigation',
  },
  {
    id: 'open-companion',
    label: 'Открыть помощника',
    description: 'Переход к помощнику.',
    command: 'открой помощника',
    group: 'navigation',
  },
  {
    id: 'open-settings',
    label: 'Открыть настройки',
    description: 'Переход к настройкам AI, голоса и финансов.',
    command: 'открой настройки',
    group: 'navigation',
  },
  {
    id: 'open-taxonomy',
    label: 'Открыть разделы и категории',
    description: 'Переход во вложенную настройку структуры финансов.',
    command: 'открой разделы и категории',
    group: 'navigation',
  },
];

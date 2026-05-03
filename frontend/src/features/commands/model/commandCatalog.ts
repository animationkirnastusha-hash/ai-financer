export type CommandCatalogItem = {
  id: string;
  label: string;
  description: string;
  command: string;
  group: 'money' | 'navigation' | 'analysis';
};

export const navigationCommands: CommandCatalogItem[] = [
  {
    id: 'expense-coffee',
    label: 'Добавить расход',
    description: 'AI поймёт категорию, сумму и счёт из обычной фразы.',
    command: 'я купил кофе за 350 с карты',
    group: 'money',
  },
  {
    id: 'income-salary',
    label: 'Добавить доход',
    description: 'Можно говорить естественно, без шаблона.',
    command: 'мне пришла зарплата 50000 на основной счёт',
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
    id: 'stats-food',
    label: 'Спросить статистику',
    description: 'Покажи расходы по категории или за период.',
    command: 'сколько я потратил на еду в этом месяце',
    group: 'analysis',
  },
  {
    id: 'open-dashboard',
    label: 'Открыть Dashboard',
    description: 'Голосовая навигация остаётся доступной.',
    command: 'покажи главную',
    group: 'navigation',
  },
  {
    id: 'open-accounts',
    label: 'Открыть счета',
    description: 'Быстрый переход к счетам.',
    command: 'открой мои счета',
    group: 'navigation',
  },
  {
    id: 'open-transactions',
    label: 'Открыть историю',
    description: 'Быстрый переход к операциям.',
    command: 'покажи историю операций',
    group: 'navigation',
  },
];
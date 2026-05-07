export type CommandCatalogItem = {
  id: string;
  label: string;
  description: string;
  command: string;
  group: 'money' | 'organization' | 'analysis' | 'navigation';
};

export const navigationCommands: CommandCatalogItem[] = [
  {
    id: 'expense-coffee',
    label: 'Добавить расход',
    description: 'AI поймёт сумму, категорию, раздел и счёт из обычной фразы.',
    command: 'я купил кофе за 350 с карты в раздел работа',
    group: 'money',
  },
  {
    id: 'income-salary',
    label: 'Добавить доход',
    description: 'Доходы остаются базовой функцией и проходят через понятное подтверждение.',
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
    id: 'create-section-home',
    label: 'Создать раздел',
    description: 'Разделы — это базовая структура финансов. Их можно создать вручную или через AI.',
    command: 'создай раздел Дом',
    group: 'organization',
  },
  {
    id: 'create-category-products',
    label: 'Создать категорию',
    description: 'Категории можно настраивать через AI или в настройках.',
    command: 'создай категорию Продукты в разделе Дом',
    group: 'organization',
  },
  {
    id: 'move-products-to-home',
    label: 'Распределить расходы',
    description: 'AI может массово привязать расходы к разделу без ручного перебора.',
    command: 'запиши все расходы по продуктам в раздел Дом',
    group: 'organization',
  },
  {
    id: 'move-mood-expenses',
    label: 'Настроить правило раздела',
    description: 'Подходит для личных сценариев: развлечения, настроение, дом, работа.',
    command: 'запиши все расходы на водку в раздел Настроение',
    group: 'organization',
  },
  {
    id: 'stats-food',
    label: 'Спросить статистику',
    description: 'Base показывает понятную базовую аналитику без ощущения урезания.',
    command: 'сколько я потратил на еду в этом месяце',
    group: 'analysis',
  },
  {
    id: 'open-dashboard',
    label: 'Открыть Dashboard',
    description: 'Быстрый переход к сводке.',
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
    id: 'open-taxonomy',
    label: 'Открыть разделы и категории',
    description: 'Переход во вложенную страницу настроек структуры финансов.',
    command: 'открой разделы и категории',
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

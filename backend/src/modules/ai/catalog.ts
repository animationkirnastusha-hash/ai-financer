export const categoryAliases: Record<string, string> = {
  кофе: 'Кафе',
  кафе: 'Кафе',
  cappuccino: 'Кафе',
  капучино: 'Кафе',
  латте: 'Кафе',
  еда: 'Еда',
  продукты: 'Еда',
  обед: 'Еда',
  ужин: 'Еда',
  завтрак: 'Еда',
  ресторан: 'Еда',
  такси: 'Такси',
  taxi: 'Такси',
  транспорт: 'Транспорт',
  метро: 'Транспорт',
  автобус: 'Транспорт',
  зарплата: 'Зарплата',
  аванс: 'Зарплата',
  доход: 'Зарплата',
  премия: 'Зарплата',
  фриланс: 'Зарплата',
};

export const categoryIcons: Record<string, string> = {
  Кафе: '☕',
  Еда: '🍕',
  Такси: '🚕',
  Транспорт: '🚗',
  Зарплата: '💰',
};

export const categoryColors: Record<'expense' | 'income', string> = {
  expense: '#ff6b6b',
  income: '#00ffaa',
};

export function toTitleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function normalizeCategoryName(raw: string) {
  const cleaned = raw.trim().toLowerCase();
  return categoryAliases[cleaned] ?? cleaned;
}
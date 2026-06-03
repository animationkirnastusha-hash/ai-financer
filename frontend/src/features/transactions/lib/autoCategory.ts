import type { CategoryDto } from '@/features/sections/api/sections.api';

export type TransactionKindForCategory = 'income' | 'expense';

const EXPENSE_ALIASES: Record<string, string[]> = {
  'кофе': ['кофе', 'капучино', 'латте', 'американо', 'эспрессо', 'кофейня'],
  'еда': ['еда', 'обед', 'ужин', 'завтрак', 'кафе', 'ресторан', 'рестик', 'перекус', 'доставка'],
  'продукты': ['продукты', 'магазин', 'супермаркет', 'пятерочка', 'пятёрочка', 'перекресток', 'перекрёсток', 'магнит', 'лента'],
  'транспорт': ['такси', 'метро', 'автобус', 'трамвай', 'транспорт', 'каршеринг', 'проезд'],
  'бензин': ['бензин', 'топливо', 'заправка', 'азс', 'дт'],
  'дом': ['дом', 'квартира', 'аренда', 'жкх', 'коммуналка', 'интернет'],
  'здоровье': ['аптека', 'лекарства', 'врач', 'клиника', 'здоровье'],
  'одежда': ['одежда', 'обувь', 'кроссовки', 'куртка'],
  'развлечения': ['кино', 'игры', 'развлечения', 'бар', 'концерт'],
  'подписки': ['подписка', 'netflix', 'spotify', 'youtube', 'яндекс плюс', 'плюс'],
};

const INCOME_ALIASES: Record<string, string[]> = {
  'зарплата': ['зарплата', 'аванс', 'зп'],
  'доход': ['доход', 'поступление', 'прибыль'],
  'подарок': ['подарок', 'подарили'],
  'возврат': ['возврат', 'вернули', 'кэшбек', 'кешбек'],
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9\s]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function supportsType(category: CategoryDto, kind: TransactionKindForCategory) {
  return !category.type || category.type === 'both' || category.type === kind;
}

function scoreCategory(category: CategoryDto, text: string, aliases: Record<string, string[]>) {
  const categoryName = normalize(category.name);
  let score = 0;

  if (categoryName && text.includes(categoryName)) score += 100;

  for (const [target, words] of Object.entries(aliases)) {
    const targetName = normalize(target);
    const categoryLooksRelevant = categoryName.includes(targetName) || targetName.includes(categoryName);
    const matchedWords = words.filter((word) => text.includes(normalize(word))).length;

    if (categoryLooksRelevant && matchedWords > 0) score += 80 + matchedWords * 8;
    else if (matchedWords > 0 && words.some((word) => categoryName.includes(normalize(word)))) score += 55 + matchedWords * 5;
  }

  return score;
}

export function suggestCategoryId(params: {
  description: string;
  type: TransactionKindForCategory;
  categories: CategoryDto[];
}) {
  const text = normalize(params.description);
  if (text.length < 2) return null;

  const aliases = params.type === 'income' ? INCOME_ALIASES : EXPENSE_ALIASES;

  const scored = params.categories
    .filter((category) => supportsType(category, params.type))
    .map((category) => ({ category, score: scoreCategory(category, text, aliases) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.category.id ?? null;
}

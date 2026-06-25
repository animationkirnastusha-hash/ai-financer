export type SemanticTransactionTaxonomyInput = {
  kind: 'income' | 'expense';
  title?: string | null;
  description?: string | null;
  sectionName?: string | null;
  categoryName?: string | null;
  merchant?: string | null;
  place?: string | null;
  items?: unknown;
  tags?: unknown;
};

export type SemanticTransactionTaxonomy = {
  categoryName: string;
  sectionName: string;
  categoryIcon: string;
  sectionIcon: string;
  categoryColor: string;
  sectionColor: string;
  titleFallback?: string;
  descriptionFallback?: string | null;
  source: 'ai' | 'fallback' | 'curated';
};

export type CuratedTransactionTaxonomy = {
  categoryName: string;
  sectionName: string;
  source: 'input' | 'curated';
};

const EXPENSE_FALLBACK = {
  categoryName: 'Прочие расходы',
  sectionName: '',
  categoryIcon: '🧾',
  sectionIcon: '🧾',
  categoryColor: '#60A5FA',
  sectionColor: '#60A5FA',
};

const INCOME_FALLBACK = {
  categoryName: 'Прочие доходы',
  sectionName: '',
  categoryIcon: '💰',
  sectionIcon: '💰',
  categoryColor: '#34D399',
  sectionColor: '#34D399',
};

const CATEGORY_APPEARANCE: Record<string, { icon: string; color: string }> = {
  'доход': { icon: '💰', color: '#34D399' },
  'прочие доходы': { icon: '💰', color: '#34D399' },
  'зарплата': { icon: '💼', color: '#34D399' },
  'переводы': { icon: '↔️', color: '#60A5FA' },
  'возвраты': { icon: '↩️', color: '#2DD4BF' },
  'расход': { icon: '🧾', color: '#60A5FA' },
  'прочие расходы': { icon: '🧾', color: '#60A5FA' },
  'продукты': { icon: '🛒', color: '#34D399' },
  'кафе и рестораны': { icon: '☕', color: '#F59E0B' },
  'транспорт': { icon: '🚕', color: '#60A5FA' },
  'авто': { icon: '⛽', color: '#60A5FA' },
  'здоровье': { icon: '💊', color: '#2DD4BF' },
  'дом': { icon: '🏠', color: '#FBBF24' },
  'жкх': { icon: '🏠', color: '#FBBF24' },
  'связь и интернет': { icon: '📱', color: '#38BDF8' },
  'одежда': { icon: '👕', color: '#F472B6' },
  'развлечения': { icon: '🎮', color: '#C4B5FD' },
  'отдых': { icon: '🌴', color: '#C4B5FD' },
  'подписки': { icon: '🔁', color: '#A78BFA' },
  'кредиты': { icon: '🏦', color: '#FB7185' },
  'подарки': { icon: '🎁', color: '#F472B6' },
  'дети и семья': { icon: '👨‍👩‍👧', color: '#FBBF24' },
  'образование': { icon: '📚', color: '#38BDF8' },
  'путешествия': { icon: '✈️', color: '#60A5FA' },
  'работа': { icon: '💼', color: '#94A3B8' },
};

const CATEGORY_REPLACEMENTS: Record<string, string> = {
  'еда': 'Продукты',
  'еда дома': 'Продукты',
  'супермаркет': 'Продукты',
  'продуктовый': 'Продукты',
  'продуктовый магазин': 'Продукты',
  'магазин продуктов': 'Продукты',
  'мясо и колбасы': 'Продукты',
  'молочные продукты': 'Продукты',
  'молочка': 'Продукты',
  'хлеб и выпечка': 'Продукты',
  'овощи': 'Продукты',
  'фрукты': 'Продукты',
  'рыба и морепродукты': 'Продукты',
  'напитки': 'Продукты',
  'кофе': 'Кафе и рестораны',
  'кафе': 'Кафе и рестораны',
  'рестораны': 'Кафе и рестораны',
  'фастфуд': 'Кафе и рестораны',
  'хотдог': 'Кафе и рестораны',
  'энергетик': 'Кафе и рестораны',
  'такси': 'Транспорт',
  'метро': 'Транспорт',
  'автобус': 'Транспорт',
  'маршрутка': 'Транспорт',
  'трамвай': 'Транспорт',
  'азс': 'Авто',
  'заправка': 'Авто',
  'покупки на азс': 'Авто',
  'бензин': 'Авто',
  'топливо': 'Авто',
  'мойка': 'Авто',
  'шиномонтаж': 'Авто',
  'аптека': 'Здоровье',
  'лекарства': 'Здоровье',
  'врачи': 'Здоровье',
  'интернет': 'Связь и интернет',
  'телефон': 'Связь и интернет',
  'мобильная связь': 'Связь и интернет',
  'коммуналка': 'ЖКХ',
  'коммунальные услуги': 'ЖКХ',
  'квартплата': 'ЖКХ',
  'табак': 'Прочие расходы',
  'сигареты': 'Прочие расходы',
  'прочее': 'Прочие расходы',
  'разное': 'Прочие расходы',
  'зарплата': 'Зарплата',
  'аванс': 'Зарплата',
  'income': 'Прочие доходы',
  'expense': 'Прочие расходы',
};

function clean(value?: string | null) {
  return (value ?? '').trim().replace(/[«»"]/g, '').replace(/\s+/g, ' ');
}

function key(value?: string | null) {
  return clean(value).toLowerCase().replace(/ё/g, 'е');
}

function textIncludesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function isSameText(left?: string | null, right?: string | null) {
  return key(left) === key(right);
}

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(value
    .map((item) => clean(String(item ?? '')))
    .filter((item) => item.length >= 2 && item.length <= 48)))
    .slice(0, 8);
}

function buildSearchText(input: SemanticTransactionTaxonomyInput) {
  return [
    input.title,
    input.description,
    input.categoryName,
    input.merchant,
    input.place,
    ...cleanList(input.items),
    ...cleanList(input.tags),
  ].map((item) => key(item ?? '')).filter(Boolean).join(' ');
}

function fallbackFor(kind: 'income' | 'expense') {
  return kind === 'income' ? INCOME_FALLBACK : EXPENSE_FALLBACK;
}

function appearance(name: string, kind: 'income' | 'expense') {
  const fallback = fallbackFor(kind);
  const exact = CATEGORY_APPEARANCE[key(name)];
  return {
    icon: exact?.icon ?? fallback.categoryIcon,
    color: exact?.color ?? fallback.categoryColor,
  };
}

export function normalizeTransactionCategoryName(value: string, kind: 'income' | 'expense' = 'expense') {
  const cleaned = clean(value);
  if (!cleaned) return '';
  const normalized = key(cleaned);
  if (kind === 'income') {
    if (['доход', 'доходы', 'поступление', 'поступления', 'прочее', 'разное'].includes(normalized)) return 'Прочие доходы';
    return CATEGORY_REPLACEMENTS[normalized] ?? cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (['расход', 'расходы', 'трата', 'траты', 'операция', 'операции', 'прочее', 'разное'].includes(normalized)) return 'Прочие расходы';
  return CATEGORY_REPLACEMENTS[normalized] ?? cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function inferSemanticCategory(input: SemanticTransactionTaxonomyInput): CuratedTransactionTaxonomy | null {
  const text = buildSearchText(input);
  if (!text) return null;

  if (input.kind === 'income') {
    if (textIncludesAny(text, ['зарплат', 'salary', 'аванс'])) {
      return { categoryName: 'Зарплата', sectionName: '', source: 'curated' };
    }
    if (textIncludesAny(text, ['возврат', 'кешбек', 'cashback'])) {
      return { categoryName: 'Возвраты', sectionName: '', source: 'curated' };
    }
    return null;
  }

  const hasAzs = textIncludesAny(text, ['азс', 'заправк', 'заправоч', 'бензоколон']);
  const hasFuel = textIncludesAny(text, ['бензин', 'топлив', 'аи 92', 'аи-92', 'аи 95', 'аи-95', 'дизел']);
  const hasTobacco = textIncludesAny(text, ['сигар', 'табак', 'вейп']);
  const hasCafeFood = textIncludesAny(text, ['кофе', 'капучино', 'латте', 'эспрессо', 'хотдог', 'шаурм', 'бургер', 'кафе', 'ресторан', 'фастфуд', 'энергетик']);

  if (hasAzs || hasFuel) return { categoryName: 'Авто', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['такси', 'яндекс такси', 'taxi', 'метро', 'автобус', 'маршрут', 'трамвай'])) return { categoryName: 'Транспорт', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['аптек', 'лекарств', 'витамин', 'здоров', 'врач', 'клиник'])) return { categoryName: 'Здоровье', sectionName: '', source: 'curated' };
  if (hasCafeFood) return { categoryName: 'Кафе и рестораны', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['продукт', 'молоко', 'молоч', 'хлеб', 'овощ', 'фрукт', 'сыр', 'супермаркет', 'магазин продуктов'])) return { categoryName: 'Продукты', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['коммунал', 'квартплат', 'жкх', 'электрич', 'вода', 'газ'])) return { categoryName: 'ЖКХ', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['интернет', 'телефон', 'мобильн', 'связь'])) return { categoryName: 'Связь и интернет', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['одежд', 'обув', 'куртк', 'футболк'])) return { categoryName: 'Одежда', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['подписк', 'netflix', 'spotify', 'яндекс плюс', 'сервис'])) return { categoryName: 'Подписки', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['кредит', 'ипотек', 'рассроч'])) return { categoryName: 'Кредиты', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['развлеч', 'кино', 'игр', 'театр'])) return { categoryName: 'Развлечения', sectionName: '', source: 'curated' };
  if (textIncludesAny(text, ['отдых', 'отпуск', 'путешеств', 'билет', 'отель'])) return { categoryName: 'Отдых', sectionName: '', source: 'curated' };
  if (hasTobacco) return { categoryName: 'Прочие расходы', sectionName: '', source: 'curated' };

  return null;
}

export function curateStructuredTransactionTaxonomy(input: SemanticTransactionTaxonomyInput): CuratedTransactionTaxonomy {
  const fallback = fallbackFor(input.kind);
  const aiCategory = normalizeTransactionCategoryName(clean(input.categoryName), input.kind);
  const inferred = inferSemanticCategory(input);

  if (inferred) {
    const generic = !aiCategory || key(aiCategory) === key(fallback.categoryName);
    const groceriesFromMixedAzs = inferred.categoryName === 'Авто' && key(aiCategory) === 'продукты';
    const groceriesFromSnack = inferred.categoryName === 'Кафе и рестораны' && key(aiCategory) === 'продукты' && textIncludesAny(buildSearchText(input), ['хотдог', 'хот-дог', 'кофе', 'бургер', 'фастфуд', 'энергетик']);
    if (generic || groceriesFromMixedAzs || groceriesFromSnack) return inferred;
    return { categoryName: normalizeTransactionCategoryName(aiCategory, input.kind), sectionName: '', source: inferred.source };
  }

  return {
    categoryName: aiCategory || fallback.categoryName,
    sectionName: '',
    source: aiCategory ? 'input' : 'curated',
  };
}

export function resolveTransactionSemanticTaxonomy(input: SemanticTransactionTaxonomyInput): SemanticTransactionTaxonomy {
  const curated = curateStructuredTransactionTaxonomy(input);
  const fallback = fallbackFor(input.kind);
  const categoryName = curated.categoryName || fallback.categoryName;
  const categoryAppearance = appearance(categoryName, input.kind);
  const source: SemanticTransactionTaxonomy['source'] = curated.source === 'curated'
    ? 'curated'
    : clean(input.categoryName) ? 'ai' : 'fallback';

  return {
    categoryName,
    sectionName: '',
    categoryIcon: categoryAppearance.icon,
    sectionIcon: categoryAppearance.icon,
    categoryColor: categoryAppearance.color,
    sectionColor: categoryAppearance.color,
    source,
    titleFallback: categoryName,
    descriptionFallback: buildCuratedDescriptionFallback(input, categoryName),
  };
}

function titleLooksLikePlaceOnly(value: string) {
  const normalized = key(value);
  return ['азс', 'заправка', 'заправке', 'магазин', 'кафе', 'аптека'].includes(normalized);
}

function normalizeComposition(value?: string | null) {
  return clean(value)
    .replace(/\s+и\s+/gi, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,+/g, ',')
    .trim();
}

function buildCuratedDescriptionFallback(input: SemanticTransactionTaxonomyInput, categoryName: string) {
  const description = clean(input.description);
  const normalizedDescription = key(description);
  const search = buildSearchText(input);

  if (key(categoryName) === 'авто' && textIncludesAny(search, ['азс', 'заправк']) && !normalizedDescription.includes('место:') && !normalizedDescription.includes('place:')) {
    const composition = normalizeComposition(description);
    return [
      'Место: АЗС',
      composition ? `Состав: ${composition}` : '',
    ].filter(Boolean).join(' · ') || null;
  }

  return null;
}

export function shouldUseTaxonomyTitleFallback(params: {
  rawTitle?: string | null;
  rawDescription?: string | null;
  categoryName?: string | null;
}) {
  const title = clean(params.rawTitle);
  if (!title) return false;

  if (title.length > 48) return true;
  if (isSameText(title, params.rawDescription)) return true;
  if (titleLooksLikePlaceOnly(title)) return true;

  const wordCount = title.split(' ').filter(Boolean).length;
  if (wordCount >= 4 && /[:;·]/.test(title)) return true;

  const category = clean(params.categoryName);
  if (category && title.length > category.length + 18 && title.toLowerCase().includes(category.toLowerCase())) {
    return true;
  }

  return false;
}

function hasCyrillic(value: string) {
  return /[а-яё]/i.test(value);
}

export function buildStructuredTransactionDescription(params: {
  description?: string | null;
  merchant?: unknown;
  place?: unknown;
  items?: unknown;
  tags?: unknown;
}) {
  const description = clean(params.description);
  const place = clean(String(params.merchant ?? params.place ?? ''));
  const items = cleanList(params.items);
  const tags = cleanList(params.tags);
  const languageSeed = [description, place, ...items, ...tags].join(' ');
  const ru = hasCyrillic(languageSeed);
  const parts = [
    description,
    place ? `${ru ? 'Место' : 'Place'}: ${place}` : '',
    items.length ? `${ru ? 'Состав' : 'Items'}: ${items.join(', ')}` : '',
    tags.length ? `${ru ? 'Теги' : 'Tags'}: ${tags.join(', ')}` : '',
  ].filter(Boolean);

  return Array.from(new Set(parts)).join(' · ') || null;
}

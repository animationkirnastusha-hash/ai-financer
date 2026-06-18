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
  categoryName: 'Расход',
  sectionName: 'Расходы',
  categoryIcon: '🧾',
  sectionIcon: '🧾',
  categoryColor: '#60A5FA',
  sectionColor: '#60A5FA',
};

const INCOME_FALLBACK = {
  categoryName: 'Доход',
  sectionName: 'Доходы',
  categoryIcon: '💰',
  sectionIcon: '💰',
  categoryColor: '#34D399',
  sectionColor: '#34D399',
};

const APPEARANCE: Record<string, { icon: string; color: string }> = {
  'доход': { icon: '💰', color: '#34D399' },
  'доходы': { icon: '💰', color: '#34D399' },
  'зарплата': { icon: '💼', color: '#34D399' },
  'расход': { icon: '🧾', color: '#60A5FA' },
  'расходы': { icon: '🧾', color: '#60A5FA' },
  'дом': { icon: '🏠', color: '#FBBF24' },
  'продукты': { icon: '🛒', color: '#34D399' },
  'еда вне дома': { icon: '☕', color: '#F59E0B' },
  'кофе': { icon: '☕', color: '#F59E0B' },
  'азс': { icon: '⛽', color: '#60A5FA' },
  'покупки на азс': { icon: '⛽', color: '#60A5FA' },
  'бензин': { icon: '⛽', color: '#60A5FA' },
  'транспорт': { icon: '🚕', color: '#60A5FA' },
  'такси': { icon: '🚕', color: '#60A5FA' },
  'здоровье': { icon: '💊', color: '#2DD4BF' },
  'аптека': { icon: '💊', color: '#2DD4BF' },
  'отдых': { icon: '🎮', color: '#C4B5FD' },
  'развлечения': { icon: '🎮', color: '#C4B5FD' },
  'покупки': { icon: '🛍️', color: '#F472B6' },
  'табак': { icon: '🚬', color: '#64748B' },
  'чек': { icon: '🧾', color: '#60A5FA' },
  'покупка по чеку': { icon: '🧾', color: '#60A5FA' },
};

const CURATED_CATEGORY_REPLACEMENTS: Record<string, string> = {
  'мясо и колбасы': 'Продукты',
  'молочные продукты': 'Продукты',
  'молочка': 'Продукты',
  'хлеб и выпечка': 'Продукты',
  'овощи': 'Продукты',
  'фрукты': 'Продукты',
  'рыба и морепродукты': 'Продукты',
  'напитки': 'Продукты',
  'продуктовый магазин': 'Продукты',
  'магазин продуктов': 'Продукты',
};

const CURATED_SECTION_REPLACEMENTS: Record<string, string> = {
  'продуктовый магазин': 'Дом',
  'магазин': 'Дом',
  'повседневные расходы': 'Дом',
  'продукты': 'Дом',
  'расходы': '',
  'расход': '',
  'траты': '',
  'прочее': '',
  'разное': '',
};

const CURATED_CATEGORY_SECTIONS: Record<string, string> = {
  'продукты': 'Дом',
  'кофе': 'Еда вне дома',
  'покупки на азс': 'АЗС',
  'бензин': 'Транспорт',
  'такси': 'Транспорт',
  'аптека': 'Здоровье',
  'табак': 'Покупки',
  'отдых': 'Отдых',
  'развлечения': 'Отдых',
  'зарплата': 'Доходы',
  'покупка по чеку': 'Чек',
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
    input.sectionName,
    input.categoryName,
    input.merchant,
    input.place,
    ...cleanList(input.items),
    ...cleanList(input.tags),
  ].map((item) => key(item ?? '')).filter(Boolean).join(' ');
}

function appearance(name: string, fallback: typeof EXPENSE_FALLBACK, scope: 'category' | 'section') {
  const exact = APPEARANCE[key(name)];
  return {
    icon: exact?.icon ?? (scope === 'category' ? fallback.categoryIcon : fallback.sectionIcon),
    color: exact?.color ?? (scope === 'category' ? fallback.categoryColor : fallback.sectionColor),
  };
}

function buildGenericFallback(kind: 'income' | 'expense') {
  return kind === 'income' ? INCOME_FALLBACK : EXPENSE_FALLBACK;
}

function buildTaxonomy(params: {
  kind: 'income' | 'expense';
  categoryName: string;
  sectionName: string;
  source: SemanticTransactionTaxonomy['source'];
}) {
  const fallback = buildGenericFallback(params.kind);
  const categoryAppearance = appearance(params.categoryName, fallback, 'category');
  const sectionAppearance = appearance(params.sectionName, fallback, 'section');

  return {
    categoryName: params.categoryName,
    sectionName: params.sectionName,
    categoryIcon: categoryAppearance.icon,
    sectionIcon: sectionAppearance.icon,
    categoryColor: categoryAppearance.color,
    sectionColor: sectionAppearance.color,
    source: params.source,
  };
}

function replaceCuratedCategory(value: string) {
  if (!value) return '';
  return CURATED_CATEGORY_REPLACEMENTS[key(value)] ?? value;
}

function replaceCuratedSection(value: string) {
  if (!value) return '';
  return CURATED_SECTION_REPLACEMENTS[key(value)] ?? value;
}

function isGenericCategory(value: string, kind: 'income' | 'expense') {
  const normalized = key(value);
  if (!normalized) return true;
  if (kind === 'expense') return ['расход', 'трата', 'операция', 'прочее', 'разное', 'other', 'misc', 'expense', 'spending'].includes(normalized);
  return ['доход', 'поступление', 'операция', 'прочее', 'разное', 'other', 'misc', 'income', 'earning'].includes(normalized);
}

function isGenericSection(value: string, kind: 'income' | 'expense') {
  const normalized = key(value);
  if (!normalized) return true;
  if (kind === 'expense') return ['расходы', 'расход', 'траты', 'операции', 'прочее', 'разное', 'other', 'misc', 'expenses', 'spending'].includes(normalized);
  return ['доходы', 'доход', 'поступления', 'операции', 'прочее', 'разное', 'other', 'misc', 'income', 'earnings'].includes(normalized);
}

function inferSemanticTaxonomy(input: SemanticTransactionTaxonomyInput): CuratedTransactionTaxonomy | null {
  const text = buildSearchText(input);
  if (!text) return null;

  if (input.kind === 'income') {
    if (textIncludesAny(text, ['зарплат', 'salary', 'аванс'])) {
      return { categoryName: 'Зарплата', sectionName: 'Доходы', source: 'curated' };
    }
    return null;
  }

  const hasAzs = textIncludesAny(text, ['азс', 'заправк', 'заправоч', 'бензоколон']);
  const hasFuel = textIncludesAny(text, ['бензин', 'топлив', 'аи 92', 'аи-92', 'аи 95', 'аи-95', 'дизел']);
  const hasDrink = textIncludesAny(text, ['напит', 'кофе', 'чай', 'вода', 'сок']);
  const hasTobacco = textIncludesAny(text, ['сигар', 'табак', 'вейп']);

  if (hasAzs) {
    if (hasFuel && !hasDrink && !hasTobacco) {
      return { categoryName: 'Бензин', sectionName: 'Транспорт', source: 'curated' };
    }
    return { categoryName: 'Покупки на АЗС', sectionName: 'АЗС', source: 'curated' };
  }

  if (hasFuel) return { categoryName: 'Бензин', sectionName: 'Транспорт', source: 'curated' };
  if (textIncludesAny(text, ['такси', 'яндекс такси', 'taxi'])) return { categoryName: 'Такси', sectionName: 'Транспорт', source: 'curated' };
  if (textIncludesAny(text, ['аптек', 'лекарств', 'витамин', 'здоров'])) return { categoryName: 'Аптека', sectionName: 'Здоровье', source: 'curated' };
  if (textIncludesAny(text, ['кофе', 'капучино', 'латте', 'эспрессо'])) return { categoryName: 'Кофе', sectionName: 'Еда вне дома', source: 'curated' };
  if (hasTobacco) return { categoryName: 'Табак', sectionName: 'Покупки', source: 'curated' };
  if (textIncludesAny(text, ['продукт', 'молоко', 'молоч', 'хлеб', 'овощ', 'фрукт', 'сыр', 'магазин продуктов'])) {
    return { categoryName: 'Продукты', sectionName: 'Дом', source: 'curated' };
  }
  if (textIncludesAny(text, ['развлеч', 'кино', 'игр', 'театр'])) return { categoryName: 'Развлечения', sectionName: 'Отдых', source: 'curated' };
  if (textIncludesAny(text, ['отдых', 'отпуск'])) return { categoryName: 'Отдых', sectionName: 'Отдых', source: 'curated' };

  return null;
}

export function curateStructuredTransactionTaxonomy(input: SemanticTransactionTaxonomyInput): CuratedTransactionTaxonomy {
  const fallback = buildGenericFallback(input.kind);
  const aiCategory = replaceCuratedCategory(clean(input.categoryName));
  const aiSection = replaceCuratedSection(clean(input.sectionName));
  const inferred = inferSemanticTaxonomy(input);

  if (inferred) {
    const categoryWasGeneric = isGenericCategory(aiCategory, input.kind);
    const sectionWasGeneric = isGenericSection(aiSection, input.kind);
    const categoryLooksLikeGroceriesFromMixedAzs = inferred.categoryName === 'Покупки на АЗС' && key(aiCategory) === 'продукты';

    if (!aiCategory || categoryWasGeneric || categoryLooksLikeGroceriesFromMixedAzs) {
      return inferred;
    }

    const categorySection = CURATED_CATEGORY_SECTIONS[key(aiCategory)];
    return {
      categoryName: aiCategory,
      sectionName: !aiSection || sectionWasGeneric ? categorySection || inferred.sectionName : aiSection,
      source: inferred.source,
    };
  }

  const categoryName = aiCategory || fallback.categoryName;
  const sectionName = aiSection
    || CURATED_CATEGORY_SECTIONS[key(categoryName)]
    || fallback.sectionName;

  return {
    categoryName,
    sectionName,
    source: aiCategory || aiSection ? 'input' : 'curated',
  };
}

export function resolveTransactionSemanticTaxonomy(input: SemanticTransactionTaxonomyInput): SemanticTransactionTaxonomy {
  const curated = curateStructuredTransactionTaxonomy(input);
  const fallback = buildGenericFallback(input.kind);

  const categoryName = curated.categoryName || fallback.categoryName;
  const sectionName = curated.sectionName || fallback.sectionName;
  const source: SemanticTransactionTaxonomy['source'] = curated.source === 'curated'
    ? 'curated'
    : clean(input.categoryName) || clean(input.sectionName) ? 'ai' : 'fallback';

  return {
    ...buildTaxonomy({ kind: input.kind, categoryName, sectionName, source }),
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

  if (key(categoryName) === 'покупки на азс' && !normalizedDescription.includes('место:') && !normalizedDescription.includes('place:')) {
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

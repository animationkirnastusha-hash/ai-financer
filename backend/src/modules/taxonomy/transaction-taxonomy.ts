import { resolveTaxonomyForText, type TaxonomyMatch } from './taxonomy-icons';

export type SemanticTransactionTaxonomyInput = {
  kind: 'income' | 'expense';
  title?: string | null;
  description?: string | null;
  sectionName?: string | null;
  categoryName?: string | null;
};

export type SemanticTransactionTaxonomy = TaxonomyMatch & {
  titleFallback?: string;
  descriptionFallback?: string;
  semanticCategories?: string[];
  merchantName?: string | null;
};


const GROCERY_SECTION = {
  sectionName: 'Продуктовый магазин',
  sectionIcon: '🛒',
  sectionColor: '#34D399',
};

const GROCERY_CATEGORY = {
  categoryName: 'Продукты',
  categoryIcon: '🛒',
  categoryColor: '#34D399',
};

const GENERIC_GROCERY_WORDS = [
  'продукты',
  'продукт',
  'продуктовый',
  'продуктовом',
  'groceries',
  'grocery',
  'food store',
];

const SPECIFIC_GROCERY_WORDS = [
  'мясо', 'колбас', 'сосиск', 'ветчина', 'курица', 'говядина', 'свинина',
  'молоко', 'кефир', 'йогурт', 'сыр', 'творог', 'сметана',
  'хлеб', 'булка', 'выпечка', 'овощ', 'помидор', 'огурец', 'картоф',
  'фрукт', 'яблок', 'банан', 'рыба', 'морепродукт', 'сладост', 'шоколад',
  'meat', 'sausage', 'chicken', 'milk', 'cheese', 'bread', 'vegetable', 'fruit', 'fish',
];

const AZS_SECTION = {
  sectionName: 'АЗС',
  sectionIcon: '⛽',
  sectionColor: '#FB7185',
};

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Бензин: { icon: '⛽', color: '#FB7185' },
  Напитки: { icon: '🥤', color: '#2DD4BF' },
  Табак: { icon: '🚬', color: '#94A3B8' },
  'Покупки на АЗС': { icon: '🧾', color: '#F59E0B' },
};

const PLACE_AZS_WORDS = [
  'азс',
  'заправка',
  'заправке',
  'заправочную',
  'заправочной',
  'бензоколонка',
  'лукойл',
  'роснефть',
  'газпромнефть',
  'татнефть',
  'shell',
];

const FUEL_WORDS = [
  'бензин',
  'топливо',
  'дизель',
  'солярка',
  'заправился',
  'заправилась',
  'заправить',
  'заправил',
  'бак',
  'аи92',
  'аи95',
  'аи98',
  'а 92',
  'а 95',
  'а 98',
];

const DRINK_WORDS = [
  'напиток',
  'напитки',
  'вода',
  'энергетик',
  'газировка',
  'сок',
  'кола',
  'лимонад',
  'чай',
  'кофе',
  'капучино',
  'латте',
];

const TOBACCO_WORDS = [
  'сигарет',
  'сигареты',
  'сигарета',
  'табак',
  'вейп',
  'стики',
  'сигары',
  'iqos',
  'heets',
];

const SHOP_MARKER_WORDS = [
  'магазин',
  'маркет',
  'супермаркет',
  'гипермаркет',
  'лавка',
  'точка',
  'кафе',
  'ресторан',
  'аптека',
  'азс',
  'заправка',
  'заправке',
];

function normalize(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,;:!?()\[\]{}«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function composeDescription(original: string | null | undefined, details: string[]) {
  const parts = [original?.trim(), ...details].filter((part): part is string => Boolean(part && part.trim()));
  return uniq(parts).join(' · ');
}


function stripMerchantMetadata(value?: string | null) {
  return (value ?? '')
    .replace(/(^|[·;])\s*Место:\s*[^·;]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function looksLikePlaceOrMerchant(value?: string | null) {
  const text = normalize(value);
  if (!text) return false;
  return hasAny(text, SHOP_MARKER_WORDS);
}

export function buildMerchantAwareDescription(params: {
  original?: string | null;
  merchant?: string | null;
  details?: string[];
}) {
  const merchant = compactText(params.merchant);
  const details = params.details ?? [];
  return composeDescription(params.original, [
    merchant ? `Место: ${merchant}` : '',
    ...details,
  ]);
}

export function resolveTransactionSemanticTaxonomy(input: SemanticTransactionTaxonomyInput): SemanticTransactionTaxonomy {
  const text = normalize([
    input.title,
    input.description,
    input.sectionName,
    input.categoryName,
  ].filter(Boolean).join(' '));

  const baseDescription = stripMerchantMetadata(input.description);
  const base = resolveTaxonomyForText({
    kind: input.kind,
    title: input.categoryName || input.title || undefined,
    description: baseDescription || undefined,
  });

  if (input.kind !== 'expense') {
    return base;
  }

  const hasGenericGrocery = hasAny(text, GENERIC_GROCERY_WORDS);
  const hasSpecificGrocery = hasAny(text, SPECIFIC_GROCERY_WORDS);

  if (hasGenericGrocery && !hasSpecificGrocery) {
    return {
      ...GROCERY_SECTION,
      ...GROCERY_CATEGORY,
      titleFallback: 'Продукты',
      descriptionFallback: input.description ?? input.title ?? 'Продукты',
    };
  }

  const hasAzsPlace = hasAny(text, PLACE_AZS_WORDS);
  const hasFuel = hasAny(text, FUEL_WORDS);
  const hasDrink = hasAny(text, DRINK_WORDS);
  const hasTobacco = hasAny(text, TOBACCO_WORDS);

  if (hasAzsPlace) {
    const itemCategories = uniq([
      hasFuel ? 'Бензин' : '',
      hasDrink ? 'Напитки' : '',
      hasTobacco ? 'Табак' : '',
    ]);

    const mixedWithoutPrices = itemCategories.length > 1;
    const primaryCategory = mixedWithoutPrices
      ? 'Покупки на АЗС'
      : itemCategories[0] ?? 'Покупки на АЗС';
    const meta = CATEGORY_META[primaryCategory] ?? CATEGORY_META['Покупки на АЗС'];

    return {
      ...AZS_SECTION,
      categoryName: primaryCategory,
      categoryIcon: meta.icon,
      categoryColor: meta.color,
      semanticCategories: itemCategories,
      merchantName: 'АЗС',
      titleFallback: mixedWithoutPrices || !itemCategories.length ? 'Покупка на АЗС' : primaryCategory,
      descriptionFallback: composeDescription(input.description, [
        'Место: АЗС',
        itemCategories.length > 1
          ? `Состав: ${itemCategories.join(', ')}`
          : itemCategories.length === 1
            ? `Категория: ${itemCategories[0]}`
            : '',
      ]),
    };
  }

  return base;
}

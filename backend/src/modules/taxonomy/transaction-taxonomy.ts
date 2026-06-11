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
};

const AZS_SECTION = {
  sectionName: 'АЗС',
  sectionIcon: '⛽',
  sectionColor: '#FB7185',
};

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Напитки: { icon: '🥤', color: '#2DD4BF' },
  Табак: { icon: '🚬', color: '#94A3B8' },
};

const PLACE_AZS_WORDS = [
  'азс',
  'заправка',
  'заправке',
  'заправочной',
  'бензоколонка',
  'лукойл',
  'роснефть',
  'газпромнефть',
  'татнефть',
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
];

const TOBACCO_WORDS = [
  'сигарет',
  'сигареты',
  'сигарета',
  'табак',
  'вейп',
  'стики',
  'сигары',
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

export function resolveTransactionSemanticTaxonomy(input: SemanticTransactionTaxonomyInput): SemanticTransactionTaxonomy {
  const text = normalize([
    input.title,
    input.description,
    input.sectionName,
    input.categoryName,
  ].filter(Boolean).join(' '));

  const base = resolveTaxonomyForText({
    kind: input.kind,
    title: input.categoryName || input.title || undefined,
    description: input.description || undefined,
  });

  if (input.kind !== 'expense') {
    return base;
  }

  const hasAzsPlace = hasAny(text, PLACE_AZS_WORDS);
  const hasFuel = hasAny(text, FUEL_WORDS);
  const hasDrink = hasAny(text, DRINK_WORDS);
  const hasTobacco = hasAny(text, TOBACCO_WORDS);

  if (hasAzsPlace && !hasFuel && (hasDrink || hasTobacco)) {
    const semanticCategories = uniq([
      hasDrink ? 'Напитки' : '',
      hasTobacco ? 'Табак' : '',
    ]);
    const primaryCategory = semanticCategories[0] ?? 'Покупки';
    const meta = CATEGORY_META[primaryCategory] ?? { icon: '🧾', color: '#2DD4BF' };

    return {
      ...AZS_SECTION,
      categoryName: primaryCategory,
      categoryIcon: meta.icon,
      categoryColor: meta.color,
      semanticCategories,
      titleFallback: 'Покупка на АЗС',
      descriptionFallback: composeDescription(input.description, [
        'Место: АЗС',
        semanticCategories.length > 1 ? `Категории: ${semanticCategories.join(', ')}` : `Категория: ${primaryCategory}`,
      ]),
    };
  }

  return base;
}

export type TaxonomyEntryType = 'income' | 'expense' | 'both';

export type ResolvedTaxonomy = {
  type: 'income' | 'expense';
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  appearanceSource: 'exact_name' | 'stable_fallback';
};

export type TaxonomyKind = 'expense' | 'income';

export type TaxonomyMatch = {
  categoryName: string;
  sectionName: string;
  categoryIcon: string;
  sectionIcon: string;
  categoryColor: string;
  sectionColor: string;
};

const CATEGORY_COLOR_PALETTE = [
  '#34D399', '#60A5FA', '#FBBF24', '#F87171', '#C4B5FD', '#2DD4BF', '#F472B6', '#A3E635',
  '#FB923C', '#38BDF8', '#818CF8', '#FACC15', '#22C55E', '#06B6D4', '#E879F9', '#F97316',
];

const GENERIC_TAXONOMY_ICONS = new Set(['✨', '⭐', '🌟', '📌', '🗂️', '']);

const EXACT_SECTION_APPEARANCE: Record<string, { icon: string; color: string }> = {
  'расходы': { icon: '🧾', color: '#60A5FA' },
  'доходы': { icon: '💰', color: '#34D399' },
  'продукты': { icon: '🛒', color: '#34D399' },
  'groceries': { icon: '🛒', color: '#34D399' },
  'транспорт': { icon: '🚕', color: '#60A5FA' },
  'отдых': { icon: '🎮', color: '#C4B5FD' },
  'развлечения': { icon: '🎮', color: '#C4B5FD' },
  'досуг': { icon: '🎮', color: '#C4B5FD' },
  'transport': { icon: '🚕', color: '#60A5FA' },
  'дом': { icon: '🏠', color: '#FBBF24' },
  'home': { icon: '🏠', color: '#FBBF24' },
  'работа': { icon: '💼', color: '#818CF8' },
  'work': { icon: '💼', color: '#818CF8' },
  'подписки': { icon: '🔁', color: '#C4B5FD' },
  'subscriptions': { icon: '🔁', color: '#C4B5FD' },
};

const EXACT_CATEGORY_APPEARANCE: Record<string, { icon: string; color: string }> = {
  'расход': { icon: '🧾', color: '#60A5FA' },
  'доход': { icon: '💰', color: '#34D399' },
  'продукты': { icon: '🛒', color: '#34D399' },
  'groceries': { icon: '🛒', color: '#34D399' },
  'кофе': { icon: '☕', color: '#F59E0B' },
  'покупки на азс': { icon: '⛽', color: '#60A5FA' },
  'coffee': { icon: '☕', color: '#F59E0B' },
  'такси': { icon: '🚕', color: '#60A5FA' },
  'taxi': { icon: '🚕', color: '#60A5FA' },
  'зарплата': { icon: '💼', color: '#34D399' },
  'salary': { icon: '💼', color: '#34D399' },
};

function normalizeName(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function stableColor(value: string) {
  return CATEGORY_COLOR_PALETTE[hashString(value) % CATEGORY_COLOR_PALETTE.length];
}

function fallbackCategoryName(type: 'income' | 'expense') {
  return type === 'income' ? 'Доход' : 'Расход';
}

function fallbackSectionName(type: 'income' | 'expense') {
  return type === 'income' ? 'Доходы' : 'Расходы';
}

function fallbackIcon(type: 'income' | 'expense') {
  return type === 'income' ? '💰' : '🧾';
}

function exactCategoryAppearance(name: string, type: 'income' | 'expense') {
  const exact = EXACT_CATEGORY_APPEARANCE[normalizeName(name)];
  if (exact) return { ...exact, source: 'exact_name' as const };
  return {
    icon: fallbackIcon(type),
    color: stableColor(`${type}:category:${name}`),
    source: 'stable_fallback' as const,
  };
}

function exactSectionAppearance(name: string, type: 'income' | 'expense' = 'expense') {
  const exact = EXACT_SECTION_APPEARANCE[normalizeName(name)];
  if (exact) return { ...exact, source: 'exact_name' as const };
  return {
    icon: fallbackIcon(type),
    color: stableColor(`${type}:section:${name}`),
    source: 'stable_fallback' as const,
  };
}

export function shouldReplaceGenericIcon(icon?: string | null) {
  return GENERIC_TAXONOMY_ICONS.has((icon ?? '').trim());
}

export function resolveTaxonomyIcon(rawText: string, type: 'income' | 'expense'): ResolvedTaxonomy {
  const name = rawText.trim() || fallbackCategoryName(type);
  const categoryAppearance = exactCategoryAppearance(name, type);
  const sectionName = fallbackSectionName(type);
  const sectionAppearance = exactSectionAppearance(sectionName, type);

  return {
    type,
    sectionName,
    sectionIcon: sectionAppearance.icon,
    sectionColor: sectionAppearance.color,
    categoryName: name,
    categoryIcon: categoryAppearance.icon,
    categoryColor: categoryAppearance.color,
    appearanceSource: categoryAppearance.source,
  };
}

export function resolveSectionIcon(rawName: string) {
  const name = rawName.trim() || 'Раздел';
  const normalized = normalizeName(name);
  const incomeName = normalized === 'доход' || normalized === 'доходы' || normalized === 'income';
  const appearance = exactSectionAppearance(name, incomeName ? 'income' : 'expense');
  return { icon: appearance.icon, color: appearance.color, name };
}

export function resolveCategoryIcon(rawName: string, type: 'income' | 'expense' = 'expense') {
  const name = rawName.trim() || fallbackCategoryName(type);
  const categoryAppearance = exactCategoryAppearance(name, type);
  const sectionName = fallbackSectionName(type);
  const sectionAppearance = exactSectionAppearance(sectionName, type);

  return {
    icon: categoryAppearance.icon,
    color: categoryAppearance.color,
    sectionName,
    sectionIcon: sectionAppearance.icon,
    sectionColor: sectionAppearance.color,
  };
}

export function resolveTaxonomyForText(params: { kind: TaxonomyKind; title?: string | null; description?: string | null }): TaxonomyMatch {
  void params.description;
  const type = params.kind;
  const categoryName = (params.title ?? '').trim() || fallbackCategoryName(type);
  const categoryAppearance = exactCategoryAppearance(categoryName, type);
  const sectionName = fallbackSectionName(type);
  const sectionAppearance = exactSectionAppearance(sectionName, type);

  return {
    categoryName,
    sectionName,
    categoryIcon: categoryAppearance.icon,
    sectionIcon: sectionAppearance.icon,
    categoryColor: categoryAppearance.color,
    sectionColor: sectionAppearance.color,
  };
}

export function resolveCategoryAppearance(name: string, kind: TaxonomyKind) {
  return resolveTaxonomyForText({ kind, title: name });
}

export function resolveSectionAppearance(name: string) {
  const normalized = normalizeName(name);
  const isIncome = normalized === 'доход' || normalized === 'доходы' || normalized === 'income';
  const appearance = exactSectionAppearance(name, isIncome ? 'income' : 'expense');
  return { icon: appearance.icon, color: appearance.color };
}

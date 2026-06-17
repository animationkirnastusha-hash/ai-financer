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

const colors = ['#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#F59E0B', '#2DD4BF', '#FB7185', '#C084FC'];

const exactCategoryAppearance: Record<string, { icon: string; color: string }> = {
  'расход': { icon: '🧾', color: '#60A5FA' },
  'доход': { icon: '💰', color: '#34D399' },
  'продукты': { icon: '🛒', color: '#34D399' },
  'groceries': { icon: '🛒', color: '#34D399' },
  'кофе': { icon: '☕', color: '#F59E0B' },
  'coffee': { icon: '☕', color: '#F59E0B' },
  'такси': { icon: '🚕', color: '#60A5FA' },
  'taxi': { icon: '🚕', color: '#60A5FA' },
  'зарплата': { icon: '💼', color: '#34D399' },
  'salary': { icon: '💼', color: '#34D399' },
};

const exactSectionAppearance: Record<string, { icon: string; color: string }> = {
  'расходы': { icon: '🧾', color: '#60A5FA' },
  'доходы': { icon: '💰', color: '#34D399' },
  'продукты': { icon: '🛒', color: '#34D399' },
  'продуктовый магазин': { icon: '🛒', color: '#34D399' },
  'grocery store': { icon: '🛒', color: '#34D399' },
  'groceries': { icon: '🛒', color: '#34D399' },
  'транспорт': { icon: '🚕', color: '#60A5FA' },
  'transport': { icon: '🚕', color: '#60A5FA' },
  'дом': { icon: '🏠', color: '#FBBF24' },
  'home': { icon: '🏠', color: '#FBBF24' },
  'работа': { icon: '💼', color: '#818CF8' },
  'work': { icon: '💼', color: '#818CF8' },
  'подписки': { icon: '🔁', color: '#C4B5FD' },
  'subscriptions': { icon: '🔁', color: '#C4B5FD' },
};

function normalizeName(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function stableColor(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return colors[hash % colors.length];
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

function categoryAppearance(name: string, type: 'income' | 'expense') {
  const exact = exactCategoryAppearance[normalizeName(name)];
  if (exact) return { ...exact, source: 'exact_name' as const };
  return {
    icon: fallbackIcon(type),
    color: stableColor(`${type}:category:${name}`),
    source: 'stable_fallback' as const,
  };
}

function sectionAppearance(name: string, type: 'income' | 'expense') {
  const exact = exactSectionAppearance[normalizeName(name)];
  if (exact) return { ...exact, source: 'exact_name' as const };
  return {
    icon: fallbackIcon(type),
    color: stableColor(`${type}:section:${name}`),
    source: 'stable_fallback' as const,
  };
}

export function resolveTaxonomyIcon(rawText: string, type: 'income' | 'expense'): ResolvedTaxonomy {
  const name = rawText.trim() || fallbackCategoryName(type);
  const category = categoryAppearance(name, type);
  const sectionName = fallbackSectionName(type);
  const section = sectionAppearance(sectionName, type);

  return {
    type,
    sectionName,
    sectionIcon: section.icon,
    sectionColor: section.color,
    categoryName: name,
    categoryIcon: category.icon,
    categoryColor: category.color,
    appearanceSource: category.source,
  };
}

export function resolveSectionIcon(rawName: string) {
  const name = rawName.trim() || 'Раздел';
  const normalized = normalizeName(name);
  const isIncome = normalized === 'доход' || normalized === 'доходы' || normalized === 'income';
  const appearance = sectionAppearance(name, isIncome ? 'income' : 'expense');
  return { icon: appearance.icon, color: appearance.color, name };
}

export function resolveCategoryIcon(rawName: string, type: 'income' | 'expense' = 'expense') {
  const name = rawName.trim() || fallbackCategoryName(type);
  const category = categoryAppearance(name, type);
  const sectionName = fallbackSectionName(type);
  const section = sectionAppearance(sectionName, type);
  return { icon: category.icon, color: category.color, categoryName: name, sectionName, sectionIcon: section.icon, sectionColor: section.color };
}

export type SemanticTransactionTaxonomyInput = {
  kind: 'income' | 'expense';
  title?: string | null;
  description?: string | null;
  sectionName?: string | null;
  categoryName?: string | null;
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
  source: 'ai' | 'fallback';
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

function clean(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function isSameText(left?: string | null, right?: string | null) {
  const normalize = (value?: string | null) => clean(value).toLowerCase().replace(/ё/g, 'е');
  return normalize(left) === normalize(right);
}

function buildGenericFallback(kind: 'income' | 'expense') {
  return kind === 'income' ? INCOME_FALLBACK : EXPENSE_FALLBACK;
}

function buildAiTaxonomy(params: {
  kind: 'income' | 'expense';
  categoryName: string;
  sectionName: string;
}) {
  const fallback = buildGenericFallback(params.kind);

  return {
    categoryName: params.categoryName,
    sectionName: params.sectionName,
    categoryIcon: fallback.categoryIcon,
    sectionIcon: fallback.sectionIcon,
    categoryColor: fallback.categoryColor,
    sectionColor: fallback.sectionColor,
  };
}

export function resolveTransactionSemanticTaxonomy(input: SemanticTransactionTaxonomyInput): SemanticTransactionTaxonomy {
  const aiCategory = clean(input.categoryName);
  const aiSection = clean(input.sectionName);
  const fallback = buildGenericFallback(input.kind);

  if (aiCategory || aiSection) {
    const categoryName = aiCategory || fallback.categoryName;
    const sectionName = aiSection || fallback.sectionName;

    return {
      ...buildAiTaxonomy({ kind: input.kind, categoryName, sectionName }),
      source: 'ai',
      titleFallback: categoryName,
      descriptionFallback: null,
    };
  }

  return {
    ...fallback,
    source: 'fallback',
    titleFallback: fallback.categoryName,
    descriptionFallback: null,
  };
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

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(value
    .map((item) => clean(String(item ?? '')))
    .filter((item) => item.length >= 2 && item.length <= 48)))
    .slice(0, 8);
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

import { resolveTransactionSemanticTaxonomy } from './transaction-taxonomy';

export type ReceiptTaxonomyItem = {
  title: string;
  amount: number | null;
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
};

export type ReceiptTaxonomyGroup = {
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  amount: number;
  categories: Array<{
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    amount: number;
    items: ReceiptTaxonomyItem[];
  }>;
};

function normalizePreviewText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function normalizeLine(value: string) {
  return value.replace(/[\t|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseLineAmount(value: string) {
  const match = value.match(/(?:^|\s)(\d{1,7})(?:[,.](\d{1,2}))?(?:\s*(?:₽|р|руб|rub))?\s*$/i);
  if (!match) return { title: normalizeLine(value), amount: null };

  const rubles = Number(match[1]);
  const coins = match[2] ? Number(match[2].padEnd(2, '0')) : 0;
  const amount = Math.round(rubles + coins / 100);
  const title = normalizeLine(value.slice(0, match.index).trim()) || normalizeLine(value);

  return {
    title,
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
  };
}

function splitReceiptLines(rawText?: string | null) {
  return String(rawText ?? '')
    .split(/[\n;]+/g)
    .map(normalizeLine)
    .filter((line) => line.length >= 2)
    .slice(0, 40);
}

export function buildReceiptTaxonomyItems(rawText?: string | null): ReceiptTaxonomyItem[] {
  const lines = splitReceiptLines(rawText);
  if (lines.length === 0) return [];

  return lines.map((line) => {
    const parsed = parseLineAmount(line);
    const title = normalizePreviewText(parsed.title || line);
    const taxonomy = resolveTransactionSemanticTaxonomy({
      kind: 'expense',
      title,
      description: line,
    });

    return {
      title,
      amount: parsed.amount,
      sectionName: taxonomy.categoryName,
      sectionIcon: taxonomy.categoryIcon,
      sectionColor: taxonomy.categoryColor,
      categoryName: taxonomy.categoryName,
      categoryIcon: taxonomy.categoryIcon,
      categoryColor: taxonomy.categoryColor,
    };
  });
}

export function groupReceiptTaxonomyItems(items: ReceiptTaxonomyItem[]): ReceiptTaxonomyGroup[] {
  const categoryMap = new Map<string, ReceiptTaxonomyGroup>();

  for (const item of items) {
    const categoryKey = item.categoryName.toLowerCase();
    let group = categoryMap.get(categoryKey);
    if (!group) {
      group = {
        sectionName: item.categoryName,
        sectionIcon: item.categoryIcon,
        sectionColor: item.categoryColor,
        amount: 0,
        categories: [{
          categoryName: item.categoryName,
          categoryIcon: item.categoryIcon,
          categoryColor: item.categoryColor,
          amount: 0,
          items: [],
        }],
      };
      categoryMap.set(categoryKey, group);
    }

    group.amount += item.amount ?? 0;
    const category = group.categories[0];
    category.amount += item.amount ?? 0;
    category.items.push(item);
  }

  return Array.from(categoryMap.values())
    .map((group) => ({
      ...group,
      amount: Math.round(group.amount),
      categories: group.categories.map((category) => ({
        ...category,
        amount: Math.round(category.amount),
      })),
    }))
    .sort((left, right) => right.amount - left.amount || left.sectionName.localeCompare(right.sectionName, 'ru'));
}

export function buildReceiptItemsDescription(rawText?: string | null) {
  const titles = buildReceiptTaxonomyItems(rawText)
    .map((item) => item.title)
    .filter(Boolean)
    .slice(0, 8);

  return titles.length ? `Состав: ${titles.join(', ')}` : '';
}

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

const RECEIPT_SECTION = {
  sectionName: 'Чек',
  sectionIcon: '🧾',
  sectionColor: '#60A5FA',
};

const RECEIPT_CATEGORY = {
  categoryName: 'Позиции чека',
  categoryIcon: '🧾',
  categoryColor: '#60A5FA',
};

function normalizePreviewText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function buildReceiptTaxonomyItems(rawText?: string | null): ReceiptTaxonomyItem[] {
  const preview = normalizePreviewText(rawText ?? '');
  if (!preview) return [];

  return [{
    title: 'Данные чека',
    amount: null,
    ...RECEIPT_SECTION,
    ...RECEIPT_CATEGORY,
  }];
}

export function groupReceiptTaxonomyItems(items: ReceiptTaxonomyItem[]): ReceiptTaxonomyGroup[] {
  if (items.length === 0) return [];

  return [{
    ...RECEIPT_SECTION,
    amount: 0,
    categories: [{
      ...RECEIPT_CATEGORY,
      amount: 0,
      items,
    }],
  }];
}

import { resolveTaxonomyForText } from './taxonomy-icons';

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

const AMOUNT_PATTERN = /(?:^|\s)(\d{1,7})(?:[,.](\d{1,2}))?\s*(?:₽|руб|р\.?|rub)?\s*$/i;
const LINE_SKIP_PATTERN = /касс|инн|чек|фн|фд|фп|итог|сумма|оплата|налог|ндс|сдача|эклз|qr/i;

function normalizeLine(value: string) {
  return value.replace(/\s+/g, ' ').replace(/[|]+/g, ' ').trim();
}

function extractAmount(line: string) {
  const match = line.match(AMOUNT_PATTERN);
  if (!match) return { title: line, amount: null };
  const whole = Number(match[1]);
  const fraction = match[2] ? Number(match[2]) / 100 : 0;
  const amount = Math.round(whole + fraction);
  const title = line.slice(0, match.index).replace(/[\s—–-]+$/g, '').trim() || line;
  return { title, amount: Number.isFinite(amount) && amount > 0 ? amount : null };
}

export function buildReceiptTaxonomyItems(rawText?: string | null): ReceiptTaxonomyItem[] {
  if (!rawText) return [];

  return rawText
    .split(/\r?\n|;/g)
    .map(normalizeLine)
    .filter((line) => line.length >= 3 && !LINE_SKIP_PATTERN.test(line))
    .slice(0, 80)
    .map((line) => {
      const parsed = extractAmount(line);
      const resolved = resolveTaxonomyForText({ kind: 'expense', title: parsed.title });
      return {
        title: parsed.title,
        amount: parsed.amount,
        sectionName: resolved.sectionName,
        sectionIcon: resolved.sectionIcon,
        sectionColor: resolved.sectionColor,
        categoryName: resolved.categoryName,
        categoryIcon: resolved.categoryIcon,
        categoryColor: resolved.categoryColor,
      };
    });
}

export function groupReceiptTaxonomyItems(items: ReceiptTaxonomyItem[]): ReceiptTaxonomyGroup[] {
  const sections = new Map<string, ReceiptTaxonomyGroup>();

  for (const item of items) {
    const sectionKey = item.sectionName;
    const amount = item.amount ?? 0;
    let section = sections.get(sectionKey);
    if (!section) {
      section = {
        sectionName: item.sectionName,
        sectionIcon: item.sectionIcon,
        sectionColor: item.sectionColor,
        amount: 0,
        categories: [],
      };
      sections.set(sectionKey, section);
    }

    section.amount += amount;
    let category = section.categories.find((current) => current.categoryName === item.categoryName);
    if (!category) {
      category = {
        categoryName: item.categoryName,
        categoryIcon: item.categoryIcon,
        categoryColor: item.categoryColor,
        amount: 0,
        items: [],
      };
      section.categories.push(category);
    }

    category.amount += amount;
    category.items.push(item);
  }

  return [...sections.values()]
    .map((section) => ({
      ...section,
      categories: section.categories.sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

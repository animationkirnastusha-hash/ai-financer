import { TAXONOMY_ICON_RULES } from './taxonomy/rules';
export type { ResolvedTaxonomy, TaxonomyEntryType, TaxonomyIconRule } from './taxonomy/types';
import type { TaxonomyIconRule } from './taxonomy/types';

export { TAXONOMY_ICON_RULES };

export const TAXONOMY_ICON_ENTRY_COUNT = TAXONOMY_ICON_RULES.reduce((sum, item) => sum + item.keywords.length + 1, 0);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:()\[\]{}«»"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value).split(' ').filter((token) => token.length >= 2);
}


const TAXONOMY_STOP_WORDS = new Set([
  'руб', 'рублей', 'рубля', 'р', '₽', 'коп', 'копеек', 'тысяч', 'тысячи', 'тысяча',
  'потратил', 'потратила', 'спиши', 'расход', 'доход', 'оплата', 'покупка',
  'купил', 'купила', 'купить', 'заплатил', 'заплатила', 'перевод', 'переведи', 'положи',
  'на', 'с', 'со', 'из', 'за', 'для', 'по', 'в', 'во', 'и', 'или', 'это', 'мой', 'моя', 'мои',
]);

function stableColor(value: string) {
  const colors = ['#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#F59E0B', '#2DD4BF', '#FB7185', '#C084FC'];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return colors[hash % colors.length];
}

function toDisplayName(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function buildFallbackLabel(rawText: string, type: 'income' | 'expense') {
  const normalized = normalizeText(rawText)
    .replace(/\b\d+[\d\s.,]*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TAXONOMY_STOP_WORDS.has(token));

  const label = toDisplayName(tokens.slice(0, 3).join(' '));
  if (label) return label;
  return type === 'income' ? 'Доход' : 'Расход';
}

function buildSemanticFallback(rawText: string, type: 'income' | 'expense') {
  const label = buildFallbackLabel(rawText, type);
  if (type === 'income') {
    return {
      id: `income_custom_${normalizeText(label).replace(/\s+/g, '_') || 'income'}`,
      type: 'income' as const,
      sectionId: 'income',
      sectionName: 'Доходы',
      sectionIcon: '💰',
      sectionColor: '#34D399',
      categoryName: label,
      categoryIcon: '💰',
      categoryColor: stableColor(`income:${label}`),
      keywords: [],
    };
  }

  return {
    id: `expense_custom_${normalizeText(label).replace(/\s+/g, '_') || 'expense'}`,
    type: 'expense' as const,
    sectionId: `custom_${normalizeText(label).replace(/\s+/g, '_') || 'expense'}`,
    sectionName: label,
    sectionIcon: '🧾',
    sectionColor: stableColor(`section:${label}`),
    categoryName: label,
    categoryIcon: '🧾',
    categoryColor: stableColor(`category:${label}`),
    keywords: [],
  };
}

function scoreKeyword(query: string, queryTokens: string[], keyword: string) {
  const current = normalizeText(keyword);
  if (!current) return 0;
  if (query === current) return 1000 + current.length;
  if (query.includes(current)) return 420 + current.length;
  if (current.includes(query) && query.length >= 4) return 260 + query.length;

  const keywordTokens = tokenize(current);
  if (keywordTokens.length === 0) return 0;

  let score = 0;
  for (const token of queryTokens) {
    if (keywordTokens.includes(token)) score += 90 + token.length;
    else if (keywordTokens.some((item) => item.includes(token) || token.includes(item))) score += 38 + token.length;
  }

  if (keywordTokens.every((token) => queryTokens.includes(token))) score += 160;
  return score;
}

export function resolveTaxonomyIcon(rawText: string, type: 'income' | 'expense') {
  const query = normalizeText(rawText || '');
  const queryTokens = tokenize(query);
  const candidates = TAXONOMY_ICON_RULES.filter((item) => item.type === type || item.type === 'both');

  let best: { rule: TaxonomyIconRule; score: number } | null = null;

  for (const rule of candidates) {
    const labels = [rule.categoryName, rule.sectionName, ...rule.keywords];
    const score = labels.reduce((sum, keyword) => Math.max(sum, scoreKeyword(query, queryTokens, keyword)), 0);
    if (!best || score > best.score) best = { rule, score };
  }

  const hasSemanticMatch = Boolean(best && best.score >= 70);
  const fallback = buildSemanticFallback(rawText || '', type);
  const chosen = hasSemanticMatch ? best!.rule : fallback;
  const confidence = hasSemanticMatch ? Math.min(0.99, best!.score / 1000) : 0.42;

  return {
    type,
    sectionName: chosen.sectionName,
    sectionIcon: chosen.sectionIcon,
    sectionColor: chosen.sectionColor,
    categoryName: chosen.categoryName,
    categoryIcon: chosen.categoryIcon,
    categoryColor: chosen.categoryColor,
    confidence,
    matchedRuleId: chosen.id,
  };
}

export function resolveSectionIcon(rawName: string) {
  const resolvedExpense = resolveTaxonomyIcon(rawName, 'expense');
  const resolvedIncome = resolveTaxonomyIcon(rawName, 'income');
  const resolved = resolvedExpense.confidence >= resolvedIncome.confidence ? resolvedExpense : resolvedIncome;
  return { icon: resolved.sectionIcon, color: resolved.sectionColor, name: resolved.sectionName };
}

export function resolveCategoryIcon(rawName: string, type: 'income' | 'expense' = 'expense') {
  const resolved = resolveTaxonomyIcon(rawName, type);
  return { icon: resolved.categoryIcon, color: resolved.categoryColor, sectionName: resolved.sectionName, sectionIcon: resolved.sectionIcon, sectionColor: resolved.sectionColor };
}

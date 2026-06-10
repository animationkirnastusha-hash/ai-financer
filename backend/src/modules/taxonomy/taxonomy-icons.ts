import { TAXONOMY_ICON_RULES } from './rules';
export type { ResolvedTaxonomy, TaxonomyEntryType, TaxonomyIconRule } from './types';
import type { TaxonomyIconRule } from './types';

export { TAXONOMY_ICON_RULES };

export type TaxonomyKind = 'expense' | 'income';

export type TaxonomyMatch = {
  categoryName: string;
  sectionName: string;
  categoryIcon: string;
  sectionIcon: string;
  categoryColor: string;
  sectionColor: string;
};

const GENERIC_TAXONOMY_ICONS = new Set(['✨', '⭐', '🌟', '📌', '🗂️', '']);
const PALETTE = [
  '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#F59E0B', '#22D3EE',
  '#FB7185', '#4ADE80', '#F97316', '#818CF8', '#2DD4BF', '#E879F9',
];

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function stableCategoryColor(value: string) {
  return PALETTE[hashString(value) % PALETTE.length];
}

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

  const fallback = type === 'income'
    ? {
        id: 'income_other', type: 'income' as const, sectionId: 'income', sectionName: 'Доходы', sectionIcon: '💰', sectionColor: '#34D399', categoryName: 'Доход', categoryIcon: '💰', categoryColor: '#34D399', keywords: [],
      }
    : {
        id: 'expense_other', type: 'expense' as const, sectionId: 'other', sectionName: 'Другое', sectionIcon: '📌', sectionColor: '#94A3B8', categoryName: 'Другое', categoryIcon: '🧾', categoryColor: '#94A3B8', keywords: [],
      };

  const chosen = best && best.score >= 70 ? best.rule : fallback;
  const confidence = best && best.score >= 70 ? Math.min(0.99, best.score / 1000) : 0.25;

  return {
    type,
    sectionName: chosen.sectionName,
    sectionIcon: chosen.sectionIcon,
    sectionColor: chosen.sectionColor,
    categoryName: chosen.categoryName,
    categoryIcon: chosen.categoryIcon,
    categoryColor: stableCategoryColor(`${type}:${chosen.categoryName}:${chosen.id}`),
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

export function shouldReplaceGenericIcon(icon?: string | null) {
  return GENERIC_TAXONOMY_ICONS.has((icon ?? '').trim());
}

export function resolveTaxonomyForText(params: { kind: TaxonomyKind; title?: string | null; description?: string | null }): TaxonomyMatch {
  const resolved = resolveTaxonomyIcon(`${params.title ?? ''} ${params.description ?? ''}`, params.kind);
  return {
    categoryName: resolved.categoryName,
    sectionName: resolved.sectionName,
    categoryIcon: resolved.categoryIcon || (params.kind === 'income' ? '💵' : '🧾'),
    sectionIcon: resolved.sectionIcon || (params.kind === 'income' ? '💵' : '📌'),
    categoryColor: resolved.categoryColor,
    sectionColor: resolved.sectionColor,
  };
}

export function resolveCategoryAppearance(name: string, kind: TaxonomyKind) {
  return resolveTaxonomyForText({ kind, title: name });
}

export function resolveSectionAppearance(name: string) {
  const normalized = normalizeText(name);
  const resolvedIncome = resolveTaxonomyForText({ kind: 'income', title: name });
  const isIncome = normalizeText(resolvedIncome.sectionName) === normalized || normalizeText(resolvedIncome.categoryName) === normalized;
  const resolved = isIncome ? resolvedIncome : resolveTaxonomyForText({ kind: 'expense', title: name });
  return { icon: resolved.sectionIcon, color: resolved.sectionColor };
}

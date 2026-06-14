import { buildSemanticVariants, normalizeSemanticText, semanticStemText, tokenizeSemanticText } from './semantic-normalizer';

export function semanticSimilarityScore(rawQuery: unknown, rawAlias: unknown): number {
  const query = normalizeSemanticText(rawQuery);
  const alias = normalizeSemanticText(rawAlias);
  if (!query || !alias) return 0;
  if (query === alias) return 1;

  const queryStem = semanticStemText(query);
  const aliasStem = semanticStemText(alias);
  if (queryStem && aliasStem && queryStem === aliasStem) return 0.98;

  const containment = containmentScore(query, alias);
  const stemContainment = containmentScore(queryStem, aliasStem);
  const tokenOverlap = overlapScore(query, alias);
  const stemOverlap = overlapScore(queryStem, aliasStem);
  const fuzzy = levenshteinScore(query, alias);
  const stemFuzzy = levenshteinScore(queryStem, aliasStem);

  return Math.max(containment, stemContainment, tokenOverlap, stemOverlap, fuzzy, stemFuzzy);
}

export function semanticBestScore(queryVariants: string[], aliases: string[]) {
  let best = { score: 0, query: '', alias: '' };

  for (const query of queryVariants) {
    for (const alias of aliases) {
      const aliasVariants = buildSemanticVariants(alias);
      for (const aliasVariant of aliasVariants) {
        const score = semanticSimilarityScore(query, aliasVariant);
        if (score > best.score) best = { score, query, alias: aliasVariant };
      }
    }
  }

  return best;
}

export function semanticThreshold(value: unknown) {
  const normalized = normalizeSemanticText(value);
  if (normalized.length <= 3) return 0.9;
  if (normalized.length <= 5) return 0.8;
  return 0.68;
}

function containmentScore(query: string, alias: string) {
  if (!query || !alias) return 0;
  if (query === alias) return 1;
  if (!query.includes(alias) && !alias.includes(query)) return 0;
  const ratio = Math.min(query.length, alias.length) / Math.max(query.length, alias.length);
  return Math.max(0.76, ratio);
}

function overlapScore(query: string, alias: string) {
  const left = new Set(tokenizeSemanticText(query));
  const right = new Set(tokenizeSemanticText(alias));
  if (!left.size || !right.size) return 0;

  let common = 0;
  for (const token of left) {
    if (right.has(token)) common += 1;
  }

  if (!common) return 0;
  return common / Math.max(left.size, right.size);
}

function levenshteinScore(query: string, alias: string) {
  if (!query || !alias) return 0;
  const max = Math.max(query.length, alias.length);
  if (max === 0) return 0;
  return 1 - levenshtein(query, alias) / max;
}

function levenshtein(a: string, b: string) {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i += 1) matrix[i] = [i];
  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
    }
  }

  return matrix[b.length][a.length];
}

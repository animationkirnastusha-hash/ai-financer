import { SemanticEntityKind, SemanticEntityLike } from './semantic-types';
import { normalizeSemanticText, semanticStemText, tokenizeSemanticText } from './semantic-normalizer';

const ACCOUNT_TYPE_ALIASES: Record<string, string[]> = {
  cash: ['cash', 'кэш', 'наличные', 'наличка', 'наличку', 'налички', 'налик', 'деньги', 'кошелек', 'кошелёк'],
  card: ['card', 'карта', 'карту', 'карты', 'карточка', 'банк', 'банковская карта'],
  savings: ['savings', 'накопления', 'копилка', 'копилку', 'сбережения', 'цель', 'целевая копилка'],
  investment: ['investment', 'инвестиции', 'инвест', 'брокер', 'акции'],
};

// Category and section aliases are intentionally built from actual entity names only.
// Financial meaning must come from the AI planner/taxonomy contract, not from keyword
// routing such as “word X means category Y”.

export function buildEntityAliases(entity: SemanticEntityLike, kind: SemanticEntityKind = 'generic') {
  const label = normalizeSemanticText(entity.name || entity.title || '');
  const type = normalizeSemanticText(entity.type || '');
  const words = tokenizeSemanticText(label).filter((word) => word.length >= 2);
  const aliases = new Set<string>([
    label,
    semanticStemText(label),
    ...words,
    ...words.map(semanticStemText),
  ].filter(Boolean));

  if (kind === 'account') {
    for (const alias of ACCOUNT_TYPE_ALIASES[type] ?? []) aliases.add(normalizeSemanticText(alias));
    addNameBasedAccountAliases(label, aliases);
  }

  if (kind === 'category' || kind === 'section') {
    addCategoryMeaningAliases(label, aliases);
  }

  if (kind === 'goal') {
    aliases.add('копилка');
    aliases.add('цель');
    aliases.add('накопления');
    addNameBasedGoalAliases(label, aliases);
  }

  return Array.from(aliases).filter(Boolean);
}

function addNameBasedAccountAliases(label: string, aliases: Set<string>) {
  if (label.includes('налич') || label.includes('налик') || label.includes('cash') || label.includes('кэш')) {
    ['наличные', 'наличка', 'наличку', 'налик', 'кэш', 'cash', 'кошелек', 'кошелёк'].forEach((alias) => aliases.add(normalizeSemanticText(alias)));
  }

  if (label.includes('карта') || label.includes('сбер') || label.includes('тинькофф') || label.includes('банк')) {
    ['карта', 'карту', 'карточка', 'банк', 'банковская карта'].forEach((alias) => aliases.add(normalizeSemanticText(alias)));
  }

  if (label.includes('цель') || label.includes('копил') || label.includes('накоп')) {
    ['цель', 'копилка', 'копилку', 'накопления', 'сбережения'].forEach((alias) => aliases.add(normalizeSemanticText(alias)));
  }
}

function addCategoryMeaningAliases(label: string, aliases: Set<string>) {
  // Keep only morphology/stem/name-based aliases. Do not add semantic category
  // decisions here; the planner owns financial meaning, while this resolver only
  // matches user wording to already existing entities.
  if (!label) return;
}

function addNameBasedGoalAliases(label: string, aliases: Set<string>) {
  if (label.includes('подуш')) {
    ['подушка', 'финансовая подушка', 'резерв', 'заначка'].forEach((alias) => aliases.add(normalizeSemanticText(alias)));
  }
  if (label.includes('отпуск') || label.includes('путешеств')) {
    ['отпуск', 'поездка', 'путешествие'].forEach((alias) => aliases.add(normalizeSemanticText(alias)));
  }
}

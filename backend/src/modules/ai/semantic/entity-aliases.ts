import { SemanticEntityKind, SemanticEntityLike } from './semantic-types';
import { normalizeSemanticText, semanticStemText, tokenizeSemanticText } from './semantic-normalizer';

const ACCOUNT_TYPE_ALIASES: Record<string, string[]> = {
  cash: ['cash', 'кэш', 'наличные', 'наличка', 'наличку', 'налички', 'налик', 'деньги', 'кошелек', 'кошелёк'],
  card: ['card', 'карта', 'карту', 'карты', 'карточка', 'банк', 'банковская карта'],
  savings: ['savings', 'накопления', 'копилка', 'копилку', 'сбережения', 'цель', 'целевая копилка'],
  investment: ['investment', 'инвестиции', 'инвест', 'брокер', 'акции'],
};

// Category and section aliases are intentionally built from actual entity names only.
// Financial meaning must come from the AI planner/taxonomy contract.
// This resolver only matches already-known entity names and technical account wording.

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

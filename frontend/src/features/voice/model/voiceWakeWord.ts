import { normalizeForWake } from '@/features/voice/model/voiceText';

function levenshteinDistance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }

  return rows[a.length][b.length];
}

function isWakeIndexSafe(index: number, words: string[]) {
  if (index <= 1) return true;
  const before = words.slice(0, index).join(' ');
  return /^(эй|окей|ну|слушай|алло|привет)\s+/i.test(before);
}

export function buildWakeAliases(companionName: string) {
  const baseName = normalizeForWake(companionName || 'Фина').split(' ')[0] || 'фина';
  const aliases = new Set([
    'фина',
    'финна',
    'fina',
    'фину',
    'фине',
    'фины',
    'финой',
    'фино',
    'фена',
    'финаа',
    'финочка',
    'финочку',
    'афина',
    'афину',
    'афине',
    'фея',
    'феина',
    'файна',
    'файну',
    'фина,',
    'finna',
    'feena',
    'фин',
    'финн',
    'финка',
    'финак',
    'финок',
    'фирна',
    'финам',
    'финаю',
    baseName,
  ]);

  if (baseName.endsWith('а')) {
    aliases.add(`${baseName.slice(0, -1)}у`);
    aliases.add(`${baseName.slice(0, -1)}е`);
    aliases.add(`${baseName.slice(0, -1)}ы`);
  }

  return [...aliases].filter(Boolean);
}

type WakeMatch = {
  index: number;
  consumedWords: number;
  matchType: 'exact' | 'split' | 'fuzzy' | 'prefix';
};

function findWakeMatch(words: string[], aliases: string[]): WakeMatch | null {
  const exactIndex = words.findIndex((word) => aliases.includes(word));
  if (exactIndex >= 0) return { index: exactIndex, consumedWords: 1, matchType: 'exact' };

  // iOS/OpenAI may split the wake word into two tiny tokens, for example "фи на".
  for (let index = 0; index < Math.min(words.length - 1, 4); index += 1) {
    const joined = `${words[index]}${words[index + 1]}`;
    if (aliases.includes(joined) || levenshteinDistance(joined, 'фина') <= 1) {
      return { index, consumedWords: 2, matchType: 'split' };
    }
  }

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word.length < 3 || word.length > 10) continue;

    const exactDistance = Math.min(...aliases.filter((alias) => alias.length >= 3 && alias.length <= 10).map((alias) => levenshteinDistance(word, alias)));
    if (exactDistance <= 1) return { index, consumedWords: 1, matchType: 'fuzzy' };

    // Stronger fuzzy matching is allowed only near the beginning of the phrase.
    // This is still only a wake-word filter, not a financial command parser.
    if (isWakeIndexSafe(index, words)) {
      if ((word.startsWith('фи') || word.startsWith('фе') || word.startsWith('fin')) && exactDistance <= 2) {
        return { index, consumedWords: 1, matchType: 'prefix' };
      }
    }
  }

  return null;
}

export function stripWakeWord(rawText: string, companionName: string) {
  const source = rawText.trim();
  const normalized = normalizeForWake(source);
  const words = normalized.split(' ').filter(Boolean);
  const aliases = buildWakeAliases(companionName);
  const match = findWakeMatch(words, aliases);

  if (!match) return { hasWakeWord: false, command: source, matchType: 'none' as const };

  const sourceWords = source.split(/\s+/).filter(Boolean);
  const command = sourceWords
    .slice(match.index + match.consumedWords)
    .join(' ')
    .replace(/^[,.:;!\-—\s]+/, '')
    .trim();

  return { hasWakeWord: true, command, matchType: match.matchType };
}

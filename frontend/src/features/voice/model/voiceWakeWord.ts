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

export function buildWakeAliases(companionName: string) {
  const baseName = normalizeForWake(companionName || 'Фина').split(' ')[0] || 'фина';
  const aliases = new Set(['фина', 'финна', 'fina', 'фину', 'фине', 'фины', 'финой', 'фино', 'фена', baseName]);

  if (baseName.endsWith('а')) {
    aliases.add(`${baseName.slice(0, -1)}у`);
    aliases.add(`${baseName.slice(0, -1)}е`);
    aliases.add(`${baseName.slice(0, -1)}ы`);
  }

  return [...aliases].filter(Boolean);
}

export function stripWakeWord(rawText: string, companionName: string) {
  const source = rawText.trim();
  const normalized = normalizeForWake(source);
  const words = normalized.split(' ').filter(Boolean);
  const aliases = buildWakeAliases(companionName);

  const exactIndex = words.findIndex((word) => aliases.includes(word));
  const fuzzyIndex = exactIndex >= 0
    ? exactIndex
    : words.findIndex((word) => {
        if (word.length < 3 || word.length > 8) return false;
        return aliases.some((alias) => alias.length >= 3 && alias.length <= 8 && levenshteinDistance(word, alias) <= 1);
      });

  const wakeIndex = exactIndex >= 0 ? exactIndex : fuzzyIndex;
  if (wakeIndex < 0) return { hasWakeWord: false, command: source };

  const sourceWords = source.split(/\s+/).filter(Boolean);
  const command = sourceWords.slice(wakeIndex + 1).join(' ').replace(/^[,.:;!\-—\s]+/, '').trim();

  return { hasWakeWord: true, command };
}

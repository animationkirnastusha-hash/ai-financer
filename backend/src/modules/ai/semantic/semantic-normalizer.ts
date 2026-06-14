const SOFT_STOP_WORDS = new Set([
  'используй', 'использовать', 'выбери', 'выбрать', 'возьми', 'укажи', 'поставь', 'поставить',
  'счет', 'счёт', 'счета', 'счёта', 'аккаунт', 'кошелек', 'кошелёк',
  'категория', 'категорию', 'категории', 'раздел', 'раздела', 'разделу',
  'цель', 'цели', 'лимит', 'лимита', 'операция', 'операцию',
  'со', 'с', 'из', 'на', 'для', 'по', 'в', 'во', 'к', 'от', 'до',
  'мой', 'моя', 'мою', 'мое', 'моё', 'моего', 'моей', 'этот', 'эта', 'это', 'эту',
  'пожалуйста', 'плиз', 'давай', 'нужно', 'надо', 'можно', 'пусть',
]);

const SHORT_SUFFIXES = [
  'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ую', 'юю', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие',
  'ов', 'ев', 'ей', 'ой', 'ый', 'ий', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'ою', 'ею',
  'а', 'я', 'ы', 'и', 'у', 'ю', 'е', 'о',
];

export function normalizeSemanticText(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/счё/g, 'сче')
    .replace(/₽/g, ' руб ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSemanticText(value: unknown): string[] {
  return normalizeSemanticText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function semanticStemToken(token: string): string {
  const clean = normalizeSemanticText(token);
  if (clean.length <= 3 || /^\d+$/.test(clean)) return clean;

  for (const suffix of SHORT_SUFFIXES) {
    if (clean.length - suffix.length >= 4 && clean.endsWith(suffix)) {
      return clean.slice(0, -suffix.length);
    }
  }

  return clean;
}

export function semanticStemText(value: unknown): string {
  return tokenizeSemanticText(value).map(semanticStemToken).join(' ').trim();
}

export function removeSoftEntityWords(value: unknown): string {
  return tokenizeSemanticText(value)
    .filter((token) => !SOFT_STOP_WORDS.has(token))
    .join(' ')
    .trim();
}

export function buildSemanticVariants(value: unknown): string[] {
  const normalized = normalizeSemanticText(value);
  const withoutSoftWords = removeSoftEntityWords(normalized);
  const tokens = tokenizeSemanticText(withoutSoftWords || normalized);
  const stems = tokens.map(semanticStemToken).filter(Boolean);

  return Array.from(new Set([
    normalized,
    withoutSoftWords,
    semanticStemText(normalized),
    semanticStemText(withoutSoftWords),
    ...tokens,
    ...stems,
  ].filter((item) => item.length > 0)));
}

export function isLikelySameSemanticText(left: unknown, right: unknown): boolean {
  const leftStem = semanticStemText(removeSoftEntityWords(left) || left);
  const rightStem = semanticStemText(removeSoftEntityWords(right) || right);
  return Boolean(leftStem && rightStem && leftStem === rightStem);
}

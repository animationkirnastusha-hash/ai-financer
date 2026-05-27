function normalizeSpaces(value: string) {
  return value.replace(/[\u00A0\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeVoiceTranscriptForStt(rawText: string) {
  let text = normalizeSpaces(rawText);
  if (!text) return '';

  const replacements: Array<[RegExp, string]> = [
    [/\b(fina|фина|финна|фину|фине|фины|финой|фино|фена)\b/giu, 'Фина'],
    [/\b(тинькофф|тинкофф|тиньков|тинков|т[\s-]*банк|ти[\s-]*банк|три\s+банк|т\s+банк)\b/giu, 'Т-Банк'],
    [/\b(сбербанк|сбер)\b/giu, 'Сбер'],
    [/\b(альфа\s*банк|альфа)\b/giu, 'Альфа-Банк'],
    [/\b(озон\s*банк|озон\s*карта)\b/giu, 'Ozon Банк'],
    [/\b(в\s*т\s*б|втб)\b/giu, 'ВТБ'],
    [/\b(наличка|наличными|кеш|cash)\b/giu, 'наличные'],
    [/\b(карточка)\b/giu, 'карта'],
    [/\b(руб|рубля|рублей|р)\b/giu, 'рублей'],
    [/\b(к)\b/giu, 'тысяч'],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  return normalizeSpaces(text);
}

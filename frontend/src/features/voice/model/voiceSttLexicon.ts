function normalizeSpaces(value: string) {
  return value.replace(/[\u00A0\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeSpokenThousands(text: string) {
  return text
    .replace(/\b(один|одна)\s+(ка|к)\b/giu, 'одна тысяча')
    .replace(/\b(две|два)\s+(ка|к)\b/giu, 'две тысячи')
    .replace(/\b(три)\s+(ка|к)\b/giu, 'три тысячи')
    .replace(/\b(четыре)\s+(ка|к)\b/giu, 'четыре тысячи')
    .replace(/\b(пять)\s+(ка|к)\b/giu, 'пять тысяч')
    .replace(/\b(шесть)\s+(ка|к)\b/giu, 'шесть тысяч')
    .replace(/\b(семь)\s+(ка|к)\b/giu, 'семь тысяч')
    .replace(/\b(восемь)\s+(ка|к)\b/giu, 'восемь тысяч')
    .replace(/\b(девять)\s+(ка|к)\b/giu, 'девять тысяч')
    .replace(/\b(десять)\s+(ка|к)\b/giu, 'десять тысяч')
    .replace(/\b(двадцать)\s+(ка|к)\b/giu, 'двадцать тысяч')
    .replace(/\b(тридцать)\s+(ка|к)\b/giu, 'тридцать тысяч')
    .replace(/\b(сорок)\s+(ка|к)\b/giu, 'сорок тысяч')
    .replace(/\b(пятьдесят)\s+(ка|к)\b/giu, 'пятьдесят тысяч')
    .replace(/\b(\d+)\s*(к|ка)\b/giu, '$1 тысяч');
}

export function normalizeVoiceTranscriptForStt(rawText: string) {
  let text = normalizeSpaces(rawText);
  if (!text) return '';

  const replacements: Array<[RegExp, string]> = [
    [/\b(тинькофф|тинкофф|тиньков|тинков|т[\s-]*банк|ти[\s-]*банк|три\s+банк|т\s+банк)\b/giu, 'Т-Банк'],
    [/\b(сбербанк|сбер)\b/giu, 'Сбер'],
    [/\b(альфа\s*банк|альфа)\b/giu, 'Альфа-Банк'],
    [/\b(озон\s*банк|озон\s*карта)\b/giu, 'Ozon Банк'],
    [/\b(в\s*т\s*б|втб)\b/giu, 'ВТБ'],
    [/\b(наличка|наличкой|наличке|налички|наличики|наличиков|наличными|налик|наликом|кеш|кэш|cash)\b/giu, 'наличные'],
    [/\b(карточка|карточки|карточкой|карте)\b/giu, 'карта'],
    [/\b(руб|рубля|рублей|р)\b/giu, 'рублей'],
    [/\b(двацать|дватцать|двадцат)\b/giu, 'двадцать'],
    [/\b(трицать|тритцать)\b/giu, 'тридцать'],
    [/\b(пицот)\b/giu, 'пятьсот'],
    [/\b(тыща|тыщи|тыщ)\b/giu, 'тысяч'],
    [/\b(заправка|заправке|бенз|бензинчик)\b/giu, 'бензин'],
    [/\b(инет|интернетик)\b/giu, 'интернет'],
    [/\b(телефонная\s+связь|мобильная\s+связь)\b/giu, 'связь'],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  text = normalizeSpokenThousands(text);

  return normalizeSpaces(text);
}

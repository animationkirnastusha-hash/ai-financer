import type { AIParsedCommand } from './types';
import { extractAmountFromText, stripAmountFromText, normalizeAmount } from './utils/amount-normalizer';

function normalize(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ');
}

function parseAmount(input: string): number | null {
  return extractAmountFromText(input);
}

function parseAllAmounts(input: string): number[] {
  const matches = Array.from(
    input.toLowerCase().replace(/ё/g, 'е').matchAll(
      /(\d+(?:[.,]\d+)?\s*(?:кк|к|k|тыс|тысяч|тысячи|млн|миллион(?:а|ов)?)?|чирик|десятка|двадцатка|полтос|сотка|пятихатка|косарь|штука|пятак|пятерка|пятерочка)(?:\s*(?:₽|руб(?:лей|ля|ль)?|р\.?)?)?/gi,
    ),
  );

  return matches
    .map((match) => normalizeAmount(match[1]))
    .filter((value): value is number => typeof value === 'number' && value > 0);
}

function detectCurrency(input: string): 'RUB' | 'USD' | 'EUR' {
  if (input.includes('доллар') || input.includes('usd') || input.includes('$')) {
    return 'USD';
  }

  if (input.includes('евро') || input.includes('eur') || input.includes('€')) {
    return 'EUR';
  }

  return 'RUB';
}

function extractAccountAfter(input: string, words: string[]) {
  for (const word of words) {
    const match = input.match(new RegExp(`\\s${word}\\s+(.+)$`, 'i'));
    if (match?.[1]) return match[1].trim();
  }

  return undefined;
}

function cleanCategory(input: string) {
  return stripAmountFromText(input)
    .replace(/\b(доход|расход|потратил|потратила|купил|купила|оплатил|оплатила|пришло|пришла|получил|получила|рублей|руб|₽|на|с|со|из|в)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCreateAccount(input: string) {
  return (
    (input.includes('создай') || input.includes('создать') || input.includes('открой')) &&
    (input.includes('счет') ||
      input.includes('счёт') ||
      input.includes('карту') ||
      input.includes('кошелек') ||
      input.includes('кошелёк'))
  );
}

function isFinancialPlanning(input: string) {
  return (
    input.includes('финансовую модель') ||
    input.includes('финансовая модель') ||
    input.includes('смогу скопить') ||
    input.includes('скопить') ||
    input.includes('накопить') ||
    input.includes('цель') ||
    input.includes('план накоп') ||
    input.includes('как накоп') ||
    input.includes('к концу года') ||
    input.includes('при зарплате') ||
    input.includes('расходом')
  );
}

function getAccountName(input: string, currency: 'RUB' | 'USD' | 'EUR') {
  const explicit = input.match(/(?:счет|счёт|карту|кошелек|кошелёк)\s+["«]?([^"»]+)["»]?/i)?.[1]?.trim();

  if (explicit && !explicit.includes('на сумму')) {
    return explicit.replace(/^названи[ея]\s+/i, '').trim();
  }

  if (currency === 'USD') return 'Долларовый счёт';
  if (currency === 'EUR') return 'Евро счёт';

  return 'Новый счёт';
}

function parsePlanning(input: string): AIParsedCommand {
  const amounts = parseAllAmounts(input);

  const monthlyIncome =
    input.includes('зарплат') || input.includes('доход')
      ? amounts[0]
      : undefined;

  const monthlyExpenses =
    input.includes('расход')
      ? amounts.length >= 2
        ? amounts[1]
        : undefined
      : undefined;

  const targetAmount =
    input.includes('скопить') ||
    input.includes('накопить') ||
    input.includes('цель')
      ? amounts.at(-1)
      : undefined;

  return {
    intent: 'financial_planning',
    monthlyIncome,
    monthlyExpenses,
    targetAmount,
    targetDateText: input.includes('концу года') ? 'к концу года' : undefined,
    question: input,
  };
}

export function fastFinanceParse(command: string): AIParsedCommand | null {
  const input = normalize(command);
  if (!input) return null;

  if (isCreateAccount(input)) {
    const currency = detectCurrency(input);
    const balance = parseAmount(input) ?? 0;

    return {
      intent: 'create_account',
      name: getAccountName(input, currency),
      type: input.includes('налич') ? 'cash' : 'card',
      currency,
      balance,
    };
  }

  if (isFinancialPlanning(input)) {
    return parsePlanning(input);
  }

  if (
    input.includes('покажи счета') ||
    input.includes('открой счета') ||
    input.includes('мои счета') ||
    input === 'счета' ||
    input === 'счёта'
  ) {
    return { intent: 'show_accounts' };
  }

  if (
    input.includes('сколько') ||
    input.includes('статист') ||
    input.includes('потратил на') ||
    input.includes('потратила на')
  ) {
    return {
      intent: 'stats',
      type: input.includes('доход') ? 'income' : 'expense',
      rawCategory: cleanCategory(input) || undefined,
    };
  }

  if (
    input.includes('переведи') ||
    input.includes('перевести') ||
    input.includes('перекинь') ||
    input.includes('перевод')
  ) {
    const amount = parseAmount(input);
    if (!amount) return null;

    const fromAccountName = extractAccountAfter(input, ['с', 'со', 'из']);
    const toAccountName = extractAccountAfter(input, ['на', 'в']);

    if (!toAccountName) return null;

    return {
      intent: 'transfer',
      amount,
      fromAccountName,
      toAccountName,
    };
  }

  const isIncome =
    input.startsWith('+') ||
    input.includes('доход') ||
    input.includes('зарплат') ||
    input.includes('аванс') ||
    input.includes('получил') ||
    input.includes('получила') ||
    input.includes('пришла') ||
    input.includes('пришло') ||
    input.includes('зачислили');

  if (isIncome) {
    const amount = parseAmount(input);
    if (!amount) return null;

    const accountName = extractAccountAfter(input, ['на', 'в']);
    const rawCategory = input.includes('зарплат')
      ? 'зарплата'
      : input.includes('аванс')
        ? 'аванс'
        : cleanCategory(input) || 'доход';

    return {
      intent: 'income',
      amount,
      rawCategory,
      description: rawCategory,
      accountName,
    };
  }

  const amount = parseAmount(input);

  if (amount) {
    const accountName = extractAccountAfter(input, ['с', 'со', 'из']);
    const rawCategory = cleanCategory(input) || 'расход';

    return {
      intent: 'expense',
      amount,
      rawCategory,
      description: rawCategory,
      accountName,
    };
  }

  return null;
}
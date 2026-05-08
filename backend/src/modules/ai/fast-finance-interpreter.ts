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
  const normalized = input.toLowerCase().replace(/ё/g, 'е');

  if (
    normalized.includes('доллар') ||
    normalized.includes('бакс') ||
    normalized.includes('usd') ||
    normalized.includes('$')
  ) {
    return 'USD';
  }

  if (normalized.includes('евро') || normalized.includes('eur') || normalized.includes('€')) {
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

function extractSectionName(input: string) {
  return input.match(/\sв\s+раздел\s+["«]?([^"»]+)["»]?/i)?.[1]?.trim();
}

function stripSectionPhrase(input: string) {
  return input.replace(/\sв\s+раздел\s+["«]?[^"»]+["»]?$/i, '').trim();
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

function cleanupAccountName(value: string) {
  return value
    .replace(/^и\s+/i, '')
    .replace(/^а\s+/i, '')
    .replace(/^назов(?:и|ем|ать)\s+(?:его|ее|её|счет|счёт)?\s*/i, '')
    .replace(/^с\s+названием\s+/i, '')
    .replace(/^под\s+названием\s+/i, '')
    .replace(/\s+(?:и|потом|затем)\s+(?:положи|закинь|внеси|пополни|добавь|зачисли).+$/i, '')
    .replace(/\b(?:положи|закинь|внеси|пополни|добавь|зачисли)\b.+$/i, '')
    .replace(/[«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAccountName(input: string, currency: 'RUB' | 'USD' | 'EUR') {
  const normalized = input.replace(/ё/g, 'е');

  const named = normalized.match(/(?:назов(?:и|ем|ать)|название|имя)\s+(?:его|ее|её|счета|счет|счёт)?\s*[«"]?([^«»"]+)[»"]?/i)?.[1];
  if (named) {
    const cleaned = cleanupAccountName(named);
    if (cleaned) return cleaned;
  }

  const quoted = normalized.match(/(?:счет|счёт|карту|кошелек|кошелёк)\s+[«"]([^«»"]+)[»"]/i)?.[1];
  if (quoted) {
    const cleaned = cleanupAccountName(quoted);
    if (cleaned) return cleaned;
  }

  const explicit = normalized.match(/(?:счет|счёт|карту|кошелек|кошелёк)\s+([^,.;]+?)(?:\s+(?:и|потом|затем)\s+|$)/i)?.[1];
  if (explicit) {
    const cleaned = cleanupAccountName(explicit);

    if (
      cleaned &&
      !/^на\s+/i.test(cleaned) &&
      !/^(и|а|туда|сюда)$/i.test(cleaned) &&
      !/^(долларовый|долларов|доллары|евро|рублевый|рублевыи)$/i.test(cleaned)
    ) {
      return cleaned;
    }
  }

  if (currency === 'USD') return 'Долларовый счёт';
  if (currency === 'EUR') return 'Евро счёт';

  return input.includes('налич') ? 'Наличка' : 'Новый счёт';
}


function normalizeAccountName(value: string) {
  return value
    .replace(/\b(и|а|потом|затем|туда|сюда|на него|на нее|на неё)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCreateAccountWithInitialIncome(input: string): AIParsedCommand | null {
  if (!isCreateAccount(input)) return null;

  const depositMatch = input.match(
    /(?:и\s+)?(?:положи|положить|закинь|закинуть|внеси|внести|пополн[иь]|добавь|добавить|зачисли|зачислить)\s+(?:туда|на\s+(?:него|нее|неё|счет|счёт|карту|кошелек|кошелёк))?\s*(.+)$/i,
  );

  if (!depositMatch) return null;

  const amount = parseAmount(depositMatch[1]);
  if (!amount) return null;

  const beforeDeposit = input.slice(0, depositMatch.index).trim();
  const currency = detectCurrency(input);
  const name = normalizeAccountName(getAccountName(beforeDeposit || input, currency));

  return {
    intent: 'batch',
    originalText: input,
    actions: [
      {
        intent: 'create_account',
        name: name || 'Новый счёт',
        type: input.includes('налич') ? 'cash' : 'card',
        currency,
        balance: 0,
      },
      {
        intent: 'income',
        amount,
        rawCategory: 'пополнение',
        description: 'пополнение счёта',
        accountName: name || 'Новый счёт',
      },
    ],
  };
}

function splitCompoundCommand(input: string) {
  return input
    .split(/\s+(?:и|потом|затем|после этого)\s+|[;\n]+/gi)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function parseCompoundCommand(input: string): AIParsedCommand | null {
  const parts = splitCompoundCommand(input);

  if (parts.length < 2) return null;

  const actions: AIParsedCommand[] = [];
  let lastAccountName: string | undefined;

  for (const part of parts) {
    const expanded = lastAccountName
      ? part.replace(/\b(туда|на него|на нее|на неё)\b/gi, `на ${lastAccountName}`)
      : part;

    const parsed = fastFinanceParse(expanded);
    if (!parsed || parsed.intent === 'unknown') continue;

    if (parsed.intent === 'batch') {
      actions.push(...parsed.actions);
      const created = parsed.actions.find((item) => item.intent === 'create_account') as Extract<AIParsedCommand, { intent: 'create_account' }> | undefined;
      if (created?.name) lastAccountName = created.name;
      continue;
    }

    actions.push(parsed);

    if (parsed.intent === 'create_account') {
      lastAccountName = parsed.name;
    }
  }

  if (actions.length < 2) return null;

  return {
    intent: 'batch',
    originalText: input,
    actions: actions.filter((item): item is Exclude<AIParsedCommand, { intent: 'batch' }> => item.intent !== 'batch'),
  };
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

  const accountWithInitialIncome = parseCreateAccountWithInitialIncome(input);
  if (accountWithInitialIncome) return accountWithInitialIncome;

  const compound = parseCompoundCommand(input);
  if (compound) return compound;

  const sectionAssignment = input.match(/^(?:запиши|перенеси)\s+все\s+(?:расходы|траты)\s+(?:по|на)\s+(.+?)\s+в\s+раздел\s+(.+)$/i);

  if (sectionAssignment) {
    return {
      intent: 'assign_expenses_to_section',
      rawQuery: sectionAssignment[1].trim(),
      sectionName: sectionAssignment[2].trim(),
    };
  }

  const createSection = input.match(/^создай\s+(?:раздел|папку)\s+(.+)$/i);

  if (createSection) {
    return {
      intent: 'create_section',
      name: createSection[1].trim(),
    };
  }

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

    const sectionName = extractSectionName(input);
    const cleanInput = stripSectionPhrase(input);
    const accountName = extractAccountAfter(cleanInput, ['на', 'в']);
    const rawCategory = input.includes('зарплат')
      ? 'зарплата'
      : input.includes('аванс')
        ? 'аванс'
        : cleanCategory(cleanInput) || 'доход';

    return {
      intent: 'income',
      amount,
      rawCategory,
      description: rawCategory,
      accountName,
      sectionName,
    };
  }

  const amount = parseAmount(input);

  if (amount) {
    const sectionName = extractSectionName(input);
    const cleanInput = stripSectionPhrase(input);
    const accountName = extractAccountAfter(cleanInput, ['с', 'со', 'из']);
    const rawCategory = cleanCategory(cleanInput) || 'расход';

    return {
      intent: 'expense',
      amount,
      rawCategory,
      description: rawCategory,
      accountName,
      sectionName,
    };
  }

  return null;
}
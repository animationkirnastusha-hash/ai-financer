import type { AIParsedCommand } from './types';
import { extractAmountFromText, stripAmountFromText, normalizeAmount, extractAmountCandidates, detectCurrency } from './utils/amount-normalizer';
import { cleanAccountName, compileNaturalCreateAccount, inferAccountType, repairParsedCommand } from './utils/command-compiler';

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
  return extractAmountCandidates(input).map((candidate) => candidate.amount);
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

function getAccountName(input: string, currency: 'RUB' | 'USD' | 'EUR' | 'VND') {
  const extracted = cleanAccountName(undefined, input);
  if (extracted && extracted !== 'Новый счёт') return extracted;
  if (currency === 'USD') return 'Долларовый счёт';
  if (currency === 'EUR') return 'Евро счёт';
  if (currency === 'VND') return 'VND счёт';
  return 'Новый счёт';
}

function normalizeAccountName(value: string) {
  return cleanAccountName(value);
}

function parseCreateAccountWithInitialIncome(input: string): AIParsedCommand | null {
  return compileNaturalCreateAccount(input);
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


function parseDepositToExistingAccount(input: string): AIParsedCommand | null {
  const depositWords = '(?:положи|пополн[иь]|закинь|добавь|внеси|депозит|deposit|top\\s*up|put|add)';
  if (!new RegExp(depositWords, 'i').test(input)) return null;

  const amount = parseAmount(input);
  if (!amount) return null;

  const accountPatterns = [
    new RegExp(`(?:на|в)\\s+(?:счет|счёт|карту|кошелек|кошел[её]к)\\s+(.+?)\\s+${depositWords}`, 'i'),
    new RegExp(`${depositWords}\\s+(?:на|в|туда|сюда)?\\s*(?:счет|счёт|карту|кошелек|кошел[её]к)?\\s*([^0-9₽$€]+?)\\s+\\d`, 'i'),
  ];

  let accountName: string | undefined;
  for (const pattern of accountPatterns) {
    const match = input.match(pattern);
    if (match?.[1]) {
      accountName = cleanAccountName(match[1]);
      break;
    }
  }

  if (!accountName || accountName === 'Новый счёт') return null;

  return {
    intent: 'income',
    amount,
    rawCategory: /депозит|deposit/i.test(input) ? 'депозит' : 'пополнение',
    description: /депозит|deposit/i.test(input) ? 'депозит' : 'пополнение счёта',
    accountName,
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
  if (accountWithInitialIncome) return repairParsedCommand(accountWithInitialIncome, input);

  const existingAccountDeposit = parseDepositToExistingAccount(input);
  if (existingAccountDeposit) return repairParsedCommand(existingAccountDeposit, input);

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

    return repairParsedCommand({
      intent: 'create_account',
      name: getAccountName(input, currency),
      type: inferAccountType(input),
      currency,
      balance,
    }, input);
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
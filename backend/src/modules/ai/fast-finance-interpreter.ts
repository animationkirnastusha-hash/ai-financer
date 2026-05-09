import type { AIParsedCommand } from './types';
import { extractAmountFromText, stripAmountFromText, normalizeAmount } from './utils/amount-normalizer';

type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'VND';

function normalize(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[«»]/g, '"')
    .replace(/\s+/g, ' ');
}

function parseAmount(input: string): number | null {
  return extractAmountFromText(input);
}

function parseAllAmounts(input: string): number[] {
  const amount = parseAmount(input);
  return amount ? [amount] : [];
}

function detectCurrency(input: string): CurrencyCode {
  const normalized = normalize(input);

  if (/\$|usd|доллар|бакс/.test(normalized)) return 'USD';
  if (/€|eur|евро/.test(normalized)) return 'EUR';
  if (/vnd|донг|вьетнам/.test(normalized)) return 'VND';

  return 'RUB';
}

function normalizeAccountType(input: string): 'cash' | 'card' | 'savings' | 'investment' {
  const normalized = normalize(input);

  if (/налич|cash|кэш/.test(normalized)) return 'cash';
  if (/накоп|копил|сбереж|saving/.test(normalized)) return 'savings';
  if (/инвест|invest/.test(normalized)) return 'investment';
  if (/карт|card|банк/.test(normalized)) return 'card';

  return 'cash';
}

function extractAccountAfter(input: string, words: string[]) {
  for (const word of words) {
    const match = input.match(new RegExp(`(?:^|\\s)${word}\\s+(.+)$`, 'i'));
    if (match?.[1]) return cleanAccountName(match[1]);
  }

  return undefined;
}

function cleanAccountName(value: string) {
  return value
    .replace(/["«»]/g, '')
    .replace(/\b(и|а|потом|затем|далее|туда|сюда|на\s+него|на\s+нее|на\s+неё|ему|ей)\b/gi, ' ')
    .replace(/\b(создай|создать|открой|открыть|счет|счёт|аккаунт|кошелек|кошелёк|карту|карта|под|названием|назови|назвать|дай|ему|ей|имя|название)\b/gi, ' ')
    .replace(/\b(положи|положить|закинь|закинуть|внеси|внести|пополнить|пополни|добавь|добавить|депозит|зачисли|зачислить)\b[\s\S]*$/gi, ' ')
    .replace(/\b(rub|руб(?:лей|ля|ль)?|₽|usd|доллар(?:ов|а)?|бакс(?:ов|а)?|\$|eur|евро|€|vnd|донг(?:ов|а)?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractExplicitAccountName(input: string, currency: CurrencyCode) {
  const quoted = input.match(/(?:счет|счёт|карту|кошелек|кошелёк|аккаунт)?\s*["«]([^"»]+)["»]/i)?.[1];
  if (quoted) return cleanAccountName(quoted);

  const named = input.match(/(?:под\s+названием|назови(?:\s+его)?|назвать(?:\s+его)?|дай(?:\s+ему)?\s+название)\s+(.+?)(?:\s+(?:и|потом|затем|положи|закинь|внеси|пополни|добавь|депозит)\b|$)/i)?.[1];
  if (named) return cleanAccountName(named);

  const afterAccount = input.match(/(?:создай|создать|открой|открыть)?\s*(?:счет|счёт|карту|кошелек|кошелёк|аккаунт)\s+(.+?)(?:\s+(?:и|потом|затем|положи|закинь|внеси|пополни|добавь|депозит)\b|$)/i)?.[1];
  if (afterAccount) return cleanAccountName(afterAccount);

  if (currency === 'USD') return 'Доллары';
  if (currency === 'EUR') return 'Евро';
  if (currency === 'VND') return 'Донги';

  return 'Новый счёт';
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
    /(создай|создать|открой|открыть)/.test(input) &&
    /(счет|счёт|карт|кошелек|кошелёк|аккаунт)/.test(input)
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

function parseCreateAccountWithInitialIncome(input: string): AIParsedCommand | null {
  if (!isCreateAccount(input)) return null;

  const depositMatch = input.match(
    /(?:\s|^)(?:и\s+)?(?:положи|положить|закинь|закинуть|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить)\s+(?:туда|на\s+(?:него|нее|неё|счет|счёт|карту|кошелек|кошелёк))?\s*(.+)$/i,
  );

  const currency = detectCurrency(input);
  const name = extractExplicitAccountName(
    depositMatch?.index !== undefined ? input.slice(0, depositMatch.index) : input,
    currency,
  );

  if (!depositMatch) {
    return {
      intent: 'create_account',
      name,
      type: normalizeAccountType(input),
      currency,
      balance: 0,
    };
  }

  const amount = parseAmount(depositMatch[1]);
  if (!amount) {
    return {
      intent: 'create_account',
      name,
      type: normalizeAccountType(input),
      currency,
      balance: 0,
    };
  }

  return {
    intent: 'batch',
    originalText: input,
    actions: [
      {
        intent: 'create_account',
        name,
        type: normalizeAccountType(input),
        currency,
        balance: 0,
      },
      {
        intent: 'income',
        amount,
        rawCategory: 'пополнение',
        description: /депозит/i.test(depositMatch[1]) ? 'депозит' : 'пополнение счёта',
        accountName: name,
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

  const actions: Array<Exclude<AIParsedCommand, { intent: 'batch' }>> = [];
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

    actions.push(parsed as Exclude<AIParsedCommand, { intent: 'batch' }>);

    if (parsed.intent === 'create_account') {
      lastAccountName = parsed.name;
    }
  }

  if (actions.length < 2) return null;

  return {
    intent: 'batch',
    originalText: input,
    actions,
  };
}

function parsePlanning(input: string): AIParsedCommand {
  const amounts = parseAllAmounts(input);
  return {
    intent: 'financial_planning',
    monthlyIncome: input.includes('зарплат') || input.includes('доход') ? amounts[0] : undefined,
    monthlyExpenses: input.includes('расход') ? amounts[1] : undefined,
    targetAmount: input.includes('скопить') || input.includes('накопить') || input.includes('цель') ? amounts.at(-1) : undefined,
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
  if (createSection) return { intent: 'create_section', name: createSection[1].trim() };

  if (isCreateAccount(input)) {
    const currency = detectCurrency(input);
    return {
      intent: 'create_account',
      name: extractExplicitAccountName(input, currency),
      type: normalizeAccountType(input),
      currency,
      balance: parseAmount(input) ?? 0,
    };
  }

  if (isFinancialPlanning(input)) return parsePlanning(input);

  if (input.includes('покажи счета') || input.includes('открой счета') || input.includes('мои счета') || input === 'счета' || input === 'счёта') {
    return { intent: 'show_accounts' };
  }

  if (input.includes('сколько') || input.includes('статист') || input.includes('потратил на') || input.includes('потратила на')) {
    return { intent: 'stats', type: input.includes('доход') ? 'income' : 'expense', rawCategory: cleanCategory(input) || undefined };
  }

  if (input.includes('переведи') || input.includes('перевести') || input.includes('перекинь') || input.includes('перевод')) {
    const amount = parseAmount(input);
    if (!amount) return null;
    const fromAccountName = extractAccountAfter(input, ['с', 'со', 'из']);
    const toAccountName = extractAccountAfter(input, ['на', 'в']);
    if (!toAccountName) return null;
    return { intent: 'transfer', amount, fromAccountName, toAccountName };
  }

  const isIncome =
    input.startsWith('+') ||
    input.includes('доход') ||
    input.includes('депозит') ||
    input.includes('пополн') ||
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
    const rawCategory = input.includes('зарплат') ? 'зарплата' : input.includes('аванс') ? 'аванс' : input.includes('депозит') ? 'депозит' : cleanCategory(cleanInput) || 'доход';

    return { intent: 'income', amount, rawCategory, description: rawCategory, accountName, sectionName };
  }

  const amount = parseAmount(input);
  if (amount) {
    const sectionName = extractSectionName(input);
    const cleanInput = stripSectionPhrase(input);
    const accountName = extractAccountAfter(cleanInput, ['с', 'со', 'из']);
    const rawCategory = cleanCategory(cleanInput) || 'расход';
    return { intent: 'expense', amount, rawCategory, description: rawCategory, accountName, sectionName };
  }

  return null;
}

import type { AIParsedCommand } from './types';
import { extractAmountFromText, normalizeAmount, stripAmountFromText } from './utils/amount-normalizer';

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
  const parts = input
    .toLowerCase()
    .replaceAll('ё', 'е')
    .split(/(?:,|;|\n|\s+и\s+|\s+потом\s+|\s+затем\s+)/g)
    .map((item) => normalizeAmount(item))
    .filter((item): item is number => typeof item === 'number' && item > 0);

  const full = extractAmountFromText(input);
  return parts.length > 0 ? parts : full ? [full] : [];
}

function detectCurrency(input: string): 'RUB' | 'USD' | 'EUR' {
  const normalized = normalize(input);

  if (/\b(usd|доллар|доллара|долларов|бакс|бакса|баксов)\b|\$/i.test(normalized)) return 'USD';
  if (/\b(eur|евро)\b|€/i.test(normalized)) return 'EUR';

  return 'RUB';
}

function normalizeAccountName(value: string) {
  return value
    .replace(/[«»"']/g, '')
    .replace(/\b(и|а|потом|затем|далее|после этого|туда|сюда|на него|на нее|на неё|положи|положить|закинь|закинуть|внеси|внести|пополнить|пополни|добавь|добавить|зачисли|зачислить|присвой|присвоить|валюту|валюта|ему|ей)\b/gi, ' ')
    .replace(/\b(на сумму|с балансом|балансом|баланс|рублей|рубля|руб|долларов|доллара|доллар|доллары|баксов|бакса|бакс|usd|евро|eur)\b/gi, ' ')
    .replace(/\d+[\d\s.,]*(?:кк|к|k|тыс|тысяч|тысячи|млн)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNamedAccount(input: string) {
  const quoted = input.match(/(?:назови|назвать|имя|название)\s+(?:его|ее|её|счета|счёта)?\s*[«"]([^»"]+)[»"]/i)?.[1];
  if (quoted) return normalizeAccountName(quoted);

  const named = input.match(/(?:назови|назвать)\s+(?:его|ее|её|счет|счёт|карту|кошелек|кошелёк)?\s+(.+?)(?:\s+(?:и|потом|затем|положи|закинь|внеси|пополни|добавь|присвой|присвоить|валюту|на сумму|с балансом)\b|$)/i)?.[1];
  if (named) return normalizeAccountName(named);

  return undefined;
}

function extractAccountNameFromCreate(input: string, currency: 'RUB' | 'USD' | 'EUR') {
  const named = extractNamedAccount(input);
  if (named) return named;

  const explicit = input.match(/(?:счет|счёт|карту|кошелек|кошелёк)\s+[«"]?(.+?)(?:[»"]|\s+(?:и|потом|затем|положи|закинь|внеси|пополни|добавь|присвой|присвоить|валюту|на сумму|с балансом|на|в)\b|$)/i)?.[1];

  if (explicit) {
    const cleaned = normalizeAccountName(explicit);
    if (cleaned) return cleaned;
  }

  if (/налич|кэш|cash/i.test(input)) return 'Наличка';
  if (currency === 'USD') return 'Доллары';
  if (currency === 'EUR') return 'Евро';

  return 'Новый счёт';
}

function extractAccountAfter(input: string, words: string[]) {
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = input.match(new RegExp(`(?:^|\\s)(?:${escaped})\\s+(?:счет|счёт|карту|карта|кошелек|кошелёк)?\\s*[«\"]?([^«»\".,;]+)`, 'i'));
  return match?.[1] ? normalizeAccountName(match[1]) : undefined;
}

function cleanCategory(input: string) {
  return stripAmountFromText(input)
    .replace(/\b(доход|расход|трата|трату|потратил|потратила|купил|купила|оплатил|оплатила|пришло|пришла|получил|получила|рублей|рубля|руб|₽|долларов|доллара|доллар|баксов|бакса|бакс|usd|eur|евро|на|с|со|из|в|по|за|положи|положить|закинь|закинуть|внеси|внести|пополни|пополнить|добавь|добавить)\b/gi, ' ')
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
    /(создай|создать|открой|открыть|добавь|добавить|заведи|завести)/i.test(input) &&
    /(счет|счёт|карту|карта|кошелек|кошелёк)/i.test(input)
  );
}

function isDepositOrIncome(input: string) {
  return /(^\+|доход|зарплат|аванс|получил|получила|пришла|пришло|зачислили|поступил|поступило|положи|положить|закинь|закинуть|внеси|внести|пополни|пополнить|пополнение|добавь|добавить|зачисли|зачислить)/i.test(input);
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

  const amount = parseAmount(input);
  const currency = detectCurrency(input);
  const name = extractAccountNameFromCreate(input, currency);
  const type = /налич|кэш|cash/i.test(input) ? 'cash' : 'card';

  const createAccountAction: Extract<AIParsedCommand, { intent: 'create_account' }> = {
    intent: 'create_account',
    name,
    type,
    currency,
    balance: 0,
  };

  if (!amount || !isDepositOrIncome(input)) {
    return amount
      ? { ...createAccountAction, balance: amount }
      : createAccountAction;
  }

  return {
    intent: 'batch',
    originalText: input,
    summary: `Создать счёт ${name} и пополнить на ${amount}`,
    actions: [
      createAccountAction,
      {
        intent: 'income',
        amount,
        rawCategory: 'пополнение',
        description: 'пополнение счёта',
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

  const actions: AIParsedCommand[] = [];
  let lastAccountName: string | undefined;

  for (const part of parts) {
    const expanded = lastAccountName
      ? part.replace(/\b(туда|на него|на нее|на неё)\b/gi, `на счет ${lastAccountName}`)
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

  const monthlyIncome = input.includes('зарплат') || input.includes('доход') ? amounts[0] : undefined;
  const monthlyExpenses = input.includes('расход') ? (amounts.length >= 2 ? amounts[1] : undefined) : undefined;
  const targetAmount = input.includes('скопить') || input.includes('накопить') || input.includes('цель') ? amounts.at(-1) : undefined;

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

  if (isFinancialPlanning(input)) return parsePlanning(input);

  if (/покажи счета|открой счета|мои счета|^сч[её]та$/i.test(input)) {
    return { intent: 'show_accounts' };
  }

  if (input.includes('сколько') || input.includes('статист') || input.includes('потратил на') || input.includes('потратила на')) {
    return {
      intent: 'stats',
      type: input.includes('доход') ? 'income' : 'expense',
      rawCategory: cleanCategory(input) || undefined,
    };
  }

  if (/переведи|перевести|перекинь|перевод/i.test(input)) {
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

  if (isIncomeOrDeposit(input)) {
    const amount = parseAmount(input);
    if (!amount) return null;

    const sectionName = extractSectionName(input);
    const cleanInput = stripSectionPhrase(input);
    const accountName = extractAccountAfter(cleanInput, ['на', 'в']);
    const rawCategory = input.includes('зарплат')
      ? 'зарплата'
      : input.includes('аванс')
        ? 'аванс'
        : input.includes('пополн') || input.includes('полож') || input.includes('закин') || input.includes('внес')
          ? 'пополнение'
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

function isIncomeOrDeposit(input: string) {
  return isDepositOrIncome(input);
}

import type { AIParsedAtomicCommand, AIParsedCommand } from '../types';
import {
  CurrencyCode,
  extractAmountCandidates,
  extractAmountFromText,
  extractCurrencyFromText,
  normalizeAmount,
  stripAmountFromText,
} from './amount-normalizer';

const ACCOUNT_WORDS = '(?:счет|счёт|счета|счёта|аккаунт|карту|карта|кошелек|кошел[её]к|wallet|account)';
const CREATE_WORDS = '(?:создай|создать|открой|открыть|заведи|завести|create|open|add)';
const DEPOSIT_WORDS = '(?:положи|положить|закинь|закинуть|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить|депозит|deposit|top\\s*up|put|add|nạp|nap|присвой|присвоить)';
const EXPENSE_WORDS = '(?:потратил|потратила|трата|расход|купил|купила|оплатил|оплатила|списал|списали|spent|paid|buy|mua|chi)';
const INCOME_WORDS = '(?:доход|зарплат|аванс|получил|получила|пришло|пришла|зачислили|пополнение|депозит|положи|пополни|закинь|добавь|внеси|присвой|income|salary|deposit|top\\s*up|received|nhận|luong|lương)';

const ACCOUNT_TYPE_WORDS = /\b(?:карта|карту|card|наличные|наличка|наличными|cash|кошелек|кошел[её]к|wallet|накопительный|накопления|savings?|инвест|investment)\b/gi;
const CURRENCY_WORDS = /(?:₽|руб(?:ль|ля|лей|ли)?|рублях|rub|ruble|rouble|\$|usd|доллар(?:а|ов|ах)?|бакс(?:а|ов|ах)?|bucks?|€|eur|евро|vnd|₫|донг(?:а|ов|ах)?|dong|đồng)/gi;
const NAME_MARKER = '(?:с\\s+названием|под\\s+названием|назови(?:\\s+его|\\s+ее|\\s+её)?|назвать|дай(?:\\s+ему|\\s+ей)?\\s+название|name(?:\\s+it)?|called)';
const STOP_AFTER_NAME = '(?:,|;|\\.|\\s+(?:и|а|then|and|потом|затем|следом|после\\s+этого)\\s+(?:положи|положить|закинь|закинуть|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить|депозит|deposit|top\\s*up|put|add|присвой|присвоить)|\\s+(?:положи|положить|закинь|закинуть|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить|депозит|deposit|top\\s*up|put|add|присвой|присвоить)|$)';

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function trimQuotes(value: string) {
  return value.replace(/^[\s"'«»]+|[\s"'«»]+$/g, '').trim();
}

function uniqueByName(actions: AIParsedAtomicCommand[]) {
  const result: AIParsedAtomicCommand[] = [];

  for (const action of actions) {
    if (action.intent === 'create_account') {
      const exists = result.some((item) => item.intent === 'create_account' && normalizeText(item.name) === normalizeText(action.name));
      if (exists) continue;
    }
    result.push(action);
  }

  return result;
}

export function cleanAccountName(raw: unknown, originalText = ''): string {
  const fallback = extractAccountNameFromText(originalText) || 'Новый счёт';
  let cleaned = String(raw ?? '').trim() || fallback;

  for (const candidate of [...extractAmountCandidates(cleaned)].sort((a, b) => b.index - a.index)) {
    cleaned = `${cleaned.slice(0, candidate.index)} ${cleaned.slice(candidate.index + candidate.raw.length)}`;
  }

  cleaned = cleaned
    .replace(/^\s*(?:счет|счёт|account|wallet)\s+/i, ' ')
    .replace(new RegExp(`^\\s*${NAME_MARKER}\\s+`, 'i'), ' ')
    .replace(/^\s*(?:его|ее|её|it)\s+/i, ' ')
    .replace(new RegExp(`\\s+(?:и|а|then|and|потом|затем|следом|после\\s+этого)\\s+${DEPOSIT_WORDS}\\b.*$`, 'i'), ' ')
    .replace(new RegExp(`\\b${DEPOSIT_WORDS}\\b.*$`, 'i'), ' ')
    .replace(/\b(?:на|в|во|к|туда|сюда|ему|ей|него|нее|неё|it)\b$/gi, ' ')
    .replace(ACCOUNT_TYPE_WORDS, ' ')
    .replace(CURRENCY_WORDS, ' ')
    .replace(/[₽$€₫]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return trimQuotes(cleaned) || 'Новый счёт';
}

function extractMarkedName(text: string): string | undefined {
  const pattern = new RegExp(`${NAME_MARKER}\\s+["«]?(.+?)["»]?${STOP_AFTER_NAME}`, 'i');
  const match = text.match(pattern);
  const value = match?.[1] ? cleanAccountName(match[1]) : undefined;
  return value && value !== 'Новый счёт' ? value : undefined;
}

function extractNameAfterAccountWord(text: string): string | undefined {
  const pattern = new RegExp(`${ACCOUNT_WORDS}\\s+(.+?)(?:\\s+(?:и|а|then|and|потом|затем|следом|после\\s+этого)\\s+${DEPOSIT_WORDS}|\\s+${DEPOSIT_WORDS}|,|;|$)`, 'i');
  const match = text.match(pattern);
  if (!match?.[1]) return undefined;

  let value = match[1]
    .replace(new RegExp(`^\\s*(?:в|во|на)\\s+${CURRENCY_WORDS.source}\\s*`, 'i'), ' ')
    .replace(new RegExp(`^\\s*${NAME_MARKER}\\s+`, 'i'), ' ')
    .trim();

  const onlyTypeOrCurrency = value
    .replace(ACCOUNT_TYPE_WORDS, ' ')
    .replace(CURRENCY_WORDS, ' ')
    .replace(/\b(?:в|во|на|и|а)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!onlyTypeOrCurrency) return undefined;

  const cleaned = cleanAccountName(value);
  return cleaned && cleaned !== 'Новый счёт' ? cleaned : undefined;
}

export function extractAccountNameFromText(text: string): string | undefined {
  const input = text.trim();
  return extractMarkedName(input) || extractNameAfterAccountWord(input);
}

export function inferAccountType(text: string, explicit?: unknown): string {
  const raw = normalizeText(String(explicit ?? ''));
  const input = normalizeText(text);

  if (raw.includes('cash') || raw.includes('налич') || raw.includes('кэш') || input.includes('налич')) return 'cash';
  if (raw.includes('saving') || raw.includes('накоп') || raw.includes('копил') || input.includes('накоп')) return 'savings';
  if (raw.includes('invest') || raw.includes('инвест') || input.includes('инвест')) return 'investment';
  if (raw.includes('card') || raw.includes('карт') || /\bкарта\b|\bкарту\b/i.test(input)) return 'card';

  return 'cash';
}

export function inferTransactionType(text: string, explicit?: unknown): 'income' | 'expense' {
  const source = normalizeText(`${String(explicit ?? '')} ${text}`);
  if (new RegExp(INCOME_WORDS, 'i').test(source)) return 'income';
  if (new RegExp(EXPENSE_WORDS, 'i').test(source)) return 'expense';
  return 'expense';
}

export function inferCurrency(text: string, explicit?: unknown, fallback: CurrencyCode = 'RUB'): CurrencyCode {
  const explicitText = String(explicit ?? '').trim();
  if (explicitText) {
    const explicitCurrency = extractCurrencyFromText(explicitText, fallback);
    if (explicitCurrency) return explicitCurrency;
  }

  return extractCurrencyFromText(text, fallback) ?? fallback;
}

const CURRENCY_RATES_TO_RUB: Record<CurrencyCode, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

function convertAmount(amount: number, from: CurrencyCode | undefined, to: CurrencyCode): number {
  if (!from || from === to) return amount;
  const rub = amount * CURRENCY_RATES_TO_RUB[from];
  const target = rub / CURRENCY_RATES_TO_RUB[to];
  return Math.round(target * 100) / 100;
}

function chooseAmount(value: unknown, originalText: string): number | null {
  const normalized = normalizeAmount(value);
  const bestFromText = extractAmountFromText(originalText);

  if (bestFromText && (!normalized || (normalized <= 100 && bestFromText > normalized))) {
    return bestFromText;
  }

  return normalized;
}

function getFirstAmountCandidate(text: string) {
  return extractAmountCandidates(text)[0];
}

function getDepositSegment(text: string): string | undefined {
  const pattern = new RegExp(`(?:${DEPOSIT_WORDS})\\s+(?:туда|сюда|ему|ей|на\\s+(?:него|нее|неё|счет|счёт|карту|кошелек|кошелёк))?\\s*(.+)$`, 'i');
  const match = text.match(pattern);
  return match?.[1]?.trim();
}

export function extractDepositSegment(text: string): string | undefined {
  return getDepositSegment(text);
}

function splitCreateAccountClauses(text: string): string[] {
  const normalized = text.trim();
  const starts: number[] = [];
  const pattern = new RegExp(`${CREATE_WORDS}\\s+${ACCOUNT_WORDS}`, 'gi');

  for (const match of normalized.matchAll(pattern)) {
    if (typeof match.index === 'number') starts.push(match.index);
  }

  if (starts.length <= 1) return [normalized];

  return starts.map((start, index) => {
    const end = starts[index + 1] ?? normalized.length;
    return normalized.slice(start, end).replace(/^\s*(?:и|а|then|and|потом|затем|следом)\s+/i, '').trim();
  });
}

function compileSingleCreateAccountClause(input: string): AIParsedCommand | null {
  if (!new RegExp(`${CREATE_WORDS}\\s+${ACCOUNT_WORDS}`, 'i').test(input)) return null;

  const name = cleanAccountName(extractAccountNameFromText(input), input);
  const accountCurrency = inferCurrency(input);
  const accountType = inferAccountType(input);
  const depositSegment = getDepositSegment(input);
  const amountCandidate = depositSegment ? getFirstAmountCandidate(depositSegment) : getFirstAmountCandidate(input);
  const amount = amountCandidate?.amount ?? null;
  const amountCurrency = amountCandidate?.currency ?? inferCurrency(depositSegment || '', undefined, accountCurrency);

  const createAccount: AIParsedAtomicCommand = {
    intent: 'create_account',
    name,
    type: accountType,
    currency: accountCurrency,
    balance: 0,
  };

  if (!amount || !depositSegment) return createAccount;

  return {
    intent: 'batch',
    originalText: input,
    actions: [
      createAccount,
      {
        intent: 'income',
        amount: convertAmount(amount, amountCurrency, accountCurrency),
        rawCategory: /депозит|deposit/i.test(input) ? 'депозит' : 'пополнение',
        description: /депозит|deposit/i.test(input) ? 'депозит' : 'пополнение счёта',
        accountName: name,
      },
    ],
  };
}

export function compileNaturalCreateAccount(text: string): AIParsedCommand | null {
  const input = text.trim();
  if (!new RegExp(`${CREATE_WORDS}\\s+${ACCOUNT_WORDS}`, 'i').test(input)) return null;

  const clauses = splitCreateAccountClauses(input);
  const actions: AIParsedAtomicCommand[] = [];

  for (const clause of clauses) {
    const compiled = compileSingleCreateAccountClause(clause);
    if (!compiled) continue;

    if (compiled.intent === 'batch') {
      actions.push(...compiled.actions);
    } else {
      actions.push(compiled);
    }
  }

  const normalizedActions = uniqueByName(actions);

  if (normalizedActions.length === 0) return null;
  if (normalizedActions.length === 1) return normalizedActions[0];

  return {
    intent: 'batch',
    originalText: input,
    actions: normalizedActions,
  };
}


export function compileNaturalTopUp(
  text: string,
  accountName?: string,
  currency?: CurrencyCode,
): AIParsedAtomicCommand | null {
  const amountCandidate = getFirstAmountCandidate(text);
  const amount = amountCandidate?.amount ?? extractAmountFromText(text);

  if (!amount || amount <= 0) {
    return null;
  }

  const resolvedCurrency = amountCandidate?.currency ?? inferCurrency(text, currency, currency ?? 'RUB');
  const rawDescription = stripAmountFromText(text)
    .replace(new RegExp(CREATE_WORDS, 'gi'), ' ')
    .replace(new RegExp(ACCOUNT_WORDS, 'gi'), ' ')
    .replace(new RegExp(NAME_MARKER, 'gi'), ' ')
    .replace(new RegExp(DEPOSIT_WORDS, 'gi'), ' ')
    .replace(CURRENCY_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    intent: 'income',
    amount,
    currency: resolvedCurrency,
    rawCategory: rawDescription || 'пополнение',
    description: rawDescription || 'пополнение счёта',
    accountName: accountName ? cleanAccountName(accountName, text) : undefined,
  } as AIParsedAtomicCommand;
}


export function repairParsedCommand(command: AIParsedCommand, originalText = ''): AIParsedCommand {
  const text = originalText || ('originalText' in command ? command.originalText ?? '' : '');

  const naturalCreateAccount = text ? compileNaturalCreateAccount(text) : null;
  if (naturalCreateAccount && (command.intent === 'create_account' || command.intent === 'batch')) {
    return naturalCreateAccount;
  }

  if (command.intent === 'batch') {
    let lastAccountName: string | undefined;
    let lastAccountCurrency: CurrencyCode | undefined;

    const actions = command.actions.map((action) => {
      const repaired = repairParsedCommand(action, text) as AIParsedAtomicCommand;

      if (repaired.intent === 'create_account') {
        lastAccountName = repaired.name;
        lastAccountCurrency = inferCurrency(String(repaired.currency || ''), undefined, 'RUB');
      }

      if ((repaired.intent === 'income' || repaired.intent === 'expense') && lastAccountName) {
        repaired.accountName = repaired.accountName ? cleanAccountName(repaired.accountName, text) : lastAccountName;
        if (lastAccountCurrency) {
          const candidate = getFirstAmountCandidate(text);
          repaired.amount = convertAmount(repaired.amount, candidate?.currency, lastAccountCurrency);
        }
      }

      return repaired;
    });

    return { ...command, actions };
  }

  if (command.intent === 'create_account') {
    const name = cleanAccountName(command.name, text);
    const currency = inferCurrency(text, command.currency);

    return {
      ...command,
      name,
      type: inferAccountType(text, command.type),
      currency,
      balance: normalizeAmount(command.balance) ?? 0,
    };
  }

  if (command.intent === 'income' || command.intent === 'expense') {
    const amount = chooseAmount(command.amount, text) ?? command.amount;
    const cleanDescription = stripAmountFromText(command.description || command.rawCategory || (command.intent === 'income' ? 'доход' : 'расход'));

    return {
      ...command,
      amount,
      rawCategory: cleanDescription || command.rawCategory || (command.intent === 'income' ? 'доход' : 'расход'),
      description: cleanDescription || command.description,
      accountName: command.accountName ? cleanAccountName(command.accountName, text) : command.accountName,
    };
  }

  if (command.intent === 'transfer') {
    return {
      ...command,
      amount: chooseAmount(command.amount, text) ?? command.amount,
      fromAccountName: command.fromAccountName ? cleanAccountName(command.fromAccountName, text) : command.fromAccountName,
      toAccountName: cleanAccountName(command.toAccountName, text),
    };
  }

  return command;
}

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
const DEPOSIT_WORDS = '(?:положи|положить|закинь|закинуть|внеси|внести|пополн[иь]|добавь|добавить|зачисли|зачислить|депозит|deposit|top\\s*up|put|add|nạp|nap)';
const EXPENSE_WORDS = '(?:потратил|потратила|трата|расход|купил|купила|оплатил|оплатила|списал|списали|spent|paid|buy|mua|chi)';
const INCOME_WORDS = '(?:доход|зарплат|аванс|получил|получила|пришло|пришла|зачислили|пополнение|депозит|income|salary|deposit|top\\s*up|received|nhận|luong|lương)';

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function cleanAccountName(raw: unknown, originalText = ''): string {
  const base = String(raw ?? '').trim() || extractAccountNameFromText(originalText) || 'Новый счёт';
  const amountCandidates = extractAmountCandidates(base);
  let cleaned = base;

  for (const candidate of [...amountCandidates].sort((a, b) => b.index - a.index)) {
    cleaned = cleaned.slice(0, candidate.index) + ' ' + cleaned.slice(candidate.index + candidate.raw.length);
  }

  cleaned = cleaned
    .replace(/^["'«»]+|["'«»]+$/g, '')
    .replace(new RegExp(`\\b(?:и|а|then|and|потом|затем|после\\s+этого|туда|сюда|на\\s+него|на\\s+нее|на\\s+неё)\\b.*$`, 'i'), ' ')
    .replace(new RegExp(`\\b${DEPOSIT_WORDS}\\b.*$`, 'i'), ' ')
    .replace(/\b(?:назови|назвать|название|имя|его|ее|её|it|called|name)\b/gi, ' ')
    .replace(/\b(?:руб(?:ль|ля|лей)?|доллар(?:а|ов)?|бакс(?:а|ов)?|евро|донг(?:ов)?|usd|eur|rub|vnd)\b/gi, ' ')
    .replace(/[₽$€₫]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || 'Новый счёт';
}

export function extractAccountNameFromText(text: string): string | undefined {
  const input = text.trim();
  const patterns = [
    new RegExp(`${ACCOUNT_WORDS}\\s+["«]([^"»]+)["»]`, 'i'),
    new RegExp(`${ACCOUNT_WORDS}\\s+(.+?)(?:\\s+(?:и|а|then|and|потом|затем|после\\s+этого)\\s+|$)`, 'i'),
    /(?:назови|назвать|name(?:\s+it)?|called)\s+(?:его|ее|её|it)?\s*["«]?([^"»]+)["»]?/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    const name = match?.[1] ? cleanAccountName(match[1]) : undefined;
    if (name && name !== 'Новый счёт') return name;
  }

  return undefined;
}

export function inferAccountType(text: string, explicit?: unknown): string {
  const raw = normalizeText(String(explicit ?? ''));
  const input = normalizeText(text);

  if (raw.includes('cash') || raw.includes('налич') || raw.includes('кэш') || input.includes('налич')) return 'cash';
  if (raw.includes('saving') || raw.includes('накоп') || raw.includes('копил') || input.includes('накоп')) return 'savings';
  if (raw.includes('invest') || raw.includes('инвест') || input.includes('инвест')) return 'investment';
  if (raw.includes('card') || raw.includes('карт') || input.includes('карт')) return 'card';

  return 'cash';
}

export function inferTransactionType(text: string, explicit?: unknown): 'income' | 'expense' {
  const source = normalizeText(`${String(explicit ?? '')} ${text}`);
  if (new RegExp(INCOME_WORDS, 'i').test(source)) return 'income';
  if (new RegExp(EXPENSE_WORDS, 'i').test(source)) return 'expense';
  return 'expense';
}

export function inferCurrency(text: string, explicit?: unknown, fallback: CurrencyCode = 'RUB'): CurrencyCode {
  const explicitCurrency = extractCurrencyFromText(String(explicit ?? ''), undefined as unknown as CurrencyCode);
  if (explicitCurrency) return explicitCurrency;
  return extractCurrencyFromText(text, fallback);
}


function chooseAmount(value: unknown, originalText: string): number | null {
  const normalized = normalizeAmount(value);
  const bestFromText = extractAmountFromText(originalText);

  if (bestFromText && (!normalized || (normalized <= 100 && bestFromText > normalized))) {
    return bestFromText;
  }

  return normalized;
}

export function extractDepositSegment(text: string): string | undefined {
  const match = text.match(new RegExp(`(?:и|а|then|and|потом|затем|после\\s+этого)?\\s*${DEPOSIT_WORDS}\\s+(?:туда|сюда|на\\s+(?:него|нее|неё|счет|счёт|карту|кошелек|кошелёк))?\\s*(.+)$`, 'i'));
  return match?.[1]?.trim();
}

export function compileNaturalCreateAccount(text: string): AIParsedCommand | null {
  const input = text.trim();
  if (!new RegExp(`(?:создай|создать|открой|открыть|заведи|завести|create|open|add)\\s+${ACCOUNT_WORDS}`, 'i').test(input)) {
    return null;
  }

  const name = cleanAccountName(extractAccountNameFromText(input), input);
  const currency = inferCurrency(input);
  const type = inferAccountType(input);
  const depositSegment = extractDepositSegment(input);
  const amount = depositSegment ? extractAmountFromText(depositSegment) : extractAmountFromText(input);
  const depositCurrency = inferCurrency(depositSegment || input, undefined, currency);

  const createAccount: AIParsedAtomicCommand = {
    intent: 'create_account',
    name,
    type,
    currency: depositCurrency || currency,
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
        amount,
        rawCategory: /депозит|deposit/i.test(input) ? 'депозит' : 'пополнение',
        description: /депозит|deposit/i.test(input) ? 'депозит' : 'пополнение счёта',
        accountName: name,
      },
    ],
  };
}

export function repairParsedCommand(command: AIParsedCommand, originalText = ''): AIParsedCommand {
  const text = originalText || ('originalText' in command ? command.originalText ?? '' : '');

  if (command.intent === 'batch') {
    let lastAccountName: string | undefined;
    const actions = command.actions.map((action) => {
      const repaired = repairParsedCommand(action, text) as AIParsedAtomicCommand;

      if (repaired.intent === 'create_account') {
        lastAccountName = repaired.name;
      }

      if ((repaired.intent === 'income' || repaired.intent === 'expense') && !repaired.accountName && lastAccountName) {
        repaired.accountName = lastAccountName;
      }

      return repaired;
    });

    return { ...command, actions };
  }

  if (command.intent === 'create_account') {
    const amountInName = extractAmountFromText(command.name);
    const name = cleanAccountName(command.name, text);
    const currency = inferCurrency(text, command.currency);

    return {
      ...command,
      name,
      type: inferAccountType(text, command.type),
      currency,
      balance: amountInName ? 0 : normalizeAmount(command.balance) ?? 0,
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

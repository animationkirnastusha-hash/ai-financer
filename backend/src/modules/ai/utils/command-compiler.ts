import type { AIParsedAtomicCommand, AIParsedCommand } from '../types';
import {
  CurrencyCode,
  extractAmountCandidates,
  extractAmountFromText,
  extractCurrencyFromText,
  normalizeAmount,
  stripAmountFromText,
} from './amount-normalizer';

type AccountType = 'cash' | 'card' | 'savings' | 'investment';

const CURRENCY_WORDS = /(?:₽|руб(?:ль|ля|лей|ли)?|рублях|rub|ruble|rouble|\$|usd|доллар(?:а|ов|ах)?|бакс(?:а|ов|ах)?|bucks?|€|eur|евро|vnd|₫|донг(?:а|ов|ах)?|dong|đồng)/gi;
const ACCOUNT_WORDS = /\b(?:счет|счёт|счета|счёта|аккаунт|кошелек|кошел[её]к|карта|карту|wallet|account|card)\b/gi;
const COMMAND_WORDS = /\b(?:создай|создать|открой|открыть|заведи|завести|назови|назвать|название|с\s+названием|под\s+названием|положи|положить|пополнить|пополни|закинь|закинуть|внеси|внести|добавь|добавить|присвой|присвоить|переведи|перевести|перемести|удали|удалить|очисти|очистить|history|clear|delete|create|open|name|called|deposit|top\s*up|transfer|move|send)\b/gi;

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/["'«»]/g, '').replace(/\s+/g, ' ').trim();
}

function stripAmounts(value: string) {
  let result = value;
  for (const candidate of [...extractAmountCandidates(value)].sort((a, b) => b.index - a.index)) {
    result = `${result.slice(0, candidate.index)} ${result.slice(candidate.endIndex)}`;
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function cleanEntityName(raw: unknown, fallback = ''): string {
  const source = String(raw ?? '').trim() || fallback;
  const cleaned = stripAmounts(source)
    .replace(COMMAND_WORDS, ' ')
    .replace(ACCOUNT_WORDS, ' ')
    .replace(CURRENCY_WORDS, ' ')
    .replace(/\b(?:и|а|then|and|потом|затем|туда|сюда|ему|ей|его|ее|её|на|в|во|из|с|со|to|from|into|there|it)\b/gi, ' ')
    .replace(/[.,;:]+$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback || 'Без названия';
}

export function cleanAccountName(raw: unknown, originalText = ''): string {
  const explicit = extractMarkedName(originalText);
  const cleaned = cleanEntityName(raw, explicit || 'Новый счёт');
  return cleaned || explicit || 'Новый счёт';
}

function extractMarkedName(text: string): string | undefined {
  const patterns = [
    /(?:с\s+названием|под\s+названием|назови(?:\s+его|\s+ее|\s+её)?|дай(?:\s+ему|\s+ей)?\s+название|name(?:\s+it)?|called)\s+["«]?([^"».,;]+)["»]?/i,
    /(?:счет|счёт|account|wallet|card|карту|карта)\s+["«]?([^"».,;]+)["»]?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const name = cleanEntityName(match[1]);
    if (name && name !== 'Без названия') return name;
  }

  return undefined;
}

export function inferAccountType(text: string, explicit?: unknown): AccountType {
  const source = normalizeText(`${explicit ?? ''} ${text}`);

  if (/\b(?:инвест|investment|broker|брокер)\b/.test(source)) return 'investment';
  if (/\b(?:накоп|сбереж|saving|savings|копил)\b/.test(source)) return 'savings';
  if (/\b(?:card|карта|карту|безнал|безналичный|безналичная|банк|банковск|debit|credit)\b/.test(source)) return 'card';
  if (/\b(?:cash|налич|кэш)\b/.test(source)) return 'cash';

  return 'cash';
}

export function inferTransactionType(text: string, explicit?: unknown): 'income' | 'expense' {
  const source = normalizeText(`${explicit ?? ''} ${text}`);

  if (/\b(?:income|доход|зарплат|аванс|получил|получила|пришло|пришла|зачислили|пополн|депозит|deposit|top up|закинь|положи|внеси|добавь|присвой)\b/.test(source)) return 'income';
  if (/\b(?:expense|расход|потратил|потратила|купил|купила|оплатил|оплатила|списал|трата|spent|paid|buy)\b/.test(source)) return 'expense';

  return 'expense';
}

export function inferCurrency(text: string, explicit?: unknown, fallback: CurrencyCode = 'RUB'): CurrencyCode {
  const explicitText = String(explicit ?? '').trim();
  if (explicitText) {
    const found = extractCurrencyFromText(explicitText);
    if (found) return found;
  }

  return extractCurrencyFromText(text, fallback) ?? fallback;
}

function amountFrom(value: unknown, text = ''): number | null {
  const normalized = normalizeAmount(value);
  if (normalized !== null && normalized > 0) return normalized;
  return text ? extractAmountFromText(text) : null;
}

export function repairParsedCommand(command: AIParsedCommand, originalText = ''): AIParsedCommand {
  if (command.intent === 'batch') {
    let lastAccountName: string | undefined;
    return {
      ...command,
      actions: command.actions.map((action) => {
        const fixed = repairParsedCommand(action, originalText) as AIParsedAtomicCommand;
        if (fixed.intent === 'create_account') lastAccountName = fixed.name;
        if ((fixed.intent === 'income' || fixed.intent === 'expense') && !fixed.accountName && lastAccountName) {
          fixed.accountName = lastAccountName;
        }
        if (fixed.intent === 'transfer' && !fixed.fromAccountName && lastAccountName && normalizeText(lastAccountName) !== normalizeText(fixed.toAccountName)) {
          fixed.fromAccountName = lastAccountName;
        }
        return fixed;
      }),
    };
  }

  if (command.intent === 'create_account') {
    return {
      ...command,
      name: cleanAccountName(command.name, originalText),
      type: inferAccountType(originalText, command.type),
      currency: inferCurrency(originalText, command.currency),
      balance: Math.round((normalizeAmount(command.balance) ?? Number(command.balance)) || 0),
    };
  }

  if (command.intent === 'income' || command.intent === 'expense') {
    const description = stripAmountFromText(command.description || command.rawCategory || originalText || '');
    return {
      ...command,
      amount: Math.round(amountFrom(command.amount, originalText) ?? command.amount),
      currency: command.currency ? inferCurrency(originalText, command.currency) : extractCurrencyFromText(originalText),
      rawCategory: cleanEntityName(command.rawCategory || description, command.intent === 'income' ? 'доход' : 'расход'),
      description: description || command.description || command.rawCategory,
      accountName: command.accountName ? cleanAccountName(command.accountName, originalText) : undefined,
      sectionName: command.sectionName ? cleanEntityName(command.sectionName) : undefined,
    };
  }

  if (command.intent === 'transfer') {
    return {
      ...command,
      amount: Math.round(amountFrom(command.amount, originalText) ?? command.amount),
      currency: command.currency ? inferCurrency(originalText, command.currency) : extractCurrencyFromText(originalText),
      fromAccountName: command.fromAccountName ? cleanAccountName(command.fromAccountName, originalText) : undefined,
      toAccountName: cleanAccountName(command.toAccountName, originalText),
      description: command.description || 'Перевод между счетами',
    };
  }

  if (command.intent === 'create_category') {
    return { ...command, name: cleanEntityName(command.name), sectionName: command.sectionName ? cleanEntityName(command.sectionName) : undefined };
  }

  if (command.intent === 'create_section') return { ...command, name: cleanEntityName(command.name) };
  if (command.intent === 'assign_expenses_to_section') return { ...command, rawQuery: cleanEntityName(command.rawQuery), sectionName: cleanEntityName(command.sectionName) };

  return command;
}

export function compileNaturalCreateAccount(text: string): AIParsedCommand | null {
  const normalized = normalizeText(text);
  if (!/(создай|создать|открой|заведи|create|open).*(счет|счёт|account|wallet|карту|карта)/i.test(normalized)) return null;

  const name = cleanAccountName(extractMarkedName(text), text);
  const amount = extractAmountFromText(text);
  const currency = inferCurrency(text);
  const account: AIParsedAtomicCommand = {
    intent: 'create_account',
    name,
    type: inferAccountType(text),
    currency,
    balance: 0,
  };

  if (!amount || !/(полож|пополн|закин|внес|добав|депозит|deposit|top up|присвой)/i.test(normalized)) return account;

  return {
    intent: 'batch',
    originalText: text,
    actions: [
      account,
      {
        intent: 'income',
        amount,
        currency: extractCurrencyFromText(text) ?? currency,
        rawCategory: 'пополнение',
        description: 'пополнение счёта',
        accountName: name,
      },
    ],
  };
}

export function compileNaturalTopUp(text: string, accountName?: string): Extract<AIParsedAtomicCommand, { intent: 'income' }> | null {
  if (!/(полож|пополн|закин|внес|добав|депозит|deposit|top up|присвой)/i.test(text)) return null;
  const amount = extractAmountFromText(text);
  if (!amount) return null;

  return {
    intent: 'income',
    amount,
    currency: extractCurrencyFromText(text),
    rawCategory: 'пополнение',
    description: 'пополнение счёта',
    accountName: accountName ? cleanAccountName(accountName, text) : extractMarkedName(text),
  };
}

export function compileNaturalBatch(text: string): AIParsedCommand | null {
  const normalized = normalizeText(text);

  if (/(удали|удалить|delete|remove).*(все|all).*(счета|счёта|accounts)/i.test(normalized)) {
    return { intent: 'delete_all_accounts', scope: 'all' };
  }

  if (/(очисти|очистить|clear|wipe).*(истори|history|операц|transactions)/i.test(normalized)) {
    return { intent: 'clear_history', scope: 'all_transactions' };
  }

  const createAccount = compileNaturalCreateAccount(text);
  if (createAccount) return repairParsedCommand(createAccount, text);

  const topUp = compileNaturalTopUp(text);
  if (topUp && 'accountName' in topUp && topUp.accountName) return repairParsedCommand(topUp, text);

  return null;
}

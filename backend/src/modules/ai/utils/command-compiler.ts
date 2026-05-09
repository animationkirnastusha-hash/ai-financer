import type { AIParsedAtomicCommand, AIParsedCommand } from '../types';
import {
  CurrencyCode,
  extractAmountCandidates,
  extractAmountFromText,
  extractCurrencyFromText,
  normalizeAmount,
  stripAmountFromText,
} from './amount-normalizer';

const CREATE_ACCOUNT_RE = /(?:создай|создать|открой|открыть|заведи|завести|create|open|add)\s+(?:счет|счёт|аккаунт|кошелек|кошел[её]к|карту|карту\s+счет|account|wallet)/i;
const ACCOUNT_WORDS_RE = /(?:счет|счёт|аккаунт|кошелек|кошел[её]к|карта|карту|account|wallet)/i;
const TOP_UP_RE = /(?:положи|положить|закинь|закинуть|кинь|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить|депозит|присвой|присвоить|deposit|top\s*up|put|add|assign|nạp|nap)/i;
const TRANSFER_RE = /(?:переведи|перевести|перекинь|перекинуть|перевод|transfer|move)/i;
const CREATE_SECTION_RE = /(?:создай|создать|добавь|добавить)\s+(?:раздел|папку|section)/i;
const CREATE_CATEGORY_RE = /(?:создай|создать|добавь|добавить)\s+(?:категори[юя]|category)/i;
const ASSIGN_SECTION_RE = /(?:запиши|перенеси|отнеси|помести|перемести|назначь|assign|move)\s+(?:все\s+)?(?:расходы|траты|операции|transactions)?/i;

const ACCOUNT_TYPE_RE = /\b(?:карта|карту|card|наличные|наличка|наличными|cash|кошелек|кошел[её]к|wallet|накопительный|накопления|сбережения|savings?|инвест|investment)\b/gi;
const CURRENCY_RE = /(?:₽|руб(?:ль|ля|лей|ли|лях)?|рубли|рублей|rub|ruble?s?|rouble?s?|\$|usd|доллар(?:а|ов|ах)?|бакс(?:а|ов|ах)?|dollars?|bucks?|€|eur|евро|euro?s?|₫|vnd|донг(?:а|ов|ах)?|dong|đồng)/gi;
const NAME_MARKER_RE = /(?:с\s+названием|под\s+названием|назови(?:\s+его|\s+ее|\s+её)?|назвать(?:\s+его|\s+ее|\s+её)?|дай(?:\s+ему|\s+ей)?\s+название|имя|name(?:\s+it)?|called)/i;
const CONNECTOR_SPLIT_RE = /\s*(?:,|;|\.|\n|\s+и\s+|\s+а\s+|\s+потом\s+|\s+затем\s+|\s+следом\s+|\s+после\s+этого\s+|\s+then\s+|\s+and\s+)\s*/gi;

const CURRENCY_RATES_TO_RUB: Record<CurrencyCode, number> = {
  RUB: 1,
  USD: 100,
  EUR: 110,
  VND: 0.004,
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function cleanTail(value: string) {
  return value
    .replace(/^[\s"'«»]+|[\s"'«»]+$/g, '')
    .replace(/[.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeAmounts(value: string) {
  let result = value;
  for (const candidate of [...extractAmountCandidates(value)].sort((a, b) => b.index - a.index)) {
    result = `${result.slice(0, candidate.index)} ${result.slice(candidate.endIndex)}`;
  }
  return result.replace(/\s+/g, ' ').trim();
}

function stripSystemWordsFromName(value: string) {
  return cleanTail(
    removeAmounts(value)
      .replace(NAME_MARKER_RE, ' ')
      .replace(/\b(?:счет|счёт|аккаунт|кошелек|кошел[её]к|карта|карту|account|wallet)\b/gi, ' ')
      .replace(/\b(?:создай|создать|открой|открыть|заведи|завести|create|open|add)\b/gi, ' ')
      .replace(/\b(?:и|а|потом|затем|следом|then|and|туда|сюда|ему|ей|на|в|во|с|со|из|к|для|под|названием|название|имя|его|ее|её|it|there)\b/gi, ' ')
      .replace(TOP_UP_RE, ' ')
      .replace(ACCOUNT_TYPE_RE, ' ')
      .replace(CURRENCY_RE, ' ')
      .replace(/[₽$€₫]/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

export function cleanAccountName(raw: unknown, originalText = ''): string {
  const source = String(raw ?? '').trim() || extractAccountNameFromText(originalText) || '';
  const cleaned = stripSystemWordsFromName(source);
  return cleaned || 'Новый счёт';
}

function extractNameByMarker(text: string): string | undefined {
  const match = text.match(/(?:с\s+названием|под\s+названием|назови(?:\s+его|\s+ее|\s+её)?|назвать(?:\s+его|\s+ее|\s+её)?|дай(?:\s+ему|\s+ей)?\s+название|имя|name(?:\s+it)?|called)\s+["«]?(.+?)["»]?(?=\s*(?:,|;|\.|$|\s+(?:и|а|потом|затем|следом|then|and)\s+(?:положи|закинь|внеси|пополни|добавь|депозит|присвой|создай|открой)))/i);
  const cleaned = match?.[1] ? stripSystemWordsFromName(match[1]) : '';
  return cleaned || undefined;
}

function extractNameAfterAccountWord(text: string): string | undefined {
  const match = text.match(/(?:счет|счёт|аккаунт|кошелек|кошел[её]к|карту|account|wallet)\s+(.+?)(?=$|,|;|\.|\s+(?:и|а|потом|затем|следом|then|and)\s+(?:положи|закинь|внеси|пополни|добавь|депозит|присвой|создай|открой)|\s+(?:положи|закинь|внеси|пополни|добавь|депозит|присвой))/i);
  if (!match?.[1]) return undefined;

  const cleaned = stripSystemWordsFromName(match[1]);
  if (!cleaned) return undefined;
  if (/^(карта|card|cash|наличка|наличные|кошелек|wallet)$/i.test(cleaned)) return undefined;
  return cleaned;
}

export function extractAccountNameFromText(text: string): string | undefined {
  return extractNameByMarker(text) || extractNameAfterAccountWord(text);
}

export function inferAccountType(text: string, explicit?: unknown): string {
  const source = normalizeText(`${String(explicit ?? '')} ${text}`);
  if (/\b(card|карта|карту)\b/.test(source)) return 'card';
  if (/\b(saving|savings|накоп|копил|сбереж)\b/.test(source)) return 'savings';
  if (/\b(invest|investment|инвест)\b/.test(source)) return 'investment';
  if (/\b(cash|налич|кэш|кошелек|кошелёк|кошелек|wallet)\b/.test(source)) return 'cash';
  return 'cash';
}

export function inferCurrency(text: string, explicit?: unknown, fallback: CurrencyCode = 'RUB'): CurrencyCode {
  const explicitText = String(explicit ?? '').trim();
  if (explicitText) return extractCurrencyFromText(explicitText, fallback) ?? fallback;
  return extractCurrencyFromText(text, fallback) ?? fallback;
}

export function inferTransactionType(text: string, explicit?: unknown): 'income' | 'expense' {
  const source = normalizeText(`${String(explicit ?? '')} ${text}`);
  if (/(?:доход|зарплат|аванс|получил|получила|пришло|пришла|зачислили|пополн|депозит|положи|закинь|добавь|внеси|присвой|income|salary|deposit|received|top\s*up)/i.test(source)) return 'income';
  return 'expense';
}

function convertAmount(amount: number, from: CurrencyCode | undefined, to: CurrencyCode) {
  if (!from || from === to) return amount;
  const rub = amount * CURRENCY_RATES_TO_RUB[from];
  return Math.round((rub / CURRENCY_RATES_TO_RUB[to]) * 100) / 100;
}

function getTopUpSegment(text: string): string | undefined {
  const match = text.match(/(?:положи|положить|закинь|закинуть|кинь|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить|депозит|присвой|присвоить|deposit|top\s*up|put|add|assign)\s+(?:туда|сюда|ему|ей|на\s+(?:него|нее|неё|счет|счёт|карту|кошелек|кошелёк))?\s*(.+)$/i);
  return match?.[1]?.trim();
}

function splitCreateAccountClauses(text: string) {
  const starts: number[] = [];
  const pattern = /(?:создай|создать|открой|открыть|заведи|завести|create|open|add)\s+(?:счет|счёт|аккаунт|кошелек|кошел[её]к|карту|account|wallet)/gi;
  for (const match of text.matchAll(pattern)) if (typeof match.index === 'number') starts.push(match.index);
  if (starts.length <= 1) return [text.trim()];
  return starts.map((start, index) => text.slice(start, starts[index + 1] ?? text.length).replace(/^(?:и|а|потом|затем|следом|then|and)\s+/i, '').trim());
}

function compileCreateAccountClause(clause: string): AIParsedAtomicCommand[] {
  const beforeTopUp = clause.replace(/(?:положи|положить|закинь|закинуть|кинь|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить|депозит|присвой|присвоить|deposit|top\s*up|put|add|assign)[\s\S]*$/i, '').trim();
  const accountCurrency = inferCurrency(beforeTopUp || clause);
  const name = cleanAccountName(extractAccountNameFromText(beforeTopUp || clause), beforeTopUp || clause);
  const type = inferAccountType(beforeTopUp || clause);
  const topUpSegment = getTopUpSegment(clause);
  const amountCandidate = topUpSegment ? extractAmountCandidates(topUpSegment)[0] : undefined;

  const createAccount: AIParsedAtomicCommand = {
    intent: 'create_account',
    name,
    type,
    currency: accountCurrency,
    balance: 0,
  };

  if (!topUpSegment || !amountCandidate) return [createAccount];

  const moneyCurrency = amountCandidate.currency ?? accountCurrency;
  return [
    createAccount,
    {
      intent: 'income',
      amount: convertAmount(amountCandidate.amount, moneyCurrency, accountCurrency),
      currency: accountCurrency,
      rawCategory: /депозит|deposit/i.test(clause) ? 'депозит' : 'пополнение',
      description: /депозит|deposit/i.test(clause) ? 'депозит' : 'пополнение счёта',
      accountName: name,
    } as AIParsedAtomicCommand,
  ];
}

export function compileNaturalCreateAccount(text: string): AIParsedCommand | null {
  if (!CREATE_ACCOUNT_RE.test(text)) return null;

  const actions = splitCreateAccountClauses(text).flatMap(compileCreateAccountClause);
  if (actions.length === 0) return null;
  if (actions.length === 1) return actions[0];
  return { intent: 'batch', originalText: text, actions };
}

function accountNameFromTopUp(text: string): string | undefined {
  const patterns = [
    /(?:на|в)\s+(?:счет|счёт|аккаунт|карту|кошелек|кошел[её]к)?\s*["«]?(.+?)["»]?\s+(?:положи|закинь|внеси|пополни|добавь|депозит|присвой)/i,
    /(?:положи|положить|закинь|закинуть|кинь|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить|депозит|присвой|присвоить)\s+(?:на|в)?\s*(?:счет|счёт|аккаунт|карту|кошелек|кошел[её]к)?\s*["«]?(.+?)["»]?\s+\d/i,
    /(?:положи|положить|закинь|закинуть|кинь|внеси|внести|пополни|пополнить|добавь|добавить|зачисли|зачислить|депозит|присвой|присвоить)\s+.+?\s+(?:на|в)\s+(?:счет|счёт|аккаунт|карту|кошелек|кошел[её]к)?\s*["«]?(.+?)["»]?$/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanAccountName(match[1], text);
      if (cleaned !== 'Новый счёт') return cleaned;
    }
  }
  return undefined;
}

export function compileNaturalTopUp(text: string, accountName?: string, currency?: CurrencyCode): AIParsedAtomicCommand | null {
  if (!TOP_UP_RE.test(text)) return null;
  const amountCandidate = extractAmountCandidates(text)[0];
  if (!amountCandidate) return null;
  const resolvedAccount = accountName ? cleanAccountName(accountName, text) : accountNameFromTopUp(text);
  const resolvedCurrency = amountCandidate.currency ?? currency ?? inferCurrency(text);

  return {
    intent: 'income',
    amount: amountCandidate.amount,
    currency: resolvedCurrency,
    rawCategory: /депозит|deposit/i.test(text) ? 'депозит' : 'пополнение',
    description: /депозит|deposit/i.test(text) ? 'депозит' : 'пополнение счёта',
    accountName: resolvedAccount,
  } as AIParsedAtomicCommand;
}

export function compileNaturalTransfer(text: string): AIParsedAtomicCommand | null {
  if (!TRANSFER_RE.test(text)) return null;
  const candidate = extractAmountCandidates(text)[0];
  if (!candidate) return null;
  const from = text.match(/(?:с|со|из|from)\s+(?:счета|счёта|счет|счёт|карты|карту|кошелька|account|wallet)?\s*["«]?(.+?)["»]?\s+(?:на|в|to)\s/i)?.[1];
  const to = text.match(/(?:на|в|to)\s+(?:счет|счёт|карту|кошелек|кошел[её]к|account|wallet)?\s*["«]?(.+?)["»]?$/i)?.[1];
  if (!to) return null;
  return {
    intent: 'transfer',
    amount: candidate.amount,
    fromAccountName: from ? cleanAccountName(from, text) : undefined,
    toAccountName: cleanAccountName(to, text),
  };
}

export function compileNaturalTaxonomy(text: string): AIParsedCommand | null {
  if (CREATE_SECTION_RE.test(text)) {
    const name = text.replace(CREATE_SECTION_RE, ' ').trim();
    return { intent: 'create_section', name: cleanTail(name) || 'Новый раздел' };
  }
  if (CREATE_CATEGORY_RE.test(text)) {
    const sectionName = text.match(/(?:в|к|для)\s+раздел\s+["«]?(.+?)["»]?$/i)?.[1];
    const name = text.replace(CREATE_CATEGORY_RE, ' ').replace(/(?:в|к|для)\s+раздел\s+.+$/i, ' ').trim();
    return { intent: 'create_category', name: cleanTail(name) || 'Новая категория', type: inferTransactionType(text), sectionName: sectionName ? cleanTail(sectionName) : undefined };
  }
  const assign = text.match(/(?:запиши|перенеси|отнеси|помести|перемести|назначь|assign|move)\s+(?:все\s+)?(?:расходы|траты|операции|transactions)?\s*(?:по|на|из|с)?\s+(.+?)\s+(?:в|к|для)\s+раздел\s+["«]?(.+?)["»]?$/i);
  if (assign) return { intent: 'assign_expenses_to_section', rawQuery: cleanTail(assign[1]), sectionName: cleanTail(assign[2]) };
  return null;
}

export function compileNaturalTransaction(text: string): AIParsedAtomicCommand | null {
  const candidate = extractAmountCandidates(text)[0];
  if (!candidate) return null;
  const type = inferTransactionType(text);
  const sectionName = text.match(/(?:в|к|для)\s+раздел\s+["«]?(.+?)["»]?$/i)?.[1];
  const accountName = type === 'income'
    ? accountNameFromTopUp(text)
    : text.match(/(?:с|со|из)\s+(?:счета|счёта|карты|кошелька)?\s*["«]?(.+?)["»]?$/i)?.[1];
  const rawCategory = stripAmountFromText(text)
    .replace(/(?:в|к|для)\s+раздел\s+.+$/i, ' ')
    .replace(TOP_UP_RE, ' ')
    .replace(/\b(?:доход|расход|трата|покупка|оплата|купил|купила|потратил|потратила|получил|получила|пришло|пришла|на|с|со|из|в|к|для)\b/gi, ' ')
    .replace(CURRENCY_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    intent: type,
    amount: candidate.amount,
    currency: candidate.currency,
    rawCategory: rawCategory || (type === 'income' ? 'доход' : 'расход'),
    description: rawCategory || (type === 'income' ? 'доход' : 'расход'),
    accountName: accountName ? cleanAccountName(accountName, text) : undefined,
    sectionName: sectionName ? cleanTail(sectionName) : undefined,
  } as AIParsedAtomicCommand;
}

export function compileNaturalCommand(text: string): AIParsedCommand | null {
  const input = text.trim();
  if (!input) return null;

  const createAccount = compileNaturalCreateAccount(input);
  if (createAccount) return createAccount;

  const transfer = compileNaturalTransfer(input);
  if (transfer) return transfer;

  const taxonomy = compileNaturalTaxonomy(input);
  if (taxonomy) return taxonomy;

  const topUp = compileNaturalTopUp(input);
  if (topUp && (topUp.intent === 'income' || topUp.intent === 'expense') && (topUp.accountName || /(?:пополн|полож|закин|внес|депозит|присвой)/i.test(input))) return topUp;

  return compileNaturalTransaction(input);
}

export function compileNaturalBatch(text: string): AIParsedCommand | null {
  const createAccount = compileNaturalCreateAccount(text);
  if (createAccount) return createAccount;

  const parts = text.split(CONNECTOR_SPLIT_RE).map((part) => part.trim()).filter((part) => part.length >= 2);
  if (parts.length < 2) return compileNaturalCommand(text);

  const actions: AIParsedAtomicCommand[] = [];
  let lastAccountName: string | undefined;
  let lastAccountCurrency: CurrencyCode | undefined;

  for (const part of parts) {
    const expanded = lastAccountName ? part.replace(/\b(?:туда|сюда|на него|на нее|на неё|ему|ей|there|to it)\b/gi, `на счет ${lastAccountName}`) : part;
    const parsed = compileNaturalCommand(expanded);
    if (!parsed) continue;

    if (parsed.intent === 'batch') {
      for (const action of parsed.actions) {
        actions.push(action);
        if (action.intent === 'create_account') {
          lastAccountName = action.name;
          lastAccountCurrency = inferCurrency('', action.currency as CurrencyCode, 'RUB');
        }
      }
      continue;
    }

    const action = parsed as AIParsedAtomicCommand;
    if ((action.intent === 'income' || action.intent === 'expense') && !action.accountName && lastAccountName) action.accountName = lastAccountName;
    if ((action.intent === 'income' || action.intent === 'expense') && !(action as any).currency && lastAccountCurrency) (action as any).currency = lastAccountCurrency;
    if (action.intent === 'create_account') {
      lastAccountName = action.name;
      lastAccountCurrency = inferCurrency('', action.currency as CurrencyCode, 'RUB');
    }
    actions.push(action);
  }

  if (actions.length === 0) return null;
  if (actions.length === 1) return actions[0];
  return { intent: 'batch', originalText: text, actions };
}

export function repairParsedCommand(command: AIParsedCommand, originalText = ''): AIParsedCommand {
  const text = originalText || ('originalText' in command ? command.originalText ?? '' : '');
  const compiled = text ? compileNaturalBatch(text) : null;
  if (compiled && (command.intent === 'batch' || command.intent === 'create_account' || command.intent === 'income' || command.intent === 'expense' || command.intent === 'transfer')) return compiled;

  if (command.intent === 'batch') {
    let lastAccountName: string | undefined;
    let lastAccountCurrency: CurrencyCode | undefined;
    return {
      ...command,
      actions: command.actions.map((item) => {
        const repaired = repairParsedCommand(item, text) as AIParsedAtomicCommand;
        if (repaired.intent === 'create_account') {
          lastAccountName = repaired.name;
          lastAccountCurrency = inferCurrency('', repaired.currency as CurrencyCode, 'RUB');
        }
        if ((repaired.intent === 'income' || repaired.intent === 'expense') && !repaired.accountName && lastAccountName) repaired.accountName = lastAccountName;
        if ((repaired.intent === 'income' || repaired.intent === 'expense') && !(repaired as any).currency && lastAccountCurrency) (repaired as any).currency = lastAccountCurrency;
        return repaired;
      }),
    };
  }

  if (command.intent === 'create_account') {
    return { ...command, name: cleanAccountName(command.name, text), type: inferAccountType(text, command.type), currency: inferCurrency(text, command.currency), balance: normalizeAmount(command.balance) ?? 0 };
  }

  if (command.intent === 'income' || command.intent === 'expense') {
    const amount = normalizeAmount(command.amount) ?? extractAmountFromText(text) ?? command.amount;
    return { ...command, amount, accountName: command.accountName ? cleanAccountName(command.accountName, text) : command.accountName };
  }

  if (command.intent === 'transfer') {
    return { ...command, amount: normalizeAmount(command.amount) ?? extractAmountFromText(text) ?? command.amount, fromAccountName: command.fromAccountName ? cleanAccountName(command.fromAccountName, text) : undefined, toAccountName: cleanAccountName(command.toAccountName, text) };
  }

  return command;
}

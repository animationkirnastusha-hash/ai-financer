import type {
  AIAccountType,
  AICurrency,
  AIParsedAtomicCommand,
  AIParsedCommand,
} from '../types';
import { detectCurrency, extractAmountCandidates, normalizeAmount, stripAmountFromText } from './amount-normalizer';

const ACCOUNT_TYPES: AIAccountType[] = ['cash', 'card', 'savings', 'investment'];
const CURRENCIES: AICurrency[] = ['RUB', 'USD', 'EUR', 'VND'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function compact(value: string): string {
  return value
    .replace(/[«»“”]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,\.\-–—]+|[\s:;,\.\-–—]+$/g, '')
    .trim();
}

const nameMarkers = [
  'с названием',
  'под названием',
  'название',
  'назови его',
  'назови ее',
  'назови её',
  'назвать',
  'name it',
  'called',
  'named',
  'tên là',
  'gọi là',
];

const actionBoundary = /\b(?:и\s+)?(?:положи|пополн|закинь|закинуть|добавь|добавить|внеси|внести|депозит|присвой|переведи|перевести|запиши|записать|создай|создать|удали|удалить|потрать|расход|доход|top\s*up|deposit|add|put|transfer|send|delete|remove|ghi|chuyển|nạp|thêm)\b/iu;
const accountWords = /\b(?:счет|счёт|счета|счёта|аккаунт|account|wallet|кошелек|кошелёк)\b/giu;
const typeWords = /\b(?:cash|наличные|наличка|карта|карту|карты|card|bank|banking|безналичный|безналичная|безнал|банковский|банковская|savings?|накопительный|накопления|копилка|investment|invest|инвестиционный|инвестиции)\b/giu;
const currencyWords = /(?:₽|rub|руб(?:ль|ля|лей|ли|лях)?|рубли|рублей|р\.?\b|ruble?s?|rouble?s?|\$|usd|usdt|доллар(?:а|ов|ах)?|бакс(?:а|ов|ах)?|dollars?|bucks?|€|eur|евро|euro?s?|₫|vnd|донг(?:а|ов|ах)?|dong|đồng)/giu;

export function cleanName(value: unknown, fallback = ''): string {
  let name = compact(asString(value, fallback));
  if (!name) return fallback;

  const lower = name.toLowerCase().replace(/ё/g, 'е');
  const marker = nameMarkers.find((item) => lower.includes(item));
  if (marker) {
    const index = lower.indexOf(marker);
    name = name.slice(index + marker.length).trim();
  }

  return compact(name) || fallback;
}

export function cleanAccountName(value: unknown, originalText = ''): string {
  let source = asString(value);

  if ((!source || source.length < 2) && originalText) source = originalText;

  source = compact(source);
  if (!source) return 'Новый счёт';

  const lowered = source.toLowerCase().replace(/ё/g, 'е');
  const marker = nameMarkers.find((item) => lowered.includes(item));
  if (marker) {
    const index = lowered.indexOf(marker);
    source = source.slice(index + marker.length).trim();
  }

  source = stripAmountFromText(source)
    .replace(accountWords, ' ')
    .replace(typeWords, ' ')
    .replace(currencyWords, ' ')
    .replace(actionBoundary, ' ')
    .replace(/\b(?:и|а|на|в|во|для|его|ее|её|туда|there|to|with|as|là|vào)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return compact(source) || 'Новый счёт';
}

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  const raw = asString(value).toUpperCase();
  if (CURRENCIES.includes(raw as AICurrency)) return raw as AICurrency;
  return detectCurrency(raw, fallback);
}

export function inferCurrency(text: string, value?: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  if (value !== undefined && value !== null && String(value).trim()) return normalizeCurrency(value, fallback);
  return detectCurrency(text, fallback);
}

export function normalizeAccountType(value: unknown, fallback: AIAccountType = 'cash'): AIAccountType {
  const raw = asString(value).toLowerCase().replace(/ё/g, 'е');
  if (ACCOUNT_TYPES.includes(raw as AIAccountType)) return raw as AIAccountType;

  const aliases: Record<string, AIAccountType> = {
    bank: 'card', banking: 'card', card: 'card', cashless: 'card', debit: 'card', virtual: 'card',
    безнал: 'card', безналичный: 'card', безналичная: 'card', банковский: 'card', банковская: 'card', карта: 'card', карточный: 'card', электронный: 'card',
    наличные: 'cash', наличка: 'cash', cash: 'cash', wallet: 'cash', кошелек: 'cash', кошелёк: 'cash',
    savings: 'savings', saving: 'savings', накопительный: 'savings', накопления: 'savings', копилка: 'savings',
    investment: 'investment', invest: 'investment', инвестиционный: 'investment', инвестиции: 'investment',
  };

  return aliases[raw] ?? fallback;
}

export function inferAccountType(text: string, value?: unknown): AIAccountType {
  const raw = `${asString(value)} ${text}`.toLowerCase().replace(/ё/g, 'е');
  if (/(?:безнал|банк|банковск|card|карта|карту|debit|virtual)/i.test(raw)) return 'card';
  if (/(?:накоп|сбереж|saving)/i.test(raw)) return 'savings';
  if (/(?:инвест|invest|broker|брокер)/i.test(raw)) return 'investment';
  if (/(?:налич|cash|wallet|кошелек|кошелёк)/i.test(raw)) return 'cash';
  return normalizeAccountType(value, 'cash');
}

export function normalizeTransactionType(value: unknown, fallback: 'income' | 'expense' = 'expense'): 'income' | 'expense' {
  const raw = asString(value).toLowerCase().replace(/ё/g, 'е');
  if (/^(income|доход|topup|top_up|deposit|пополнение|депозит)$/.test(raw)) return 'income';
  if (/^(expense|расход|spend|payment|покупка)$/.test(raw)) return 'expense';
  return fallback;
}

export function inferTransactionType(text: string, value?: unknown): 'income' | 'expense' {
  const raw = `${asString(value)} ${text}`.toLowerCase().replace(/ё/g, 'е');
  if (/(?:полож|пополн|закин|внес|депозит|присвой|зарплат|доход|преми|top\s*up|deposit|add money|put money|salary|income|nạp|thêm tiền)/i.test(raw)) return 'income';
  if (/(?:потрат|купил|купила|оплат|расход|spend|spent|buy|bought|paid|expense|mua|trả)/i.test(raw)) return 'expense';
  return normalizeTransactionType(value, 'expense');
}

export function normalizePositiveAmount(value: unknown): number | null {
  const normalized = normalizeAmount(value);
  if (normalized !== null && normalized > 0) return normalized;

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  return null;
}

function firstTextAmount(text: string): number | null {
  return extractAmountCandidates(text)[0]?.amount ?? null;
}

function sanitizeAtomic(command: AIParsedAtomicCommand, originalText = ''): AIParsedAtomicCommand {
  switch (command.intent) {
    case 'create_account':
      return {
        intent: 'create_account',
        name: cleanAccountName(command.name, originalText),
        type: inferAccountType(originalText, command.type),
        currency: inferCurrency(originalText, command.currency, 'RUB'),
        balance: normalizePositiveAmount(command.balance) ?? 0,
      };

    case 'update_account':
      return {
        intent: 'update_account',
        accountName: cleanAccountName(command.accountName, originalText),
        name: command.name ? cleanAccountName(command.name) : undefined,
        type: command.type ? inferAccountType(originalText, command.type) : undefined,
        currency: command.currency ? inferCurrency(originalText, command.currency) : undefined,
        balance: command.balance !== undefined ? normalizePositiveAmount(command.balance) ?? firstTextAmount(originalText) ?? undefined : undefined,
      };

    case 'delete_account':
      return {
        intent: 'delete_account',
        accountName: cleanAccountName(command.accountName, originalText),
      };

    case 'income':
      return {
        ...command,
        amount: normalizePositiveAmount(command.amount) ?? firstTextAmount(originalText) ?? command.amount,
        currency: command.currency ? inferCurrency(originalText, command.currency) : undefined,
        rawCategory: cleanName(command.rawCategory, 'пополнение'),
        description: command.description ? cleanName(command.description, command.rawCategory) : command.rawCategory,
        accountName: command.accountName ? cleanAccountName(command.accountName, originalText) : undefined,
        sectionName: command.sectionName ? cleanName(command.sectionName) : undefined,
      };

    case 'expense':
      return {
        ...command,
        amount: normalizePositiveAmount(command.amount) ?? firstTextAmount(originalText) ?? command.amount,
        currency: command.currency ? inferCurrency(originalText, command.currency) : undefined,
        rawCategory: cleanName(command.rawCategory, 'расход'),
        description: command.description ? cleanName(command.description, command.rawCategory) : command.rawCategory,
        accountName: command.accountName ? cleanAccountName(command.accountName, originalText) : undefined,
        sectionName: command.sectionName ? cleanName(command.sectionName) : undefined,
      };

    case 'transfer':
      return {
        ...command,
        amount: normalizePositiveAmount(command.amount) ?? firstTextAmount(originalText) ?? command.amount,
        currency: command.currency ? inferCurrency(originalText, command.currency) : undefined,
        fromAccountName: command.fromAccountName ? cleanAccountName(command.fromAccountName) : undefined,
        toAccountName: cleanAccountName(command.toAccountName),
        description: command.description ? cleanName(command.description) : undefined,
      };

    case 'create_category':
      return {
        ...command,
        name: cleanName(command.name, 'Новая категория'),
        type: command.type === 'income' ? 'income' : 'expense',
        sectionName: command.sectionName ? cleanName(command.sectionName) : undefined,
      };

    case 'create_section':
      return { intent: 'create_section', name: cleanName(command.name, 'Новый раздел') };

    case 'assign_expenses_to_section':
      return {
        intent: 'assign_expenses_to_section',
        rawQuery: cleanName(command.rawQuery),
        sectionName: cleanName(command.sectionName, 'Новый раздел'),
      };

    case 'clear_history':
      return {
        intent: 'clear_history',
        scope: command.scope === 'ai' || command.scope === 'all' ? command.scope : 'transactions',
      };

    default:
      return command;
  }
}

export function repairParsedCommand(command: AIParsedCommand, originalText = ''): AIParsedCommand {
  if (command.intent === 'batch') {
    const actions = command.actions
      .filter((action) => action.intent !== 'unknown' && action.intent !== 'help')
      .map((action) => sanitizeAtomic(action, originalText));

    if (actions.length === 1) return actions[0];

    return {
      ...command,
      actions,
    };
  }

  return sanitizeAtomic(command, originalText);
}

// Compatibility exports. These no longer parse user intent.
export function compileNaturalBatch(_input: string): AIParsedCommand | null { return null; }
export function compileNaturalCreateAccount(_input: string): AIParsedCommand | null { return null; }
export function compileNaturalTopUp(_input: string): AIParsedAtomicCommand | null { return null; }
export function maybeRecordToCommand(value: unknown): AIParsedCommand | null {
  if (!isRecord(value) || typeof value.intent !== 'string') return null;
  return value as unknown as AIParsedCommand;
}

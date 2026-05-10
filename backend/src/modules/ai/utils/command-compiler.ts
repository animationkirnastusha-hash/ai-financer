import type {
  AIAccountType,
  AICurrency,
  AIParsedAtomicCommand,
  AIParsedCommand,
} from '../types';
import { detectCurrency, normalizeAmount } from './amount-normalizer';

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
    .replace(/[_*`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,\.\-–—]+|[\s:;,\.\-–—]+$/g, '')
    .trim();
}

const NAME_MARKERS = [
  'с названием',
  'под названием',
  'название',
  'назови его',
  'назови ее',
  'назови её',
  'назови счет',
  'назови счёт',
  'name it',
  'called',
  'named',
  'with name',
  'tên là',
  'đặt tên',
];

const ACTION_BOUNDARIES = [
  ' и полож',
  ' и пополн',
  ' и добав',
  ' и закин',
  ' и внес',
  ' и присвой',
  ' потом ',
  ' затем ',
  ' следом ',
  ' and put',
  ' and add',
  ' and deposit',
  ' then ',
  ' sau đó ',
  ' rồi ',
];

function cutAtActionBoundary(value: string): string {
  const lower = value.toLowerCase();
  const positions = ACTION_BOUNDARIES
    .map((marker) => lower.indexOf(marker))
    .filter((index) => index >= 0);

  if (positions.length === 0) return value;
  return value.slice(0, Math.min(...positions));
}

function stripAmountAndCurrencyTail(value: string): string {
  return value
    .replace(/(?:^|\s)(?:\+|-)?\d+[\d\s.,]*(?:к|k|тыс\.?|тысяч[аи]?|thousand|nghìn|ngan|ngàn|млн|million|triệu)?(?:\s*(?:руб(?:лей|ля|ль)?|₽|rub|доллар(?:ов|а)?|бакс(?:ов|а)?|usd|\$|евро|eur|€|донг(?:ов)?|vnd|₫))?\s*$/iu, '')
    .replace(/\b(?:руб(?:лей|ля|ль)?|₽|rub|доллар(?:ов|а)?|бакс(?:ов|а)?|usd|евро|eur|донг(?:ов)?|vnd)\b\s*$/iu, '')
    .trim();
}

function stripAccountServiceWords(value: string): string {
  return value
    .replace(/\b(?:счет|счёт|счета|счёта|аккаунт|кошелек|кошелёк|wallet|account)\b/giu, ' ')
    .replace(/\b(?:создай|создать|добавь|добавить|открой|открыть|create|add|open|tạo)\b/giu, ' ')
    .replace(/\b(?:карту|карта|карты|card|наличка|наличные|cash|безналичный|безнал|bank|банковский)\b/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMarkedName(value: string): string | null {
  const lower = value.toLowerCase();
  for (const marker of NAME_MARKERS) {
    const index = lower.indexOf(marker);
    if (index < 0) continue;
    const after = value.slice(index + marker.length);
    const cleaned = stripAmountAndCurrencyTail(cutAtActionBoundary(after));
    return compact(cleaned) || null;
  }
  return null;
}

export function cleanName(value: unknown, fallback = ''): string {
  let name = compact(asString(value, fallback));
  const marked = extractMarkedName(name);
  if (marked) name = marked;
  name = stripAmountAndCurrencyTail(cutAtActionBoundary(name));
  return compact(name) || fallback;
}

export function cleanAccountName(value: unknown, fallback = 'Новый счёт'): string {
  let name = compact(asString(value, fallback));
  const marked = extractMarkedName(name);
  if (marked) return marked;

  name = cutAtActionBoundary(name);
  name = stripAmountAndCurrencyTail(name);
  name = stripAccountServiceWords(name);
  return compact(name) || fallback;
}

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  const raw = asString(value).toUpperCase();
  if (CURRENCIES.includes(raw as AICurrency)) return raw as AICurrency;
  return detectCurrency(raw, fallback);
}

export function inferCurrency(text: string, value?: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  const explicit = asString(value);
  if (explicit) return normalizeCurrency(explicit, fallback);
  return detectCurrency(text, fallback);
}

export function normalizeAccountType(value: unknown, fallback: AIAccountType = 'cash'): AIAccountType {
  const raw = asString(value).toLowerCase().replace(/ё/g, 'е');
  if (ACCOUNT_TYPES.includes(raw as AIAccountType)) return raw as AIAccountType;

  const aliases: Record<string, AIAccountType> = {
    bank: 'card', banking: 'card', card: 'card', cashless: 'card', debit: 'card', virtual: 'card',
    безнал: 'card', безналичный: 'card', банковский: 'card', карта: 'card', карточный: 'card', электронный: 'card',
    наличные: 'cash', наличка: 'cash', cash: 'cash', wallet: 'cash', кошелек: 'cash', кошелёк: 'cash',
    savings: 'savings', saving: 'savings', накопительный: 'savings', накопления: 'savings', копилка: 'savings',
    investment: 'investment', invest: 'investment', инвестиционный: 'investment', инвестиции: 'investment',
  };

  return aliases[raw] ?? fallback;
}

export function inferAccountType(text: string, value?: unknown): AIAccountType {
  const explicit = asString(value);
  if (explicit) return normalizeAccountType(explicit, 'cash');
  const normalized = text.toLowerCase().replace(/ё/g, 'е');
  if (/\b(?:карта|карту|card|банк|банковск|безнал|cashless|debit)\b/.test(normalized)) return 'card';
  if (/\b(?:накоп|saving|сбереж|копилка)\b/.test(normalized)) return 'savings';
  if (/\b(?:инвест|invest|broker|брокер)\b/.test(normalized)) return 'investment';
  if (/\b(?:налич|cash|кэш)\b/.test(normalized)) return 'cash';
  return 'cash';
}

export function normalizeTransactionType(value: unknown, fallback: 'income' | 'expense' = 'expense'): 'income' | 'expense' {
  const raw = asString(value).toLowerCase();
  if (raw === 'income' || raw === 'доход' || raw === 'deposit' || raw === 'topup') return 'income';
  if (raw === 'expense' || raw === 'расход') return 'expense';
  return fallback;
}

export function inferTransactionType(text: string, value?: unknown): 'income' | 'expense' {
  const explicit = asString(value);
  if (explicit) return normalizeTransactionType(explicit, 'expense');
  const normalized = text.toLowerCase().replace(/ё/g, 'е');
  if (/(?:пополн|полож|закин|внес|депозит|присвой|зарплат|доход|deposit|top\s?up|add money|salary|income|nạp|gửi tiền)/.test(normalized)) return 'income';
  return 'expense';
}

export function normalizePositiveAmount(value: unknown): number | null {
  const normalized = normalizeAmount(value);
  if (normalized !== null && normalized > 0) return normalized;

  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  return null;
}

function sanitizeAtomic(command: AIParsedAtomicCommand): AIParsedAtomicCommand {
  switch (command.intent) {
    case 'create_account':
      return {
        intent: 'create_account',
        name: cleanAccountName(command.name),
        type: normalizeAccountType(command.type),
        currency: normalizeCurrency(command.currency),
        balance: normalizePositiveAmount(command.balance) ?? 0,
      };

    case 'update_account':
      return {
        intent: 'update_account',
        accountName: cleanAccountName(command.accountName),
        name: command.name ? cleanAccountName(command.name) : undefined,
        type: command.type ? normalizeAccountType(command.type) : undefined,
        currency: command.currency ? normalizeCurrency(command.currency) : undefined,
        balance: command.balance !== undefined ? normalizePositiveAmount(command.balance) ?? 0 : undefined,
        showInTotalBalance: command.showInTotalBalance,
      };

    case 'delete_account':
      return { intent: 'delete_account', accountName: cleanAccountName(command.accountName) };

    case 'income':
      return {
        ...command,
        amount: normalizePositiveAmount(command.amount) ?? command.amount,
        currency: command.currency ? normalizeCurrency(command.currency) : undefined,
        rawCategory: cleanName(command.rawCategory, 'доход'),
        description: command.description ? cleanName(command.description, command.rawCategory) : command.rawCategory,
        accountName: command.accountName ? cleanAccountName(command.accountName) : undefined,
        sectionName: command.sectionName ? cleanName(command.sectionName) : undefined,
      };

    case 'expense':
      return {
        ...command,
        amount: normalizePositiveAmount(command.amount) ?? command.amount,
        currency: command.currency ? normalizeCurrency(command.currency) : undefined,
        rawCategory: cleanName(command.rawCategory, 'расход'),
        description: command.description ? cleanName(command.description, command.rawCategory) : command.rawCategory,
        accountName: command.accountName ? cleanAccountName(command.accountName) : undefined,
        sectionName: command.sectionName ? cleanName(command.sectionName) : undefined,
      };

    case 'transfer':
      return {
        ...command,
        amount: normalizePositiveAmount(command.amount) ?? command.amount,
        currency: command.currency ? normalizeCurrency(command.currency) : undefined,
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

export function repairParsedCommand(command: AIParsedCommand, _originalText = ''): AIParsedCommand {
  if (command.intent === 'batch') {
    const actions = command.actions
      .filter((action) => action.intent !== 'unknown' && action.intent !== 'help')
      .map((action) => sanitizeAtomic(action));

    if (actions.length === 1) return actions[0];
    return { ...command, actions };
  }
  return sanitizeAtomic(command);
}

// Compatibility exports. These no longer parse user intent.
export function compileNaturalBatch(_input: string): AIParsedCommand | null { return null; }
export function compileNaturalCreateAccount(_input: string): AIParsedCommand | null { return null; }
export function compileNaturalTopUp(_input: string): AIParsedAtomicCommand | null { return null; }
export function maybeRecordToCommand(value: unknown): AIParsedCommand | null {
  if (!isRecord(value) || typeof value.intent !== 'string') return null;
  return value as unknown as AIParsedCommand;
}

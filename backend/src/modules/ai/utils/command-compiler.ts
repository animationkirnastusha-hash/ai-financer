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
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,\.\-–—]+|[\s:;,\.\-–—]+$/g, '')
    .trim();
}

export function cleanName(value: unknown, fallback = ''): string {
  let name = compact(asString(value, fallback));

  // Low-level cleanup only. This is not intent parsing.
  const technicalPrefixes = [
    'с названием ',
    'под названием ',
    'название ',
    'назови его ',
    'назови ее ',
    'назови её ',
    'name it ',
    'called ',
    'named ',
  ];

  const lower = name.toLowerCase();
  const prefix = technicalPrefixes.find((item) => lower.startsWith(item));
  if (prefix) name = name.slice(prefix.length).trim();

  return compact(name) || fallback;
}

export function cleanAccountName(value: unknown, fallback = 'Новый счёт'): string {
  return cleanName(value, fallback) || fallback;
}

export function normalizeCurrency(value: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  const raw = asString(value).toUpperCase();
  if (CURRENCIES.includes(raw as AICurrency)) return raw as AICurrency;
  return detectCurrency(raw, fallback);
}

export function inferCurrency(_text: string, value?: unknown, fallback: AICurrency = 'RUB'): AICurrency {
  return normalizeCurrency(value, fallback);
}

export function normalizeAccountType(value: unknown, fallback: AIAccountType = 'cash'): AIAccountType {
  const raw = asString(value).toLowerCase();
  if (ACCOUNT_TYPES.includes(raw as AIAccountType)) return raw as AIAccountType;

  // Do not infer account type from user words here. The LLM must return a canonical enum.
  return fallback;
}

export function inferAccountType(_text: string, value?: unknown): AIAccountType {
  return normalizeAccountType(value, 'cash');
}

export function normalizeTransactionType(value: unknown, fallback: 'income' | 'expense' = 'expense'): 'income' | 'expense' {
  const raw = asString(value).toLowerCase();
  if (raw === 'income') return 'income';
  if (raw === 'expense') return 'expense';

  // Do not infer income/expense from natural words here. The LLM must decide.
  return fallback;
}

export function inferTransactionType(_text: string, value?: unknown): 'income' | 'expense' {
  return normalizeTransactionType(value, 'expense');
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

    if (actions.length === 1 && !command.premiumSuggestion) return actions[0];

    return {
      ...command,
      actions,
    };
  }

  return sanitizeAtomic(command);
}

// Compatibility exports. These intentionally do not parse user intent.
export function compileNaturalBatch(_input: string): AIParsedCommand | null {
  return null;
}

export function compileNaturalCreateAccount(_input: string): AIParsedCommand | null {
  return null;
}

export function compileNaturalTopUp(_input: string): AIParsedAtomicCommand | null {
  return null;
}

export function maybeRecordToCommand(value: unknown): AIParsedCommand | null {
  if (!isRecord(value) || typeof value.intent !== 'string') return null;
  return value as unknown as AIParsedCommand;
}

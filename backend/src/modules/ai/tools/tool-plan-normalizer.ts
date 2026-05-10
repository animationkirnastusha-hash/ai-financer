import { normalizeAmount } from '../utils/amount-normalizer';
import {
  cleanAccountName,
  cleanName,
  normalizeAccountType,
  normalizeCurrency,
  normalizePositiveAmount,
  normalizeTransactionType,
  repairParsedCommand,
} from '../utils/command-compiler';
import type {
  AIParsedAtomicCommand,
  AIParsedCommand,
} from '../types';
import type { AIToolCall, AIToolPlan } from './tool-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const normalized = asString(value);
  return normalized ? normalized : undefined;
}

function asAmount(value: unknown): number | null {
  return normalizePositiveAmount(value) ?? normalizeAmount(value);
}

function canonicalToolName(tool: unknown): string {
  const raw = asString(tool).toLowerCase();

  const aliases: Record<string, string> = {
    create_account: 'money.create_account',
    create_transaction: 'money.record_transaction',
    record_transaction: 'money.record_transaction',
    transfer_money: 'money.transfer',
    transfer: 'money.transfer',
    delete_all_accounts: 'money.delete_all_accounts',
    clear_history: 'history.clear',
    create_section: 'finance.create_section',
    create_category: 'finance.create_category',
    assign_section: 'finance.assign_expenses_to_section',
    assign_expenses_to_section: 'finance.assign_expenses_to_section',
    show_accounts: 'finance.show_accounts',
    show_stats: 'finance.show_stats',
    financial_planning: 'finance.plan',
    update_settings: 'settings.update',
    answer_advice: 'assistant.answer',
    repeat_last: 'assistant.repeat_last',
  };

  return aliases[raw] ?? raw;
}

function unknown(reason: string): AIParsedAtomicCommand {
  return { intent: 'unknown', reason };
}

function convertToolCall(call: AIToolCall): AIParsedAtomicCommand[] {
  const args = isRecord(call.args) ? call.args : {};
  const tool = canonicalToolName(call.tool);

  switch (tool) {
    case 'money.create_account': {
      const name = cleanAccountName(args.name || args.accountName);
      if (!name) return [unknown('account_name_required')];

      const currency = normalizeCurrency(args.currency, 'RUB');
      const initialBalance = asAmount(args.initialBalance ?? args.balance);
      const accountType = normalizeAccountType(args.type, 'cash');

      const createAccount: AIParsedAtomicCommand = {
        intent: 'create_account',
        name,
        type: accountType,
        currency,
        balance: 0,
      };

      if (!initialBalance) return [createAccount];

      return [
        createAccount,
        {
          intent: 'income',
          amount: initialBalance,
          currency,
          rawCategory: 'пополнение',
          description: 'пополнение счёта',
          accountName: name,
        },
      ];
    }

    case 'money.record_transaction': {
      const amount = asAmount(args.amount);
      if (!amount) return [unknown('amount_required')];

      const type = normalizeTransactionType(args.type, 'expense');
      const category = cleanName(args.category || args.rawCategory || args.description, type === 'income' ? 'доход' : 'расход');
      const accountName = asOptionalString(args.accountName || args.account)
        ? cleanAccountName(args.accountName || args.account)
        : undefined;

      const base = {
        amount,
        currency: args.currency ? normalizeCurrency(args.currency) : undefined,
        rawCategory: category,
        description: cleanName(args.description, category),
        accountName,
        sectionName: asOptionalString(args.sectionName) ? cleanName(args.sectionName) : undefined,
      };

      return [type === 'income' ? { intent: 'income', ...base } : { intent: 'expense', ...base }];
    }

    case 'money.transfer': {
      const amount = asAmount(args.amount);
      const toAccountName = cleanAccountName(args.toAccountName || args.to || args.targetAccountName, '');
      if (!amount) return [unknown('amount_required')];
      if (!toAccountName) return [unknown('target_account_required')];

      return [{
        intent: 'transfer',
        amount,
        currency: args.currency ? normalizeCurrency(args.currency) : undefined,
        fromAccountName: asOptionalString(args.fromAccountName || args.from || args.sourceAccountName)
          ? cleanAccountName(args.fromAccountName || args.from || args.sourceAccountName)
          : undefined,
        toAccountName,
        description: asOptionalString(args.description),
      }];
    }

    case 'money.delete_all_accounts':
      return [{ intent: 'delete_all_accounts', confirmScope: 'accounts' }];

    case 'history.clear': {
      const scope = asString(args.scope, 'transactions').toLowerCase();
      return [{ intent: 'clear_history', scope: scope === 'ai' || scope === 'all' ? scope : 'transactions' }];
    }

    case 'finance.create_section': {
      const name = cleanName(args.name || args.sectionName);
      return name ? [{ intent: 'create_section', name }] : [unknown('section_name_required')];
    }

    case 'finance.create_category': {
      const name = cleanName(args.name || args.category || args.rawCategory);
      if (!name) return [unknown('category_name_required')];
      return [{
        intent: 'create_category',
        name,
        type: normalizeTransactionType(args.type, 'expense'),
        sectionName: asOptionalString(args.sectionName) ? cleanName(args.sectionName) : undefined,
      }];
    }

    case 'finance.assign_expenses_to_section': {
      const rawQuery = cleanName(args.rawQuery || args.category || args.query || args.description);
      const sectionName = cleanName(args.sectionName || args.name);
      return rawQuery && sectionName
        ? [{ intent: 'assign_expenses_to_section', rawQuery, sectionName }]
        : [unknown('query_or_section_required')];
    }

    case 'finance.show_accounts':
      return [{ intent: 'show_accounts' }];

    case 'finance.show_stats':
      return [{
        intent: 'stats',
        type: normalizeTransactionType(args.type, 'expense'),
        rawCategory: asOptionalString(args.category || args.rawCategory) ? cleanName(args.category || args.rawCategory) : undefined,
      }];

    case 'finance.plan':
      return [{
        intent: 'financial_planning',
        monthlyIncome: asAmount(args.monthlyIncome) ?? undefined,
        monthlyExpenses: asAmount(args.monthlyExpenses) ?? undefined,
        targetAmount: asAmount(args.targetAmount) ?? undefined,
        targetDateText: asOptionalString(args.targetDateText),
        question: asString(args.question || args.description, ''),
      }];

    case 'settings.update':
      return [{
        intent: 'update_settings',
        key: asString(args.key),
        value: args.value,
      }];

    case 'assistant.answer':
      return [{ intent: 'advice', question: asString(args.question || args.description, '') }];

    case 'assistant.repeat_last':
      return [{ intent: 'repeat_last' }];

    default:
      return [unknown(`unsupported_tool:${tool}`)];
  }
}

export function looksLikeToolPlan(value: unknown): value is AIToolPlan {
  return isRecord(value) && Array.isArray(value.toolCalls);
}

export function normalizeToolPlanToParsedCommand(value: unknown): AIParsedCommand | null {
  if (!looksLikeToolPlan(value)) return null;

  const actions = value.toolCalls
    .filter((item: unknown): item is AIToolCall => isRecord(item) && typeof item.tool === 'string')
    .flatMap((item: AIToolCall) => convertToolCall(item));

  const executableActions = actions.filter((item) => item.intent !== 'unknown' && item.intent !== 'help');

  if (executableActions.length === 0) {
    const question = asString(value.userMessage || 'Уточни, пожалуйста, чего не хватает: сумму, счёт или название.');
    return { intent: 'advice', question };
  }

  if (executableActions.length === 1 && !value.premiumSuggestion) {
    return repairParsedCommand(executableActions[0]);
  }

  return repairParsedCommand({
    intent: 'batch',
    actions: executableActions,
    originalText: asOptionalString(value.originalText),
    summary: asOptionalString(value.userMessage),
    premiumSuggestion: asOptionalString(value.premiumSuggestion),
  });
}

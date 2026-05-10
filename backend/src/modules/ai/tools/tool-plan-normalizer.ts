import { normalizeAmount } from '../utils/amount-normalizer';
import {
  cleanAccountName,
  cleanName,
  inferAccountType,
  inferCurrency,
  inferTransactionType,
  normalizePositiveAmount,
  repairParsedCommand,
} from '../utils/command-compiler';
import type { AIParsedCommand, AIParsedAtomicCommand } from '../types';
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
  const map: Record<string, string> = {
    create_account: 'money.create_account',
    update_account: 'money.update_account',
    delete_account: 'money.delete_account',
    create_transaction: 'money.record_transaction',
    transfer_money: 'money.transfer',
    delete_all_accounts: 'money.delete_all_accounts',
    clear_history: 'history.clear',
    create_section: 'finance.create_section',
    create_category: 'finance.create_category',
    assign_expenses_to_section: 'finance.assign_expenses_to_section',
    show_accounts: 'finance.show_accounts',
    show_stats: 'finance.show_stats',
    financial_planning: 'finance.plan',
    answer_advice: 'assistant.answer',
    repeat_last: 'assistant.repeat_last',
  };
  return map[raw] ?? raw;
}

function convertToolCall(call: AIToolCall, originalText = '', lastAccountName?: string): { actions: AIParsedAtomicCommand[]; lastAccountName?: string } {
  const args = isRecord(call.args) ? call.args : {};
  const tool = canonicalToolName(call.tool);

  switch (tool) {
    case 'money.create_account': {
      const name = cleanAccountName(args.name || args.accountName, originalText);
      const initialBalance = asAmount(args.initialBalance ?? args.balance);
      const currency = inferCurrency(originalText, args.currency);
      const createAccount: AIParsedAtomicCommand = {
        intent: 'create_account',
        name,
        type: inferAccountType(originalText, args.type),
        currency,
        balance: 0,
      };

      if (!initialBalance) return { actions: [createAccount], lastAccountName: name };

      return {
        actions: [
          createAccount,
          {
            intent: 'income',
            amount: initialBalance,
            currency: args.currency ? inferCurrency(originalText, args.currency) : currency,
            rawCategory: 'пополнение',
            description: 'пополнение счёта',
            accountName: name,
          },
        ],
        lastAccountName: name,
      };
    }

    case 'money.update_account': {
      const accountName = cleanAccountName(args.accountName || args.account || args.name, originalText);
      const nextName = args.newName || args.renameTo || args.title;
      return {
        actions: [repairParsedCommand({
          intent: 'update_account',
          accountName,
          name: nextName ? cleanAccountName(nextName) : undefined,
          type: args.type ? inferAccountType(originalText, args.type) : undefined,
          currency: args.currency ? inferCurrency(originalText, args.currency) : undefined,
          balance: args.balance !== undefined ? asAmount(args.balance) ?? undefined : undefined,
        }, originalText) as AIParsedAtomicCommand],
        lastAccountName: accountName,
      };
    }

    case 'money.delete_account': {
      const accountName = cleanAccountName(args.accountName || args.account || args.name, originalText);
      return { actions: [{ intent: 'delete_account', accountName }], lastAccountName: accountName };
    }

    case 'money.record_transaction': {
      const amount = asAmount(args.amount);
      if (!amount) return { actions: [{ intent: 'unknown', reason: 'amount_required' }] };

      const type = inferTransactionType(originalText, args.type);
      const category = cleanName(args.category || args.rawCategory || args.description, type === 'income' ? 'доход' : 'расход');
      const rawAccountName = args.accountName || args.account || args.toAccountName || lastAccountName;
      const accountName = asOptionalString(rawAccountName) ? cleanAccountName(rawAccountName, originalText) : undefined;

      const parsed: AIParsedAtomicCommand = type === 'income'
        ? {
            intent: 'income',
            amount,
            currency: args.currency ? inferCurrency(originalText, args.currency) : undefined,
            rawCategory: category,
            description: cleanName(args.description, category),
            accountName,
            sectionName: asOptionalString(args.sectionName) ? cleanName(args.sectionName) : undefined,
          }
        : {
            intent: 'expense',
            amount,
            currency: args.currency ? inferCurrency(originalText, args.currency) : undefined,
            rawCategory: category,
            description: cleanName(args.description, category),
            accountName,
            sectionName: asOptionalString(args.sectionName) ? cleanName(args.sectionName) : undefined,
          };

      return { actions: [repairParsedCommand(parsed, originalText) as AIParsedAtomicCommand], lastAccountName: accountName ?? lastAccountName };
    }

    case 'money.transfer': {
      const amount = asAmount(args.amount);
      const toAccountName = cleanAccountName(args.toAccountName || args.to || args.targetAccountName || lastAccountName, originalText);
      if (!amount || !toAccountName) return { actions: [{ intent: 'unknown', reason: !amount ? 'amount_required' : 'target_account_required' }] };

      return {
        actions: [repairParsedCommand({
          intent: 'transfer',
          amount,
          currency: args.currency ? inferCurrency(originalText, args.currency) : undefined,
          fromAccountName: asOptionalString(args.fromAccountName || args.from || args.sourceAccountName)
            ? cleanAccountName(args.fromAccountName || args.from || args.sourceAccountName)
            : undefined,
          toAccountName,
          description: asOptionalString(args.description),
        }, originalText) as AIParsedAtomicCommand],
        lastAccountName: toAccountName,
      };
    }

    case 'money.delete_all_accounts':
      return { actions: [{ intent: 'delete_all_accounts', confirmScope: 'accounts' }] };

    case 'history.clear': {
      const scope = asString(args.scope, 'transactions').toLowerCase();
      return { actions: [{ intent: 'clear_history', scope: scope === 'ai' || scope === 'all' ? scope : 'transactions' }] };
    }

    case 'finance.create_section': {
      const name = cleanName(args.name || args.sectionName);
      return { actions: name ? [{ intent: 'create_section', name }] : [{ intent: 'unknown', reason: 'section_name_required' }] };
    }

    case 'finance.create_category': {
      const name = cleanName(args.name || args.category || args.rawCategory);
      if (!name) return { actions: [{ intent: 'unknown', reason: 'category_name_required' }] };
      return { actions: [{ intent: 'create_category', name, type: inferTransactionType(originalText, args.type), sectionName: asOptionalString(args.sectionName) ? cleanName(args.sectionName) : undefined }] };
    }

    case 'finance.assign_expenses_to_section': {
      const rawQuery = cleanName(args.rawQuery || args.category || args.query || args.description);
      const sectionName = cleanName(args.sectionName || args.name);
      return { actions: rawQuery && sectionName ? [{ intent: 'assign_expenses_to_section', rawQuery, sectionName }] : [{ intent: 'unknown', reason: 'query_or_section_required' }] };
    }

    case 'finance.show_accounts':
      return { actions: [{ intent: 'show_accounts' }] };

    case 'finance.show_stats':
      return { actions: [{ intent: 'stats', type: inferTransactionType(originalText, args.type), rawCategory: asOptionalString(args.category || args.rawCategory) ? cleanName(args.category || args.rawCategory) : undefined }] };

    case 'finance.plan':
      return { actions: [{ intent: 'financial_planning', monthlyIncome: asAmount(args.monthlyIncome) ?? undefined, monthlyExpenses: asAmount(args.monthlyExpenses) ?? undefined, targetAmount: asAmount(args.targetAmount) ?? undefined, targetDateText: asOptionalString(args.targetDateText), question: asString(args.question || args.description, '') }] };

    case 'assistant.answer':
      return { actions: [{ intent: 'advice', question: asString(args.question || args.description, '') }] };

    case 'assistant.repeat_last':
      return { actions: [{ intent: 'repeat_last' }] };

    default:
      return { actions: [] };
  }
}

export function looksLikeToolPlan(value: unknown): value is AIToolPlan {
  return isRecord(value) && Array.isArray(value.toolCalls);
}

export function normalizeToolPlanToParsedCommand(value: unknown): AIParsedCommand | null {
  if (!looksLikeToolPlan(value)) return null;

  const originalText = asString(value.originalText);
  let lastAccountName: string | undefined;
  const actions: AIParsedAtomicCommand[] = [];

  for (const item of value.toolCalls) {
    if (!isRecord(item) || typeof item.tool !== 'string' || !isRecord(item.args ?? {})) continue;
    const converted = convertToolCall(item as AIToolCall, originalText, lastAccountName);
    actions.push(...converted.actions);
    if (converted.lastAccountName) lastAccountName = converted.lastAccountName;
  }

  const executableActions = actions.filter((item) => item.intent !== 'unknown' && item.intent !== 'help');

  if (executableActions.length === 0) {
    const question = asString(value.userMessage || 'Нужно уточнение, чтобы выполнить действие.');
    return { intent: 'advice', question };
  }

  if (executableActions.length === 1 && !value.premiumSuggestion) {
    return repairParsedCommand(executableActions[0], originalText);
  }

  return repairParsedCommand({
    intent: 'batch',
    actions: executableActions,
    originalText,
    premiumSuggestion: asOptionalString(value.premiumSuggestion),
  }, originalText);
}

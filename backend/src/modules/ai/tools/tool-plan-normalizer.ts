import { extractAmountFromText, normalizeAmount } from '../utils/amount-normalizer';
import {
  cleanAccountName,
  cleanEntityName,
  compileNaturalBatch,
  inferAccountType,
  inferCurrency,
  inferTransactionType,
  repairParsedCommand,
} from '../utils/command-compiler';
import type { AIParsedAtomicCommand, AIParsedCommand } from '../types';
import type { AIToolCall, AIToolName, AIToolPlan } from './tool-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asOptionalString(value: unknown): string | undefined {
  const valueAsString = asString(value);
  return valueAsString ? valueAsString : undefined;
}

function asAmount(value: unknown, text = ''): number | null {
  const normalized = normalizeAmount(value);
  if (normalized !== null && normalized > 0) return Math.round(normalized);
  const fromText = text ? extractAmountFromText(text) : null;
  return fromText && fromText > 0 ? Math.round(fromText) : null;
}

function normalizeToolName(tool: AIToolName): AIToolName {
  const map: Partial<Record<AIToolName, AIToolName>> = {
    create_account: 'money.create_account',
    create_transaction: 'money.record_transaction',
    transfer_money: 'money.transfer',
    delete_all_accounts: 'money.delete_all_accounts',
    clear_history: 'history.clear',
    create_category: 'taxonomy.create_category',
    create_section: 'taxonomy.create_section',
    assign_expenses_to_section: 'taxonomy.assign_expenses_to_section',
    show_accounts: 'report.show_accounts',
    show_stats: 'report.show_stats',
    financial_planning: 'planning.financial_plan',
    answer_advice: 'assistant.answer',
    repeat_last: 'assistant.repeat_last',
  };

  return map[tool] ?? tool;
}

function convertToolCall(call: AIToolCall, originalText = ''): AIParsedAtomicCommand[] {
  const tool = normalizeToolName(call.tool);
  const args = isRecord(call.args) ? call.args : {};
  const text = asString(args.originalText || args.text || originalText, originalText);

  switch (tool) {
    case 'money.create_account': {
      const name = cleanAccountName(args.name || args.accountName || args.title, text);
      const currency = inferCurrency(text, args.currency);
      const initialBalance = asAmount(args.initialBalance ?? args.balance, text);
      const account: AIParsedAtomicCommand = {
        intent: 'create_account',
        name,
        type: inferAccountType(text, args.type),
        currency,
        balance: 0,
      };

      if (!initialBalance) return [account];

      return [
        account,
        {
          intent: 'income',
          amount: initialBalance,
          currency: inferCurrency(text, args.currency, currency),
          rawCategory: 'пополнение',
          description: 'пополнение счёта',
          accountName: name,
        },
      ];
    }

    case 'money.record_transaction': {
      const amount = asAmount(args.amount, text);
      if (!amount) return [];

      const type = inferTransactionType(text, args.type);
      const category = cleanEntityName(args.category || args.rawCategory || args.description, type === 'income' ? 'доход' : 'расход');
      const base = {
        amount,
        currency: args.currency ? inferCurrency(text, args.currency) : inferCurrency(text),
        rawCategory: category,
        description: asString(args.description, category),
        accountName: asOptionalString(args.accountName || args.account),
        sectionName: asOptionalString(args.sectionName),
      };

      return [repairParsedCommand({ intent: type, ...base } as AIParsedAtomicCommand, text) as AIParsedAtomicCommand];
    }

    case 'money.transfer': {
      const amount = asAmount(args.amount, text);
      const toAccountName = cleanAccountName(args.toAccountName || args.to || args.targetAccountName, text);
      if (!amount || !toAccountName) return [];

      return [
        repairParsedCommand(
          {
            intent: 'transfer',
            amount,
            currency: args.currency ? inferCurrency(text, args.currency) : inferCurrency(text),
            fromAccountName: asOptionalString(args.fromAccountName || args.from || args.sourceAccountName),
            toAccountName,
            description: asOptionalString(args.description) || 'Перевод между счетами',
          },
          text,
        ) as AIParsedAtomicCommand,
      ];
    }

    case 'money.delete_all_accounts':
      return [{ intent: 'delete_all_accounts', scope: 'all' }];

    case 'history.clear':
      return [{ intent: 'clear_history', scope: asString(args.scope, 'all_transactions') === 'audit' ? 'audit' : asString(args.scope, 'all_transactions') === 'all' ? 'all' : 'all_transactions' }];

    case 'taxonomy.create_section': {
      const name = cleanEntityName(args.name || args.sectionName);
      return name ? [{ intent: 'create_section', name }] : [];
    }

    case 'taxonomy.create_category': {
      const name = cleanEntityName(args.name || args.category || args.rawCategory);
      if (!name) return [];
      return [{ intent: 'create_category', name, type: inferTransactionType(text, args.type), sectionName: asOptionalString(args.sectionName) }];
    }

    case 'taxonomy.assign_expenses_to_section': {
      const rawQuery = cleanEntityName(args.rawQuery || args.category || args.query || args.description);
      const sectionName = cleanEntityName(args.sectionName || args.name);
      return rawQuery && sectionName ? [{ intent: 'assign_expenses_to_section', rawQuery, sectionName }] : [];
    }

    case 'report.show_accounts':
      return [{ intent: 'show_accounts' }];

    case 'report.show_stats':
      return [{ intent: 'stats', type: inferTransactionType(text, args.type), rawCategory: asOptionalString(args.category || args.rawCategory) }];

    case 'planning.financial_plan':
      return [
        {
          intent: 'financial_planning',
          monthlyIncome: asAmount(args.monthlyIncome, text) ?? undefined,
          monthlyExpenses: asAmount(args.monthlyExpenses, text) ?? undefined,
          targetAmount: asAmount(args.targetAmount, text) ?? undefined,
          targetDateText: asOptionalString(args.targetDateText),
          question: asString(args.question || args.description || text, ''),
        },
      ];

    case 'assistant.answer':
      return [{ intent: 'advice', question: asString(args.question || args.description || text, '') }];

    case 'assistant.repeat_last':
      return [{ intent: 'repeat_last' }];

    default:
      return [];
  }
}

export function looksLikeToolPlan(value: unknown): value is AIToolPlan {
  return isRecord(value) && Array.isArray(value.toolCalls);
}

export function normalizeToolPlanToParsedCommand(value: unknown): AIParsedCommand | null {
  if (!looksLikeToolPlan(value)) return null;

  const originalText = asString(value.originalText || value.userMessage);
  const actions = value.toolCalls
    .filter((item): item is AIToolCall => isRecord(item) && typeof item.tool === 'string' && isRecord(item.args ?? {}))
    .flatMap((call) => convertToolCall(call, originalText))
    .filter((item) => item.intent !== 'unknown' && item.intent !== 'help');

  if (actions.length === 0) {
    const fallback = compileNaturalBatch(originalText);
    if (fallback) return fallback;
    const message = asString(value.userMessage);
    return message ? { intent: 'advice', question: message } : { intent: 'unknown', reason: 'empty_tool_plan' };
  }

  const parsed: AIParsedCommand = actions.length === 1
    ? actions[0]
    : {
        intent: 'batch',
        actions,
        originalText,
        premiumSuggestion: asOptionalString(value.premiumSuggestion),
      };

  return repairParsedCommand(parsed, originalText);
}

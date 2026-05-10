import { normalizeAmount } from '../utils/amount-normalizer';
import {
  asString,
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

function isReference(value: string | undefined): boolean {
  if (!value) return false;
  const raw = value.toLowerCase().replace(/ё/g, 'е');
  return /^(туда|там|на него|на нее|на неё|его|ее|её|этот счет|этот счёт|there|it|that account|vào đó|đó)$/.test(raw);
}

function convertToolCall(call: AIToolCall, context: { lastAccountName?: string; originalText?: string }): AIParsedAtomicCommand[] {
  const args = isRecord(call.args) ? call.args : {};
  const tool = canonicalToolName(call.tool);
  const originalText = context.originalText ?? '';

  switch (tool) {
    case 'money.create_account': {
      const name = cleanAccountName(args.name || args.accountName || args.title, 'Новый счёт');
      const initialBalance = asAmount(args.initialBalance ?? args.balance);
      const currency = inferCurrency(originalText, args.currency);
      const createAccount: AIParsedAtomicCommand = {
        intent: 'create_account',
        name,
        type: inferAccountType(originalText, args.type),
        currency,
        balance: 0,
      };
      context.lastAccountName = name;

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

    case 'money.update_account': {
      const accountNameRaw = asOptionalString(args.accountName || args.account || args.currentName || args.fromName || args.targetAccountName);
      const accountName = cleanAccountName(accountNameRaw || context.lastAccountName || '', '');
      if (!accountName) return [{ intent: 'unknown', reason: 'account_name_required' }];

      const parsed: AIParsedAtomicCommand = {
        intent: 'update_account',
        accountName,
        name: asOptionalString(args.name || args.newName) ? cleanAccountName(args.name || args.newName) : undefined,
        type: asOptionalString(args.type) ? inferAccountType(originalText, args.type) : undefined,
        currency: asOptionalString(args.currency) ? inferCurrency(originalText, args.currency) : undefined,
        balance: args.balance !== undefined ? asAmount(args.balance) ?? undefined : undefined,
        showInTotalBalance: typeof args.showInTotalBalance === 'boolean' ? args.showInTotalBalance : undefined,
      };
      return [parsed];
    }

    case 'money.delete_account': {
      const accountName = cleanAccountName(args.accountName || args.name || args.account || args.targetAccountName || context.lastAccountName || '', '');
      return accountName ? [{ intent: 'delete_account', accountName }] : [{ intent: 'unknown', reason: 'account_name_required' }];
    }

    case 'money.record_transaction': {
      const amount = asAmount(args.amount);
      if (!amount) return [{ intent: 'unknown', reason: 'amount_required' }];

      const type = inferTransactionType(originalText, args.type);
      const category = cleanName(args.category || args.rawCategory || args.description, type === 'income' ? 'доход' : 'расход');

      const rawAccountName = asOptionalString(args.accountName || args.account || args.toAccountName || args.targetAccountName);
      const accountName = isReference(rawAccountName) ? context.lastAccountName : rawAccountName;

      const parsed: AIParsedAtomicCommand = type === 'income'
        ? {
            intent: 'income',
            amount,
            currency: args.currency ? inferCurrency(originalText, args.currency) : undefined,
            rawCategory: category,
            description: cleanName(args.description, category),
            accountName: accountName ? cleanAccountName(accountName) : context.lastAccountName,
            sectionName: asOptionalString(args.sectionName) ? cleanName(args.sectionName) : undefined,
          }
        : {
            intent: 'expense',
            amount,
            currency: args.currency ? inferCurrency(originalText, args.currency) : undefined,
            rawCategory: category,
            description: cleanName(args.description, category),
            accountName: accountName ? cleanAccountName(accountName) : undefined,
            sectionName: asOptionalString(args.sectionName) ? cleanName(args.sectionName) : undefined,
          };

      return [repairParsedCommand(parsed) as AIParsedAtomicCommand];
    }

    case 'money.transfer': {
      const amount = asAmount(args.amount);
      const targetRaw = asOptionalString(args.toAccountName || args.to || args.targetAccountName || args.accountName || args.account);
      const resolvedTarget = isReference(targetRaw) ? context.lastAccountName : targetRaw;
      const toAccountName = cleanAccountName(resolvedTarget || '', '');
      if (!amount || !toAccountName) return [{ intent: 'unknown', reason: !amount ? 'amount_required' : 'target_account_required' }];

      return [
        repairParsedCommand({
          intent: 'transfer',
          amount,
          currency: args.currency ? inferCurrency(originalText, args.currency) : undefined,
          fromAccountName: asOptionalString(args.fromAccountName || args.from || args.sourceAccountName)
            ? cleanAccountName(args.fromAccountName || args.from || args.sourceAccountName)
            : undefined,
          toAccountName,
          description: asOptionalString(args.description),
        }) as AIParsedAtomicCommand,
      ];
    }

    case 'money.delete_all_accounts':
      return [{ intent: 'delete_all_accounts', confirmScope: 'accounts' }];

    case 'history.clear': {
      const scope = asString(args.scope, 'transactions').toLowerCase();
      return [{ intent: 'clear_history', scope: scope === 'ai' || scope === 'all' ? scope : 'transactions' }];
    }

    case 'finance.create_section': {
      const name = cleanName(args.name || args.sectionName);
      return name ? [{ intent: 'create_section', name }] : [{ intent: 'unknown', reason: 'section_name_required' }];
    }

    case 'finance.create_category': {
      const name = cleanName(args.name || args.category || args.rawCategory);
      if (!name) return [{ intent: 'unknown', reason: 'category_name_required' }];
      return [{
        intent: 'create_category',
        name,
        type: inferTransactionType(originalText, args.type),
        sectionName: asOptionalString(args.sectionName) ? cleanName(args.sectionName) : undefined,
      }];
    }

    case 'finance.assign_expenses_to_section': {
      const rawQuery = cleanName(args.rawQuery || args.category || args.query || args.description);
      const sectionName = cleanName(args.sectionName || args.name);
      return rawQuery && sectionName
        ? [{ intent: 'assign_expenses_to_section', rawQuery, sectionName }]
        : [{ intent: 'unknown', reason: 'query_or_section_required' }];
    }

    case 'finance.show_accounts':
      return [{ intent: 'show_accounts' }];

    case 'finance.show_stats':
      return [{
        intent: 'stats',
        type: inferTransactionType(originalText, args.type),
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

    case 'assistant.answer':
      return [{ intent: 'advice', question: asString(args.question || args.description, '') }];

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

  const context = { lastAccountName: undefined as string | undefined, originalText: asOptionalString(value.originalText) };
  const actions = value.toolCalls
    .filter((item: unknown): item is AIToolCall => isRecord(item) && typeof item.tool === 'string' && isRecord(item.args ?? {}))
    .flatMap((item: AIToolCall) => convertToolCall(item, context))
    .filter((item: AIParsedAtomicCommand) => item.intent !== 'help');

  const executableActions = actions.filter((item) => item.intent !== 'unknown');

  if (executableActions.length === 0) {
    const question = asString(value.userMessage || 'Нужно уточнение, чтобы выполнить действие.');
    return { intent: 'advice', question };
  }

  if (executableActions.length === 1 && !value.premiumSuggestion) {
    return repairParsedCommand(executableActions[0]);
  }

  return repairParsedCommand({
    intent: 'batch',
    actions: executableActions,
    originalText: asOptionalString(value.originalText),
    premiumSuggestion: asOptionalString(value.premiumSuggestion),
  });
}

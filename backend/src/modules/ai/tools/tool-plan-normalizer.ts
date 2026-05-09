import { extractAmountFromText, normalizeAmount } from '../utils/amount-normalizer';
import {
  cleanAccountName,
  compileNaturalBatch,
  compileNaturalCreateAccount,
  compileNaturalTopUp,
  inferAccountType,
  inferCurrency,
  inferTransactionType,
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

function asAmount(value: unknown, originalText = ''): number | null {
  const normalized = normalizeAmount(value);
  if (normalized !== null && normalized > 0) return normalized;
  return originalText ? extractAmountFromText(originalText) : null;
}

function normalizeTransactionType(value: unknown, originalText = ''): 'income' | 'expense' {
  return inferTransactionType(originalText, value);
}

function convertToolCall(call: AIToolCall, originalText = ''): AIParsedAtomicCommand[] {
  const args = isRecord(call.args) ? call.args : {};
  const text = asString(args.originalText || args.text || originalText, originalText);

  const natural = text ? compileNaturalBatch(text) : null;
  if (natural) return natural.intent === 'batch' ? natural.actions : [natural];

  switch (call.tool) {
    case 'create_account': {
      const direct = compileNaturalCreateAccount(text);
      if (direct) return direct.intent === 'batch' ? direct.actions : [direct];

      const name = cleanAccountName(args.name || args.accountName, text);
      const initialBalance = asAmount(args.initialBalance ?? args.balance, text);
      const currency = inferCurrency(text, args.currency);
      const createAccount: AIParsedAtomicCommand = {
        intent: 'create_account',
        name,
        type: inferAccountType(text, args.type),
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
        } as AIParsedAtomicCommand,
      ];
    }

    case 'create_transaction': {
      const amount = asAmount(args.amount, text);
      if (!amount) return [];

      const type = normalizeTransactionType(args.type, text);
      const category = asString(
        args.category || args.rawCategory || args.description,
        type === 'income' ? 'доход' : 'расход',
      );
      const accountName = asOptionalString(args.accountName || args.account || args.toAccountName);

      const parsed: AIParsedAtomicCommand = type === 'income'
        ? {
            intent: 'income',
            amount,
            currency: inferCurrency(text, args.currency),
            rawCategory: category,
            description: asString(args.description, category),
            accountName,
            sectionName: asOptionalString(args.sectionName),
          } as AIParsedAtomicCommand
        : {
            intent: 'expense',
            amount,
            currency: inferCurrency(text, args.currency),
            rawCategory: category,
            description: asString(args.description, category),
            accountName,
            sectionName: asOptionalString(args.sectionName),
          } as AIParsedAtomicCommand;

      return [repairParsedCommand(parsed, text) as AIParsedAtomicCommand];
    }

    case 'transfer_money': {
      const amount = asAmount(args.amount, text);
      const toAccountName = cleanAccountName(args.toAccountName || args.to || args.targetAccountName, text);
      if (!amount || !toAccountName) return [];

      return [
        repairParsedCommand(
          {
            intent: 'transfer',
            amount,
            fromAccountName: asOptionalString(args.fromAccountName || args.from || args.sourceAccountName),
            toAccountName,
          },
          text,
        ) as AIParsedAtomicCommand,
      ];
    }

    case 'create_section': {
      const name = asString(args.name || args.sectionName);
      return name ? [{ intent: 'create_section', name }] : [];
    }

    case 'create_category': {
      const name = asString(args.name || args.category || args.rawCategory);
      if (!name) return [];
      return [
        {
          intent: 'create_category',
          name,
          type: normalizeTransactionType(args.type, text),
          sectionName: asOptionalString(args.sectionName),
        },
      ];
    }

    case 'assign_expenses_to_section': {
      const rawQuery = asString(args.rawQuery || args.category || args.query || args.description);
      const sectionName = asString(args.sectionName || args.name);
      return rawQuery && sectionName ? [{ intent: 'assign_expenses_to_section', rawQuery, sectionName }] : [];
    }

    case 'show_accounts':
      return [{ intent: 'show_accounts' }];

    case 'show_stats':
      return [
        {
          intent: 'stats',
          type: normalizeTransactionType(args.type, text),
          rawCategory: asOptionalString(args.category || args.rawCategory),
        },
      ];

    case 'financial_planning':
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

    case 'answer_advice':
      return [{ intent: 'advice', question: asString(args.question || args.description || text, '') }];

    case 'repeat_last':
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

  const natural = compileNaturalBatch(originalText);
  if (natural) return natural;

  const naturalCreateAccount = compileNaturalCreateAccount(originalText);
  if (naturalCreateAccount) return naturalCreateAccount;

  const naturalTopUp = compileNaturalTopUp(originalText);
  if (naturalTopUp) return naturalTopUp;

  const actions = value.toolCalls
    .filter((item: AIToolCall): item is AIToolCall => {
      return isRecord(item) && typeof item.tool === 'string' && isRecord(item.args ?? {});
    })
    .flatMap((item: AIToolCall) => convertToolCall(item, originalText))
    .filter((item: AIParsedAtomicCommand) => item.intent !== 'unknown' && item.intent !== 'help')
    .map((item: AIParsedAtomicCommand) => repairParsedCommand(item, originalText) as AIParsedAtomicCommand);

  if (actions.length === 0) {
    const question = asString(value.userMessage || originalText);
    return question ? { intent: 'advice', question } : { intent: 'unknown' };
  }

  if (actions.length === 1 && !value.premiumSuggestion) return actions[0];

  return repairParsedCommand(
    {
      intent: 'batch',
      actions,
      originalText,
      premiumSuggestion: asOptionalString(value.premiumSuggestion),
    },
    originalText,
  );
}

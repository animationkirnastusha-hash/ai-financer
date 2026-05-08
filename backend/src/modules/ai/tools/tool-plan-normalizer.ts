import { normalizeAmount } from '../utils/amount-normalizer';
import type { AIParsedCommand, AIParsedAtomicCommand } from '../types';
import type { AIToolCall, AIToolPlan } from './tool-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = '') {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asOptionalString(value: unknown) {
  const normalized = cleanAccountReference(asString(value));
  return normalized ? normalized : undefined;
}

function asAmount(value: unknown) {
  const normalized = normalizeAmount(value);

  if (normalized !== null && normalized > 0) return normalized;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : null;
}

function normalizeCurrency(value: unknown): 'RUB' | 'USD' | 'EUR' {
  const raw = asString(value, 'RUB').toLowerCase();
  if (raw.includes('usd') || raw.includes('доллар') || raw.includes('$') || raw.includes('бакс')) return 'USD';
  if (raw.includes('eur') || raw.includes('евро') || raw.includes('€')) return 'EUR';
  return 'RUB';
}

function cleanAccountName(value: string) {
  const cleaned = value
    .replace(/[«»"']/g, '')
    .replace(/\b(и|а|назови|назвать|его|ее|её|счет|счёт|аккаунт|положи|положить|закинь|закинуть|внеси|внести|пополни|пополнить|добавь|добавить)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Новый счёт';
}

function cleanAccountReference(value: string) {
  return value
    .replace(/[«»"']/g, '')
    .replace(/\b(счет|счёт|карта|карту|кошелек|кошелёк|на|в|с|со|из)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAccountType(value: unknown): string {
  const raw = asString(value, 'card').toLowerCase();
  if (raw.includes('cash') || raw.includes('налич') || raw.includes('кэш')) return 'cash';
  if (raw.includes('saving') || raw.includes('накоп') || raw.includes('копил')) return 'savings';
  if (raw.includes('invest') || raw.includes('инвест')) return 'investment';
  return 'card';
}

function normalizeTransactionType(value: unknown, fallbackText?: unknown): 'income' | 'expense' {
  const raw = `${asString(value, 'expense')} ${asString(fallbackText)}`.toLowerCase();
  if (
    raw.includes('income') ||
    raw.includes('доход') ||
    raw.includes('пополн') ||
    raw.includes('полож') ||
    raw.includes('закин') ||
    raw.includes('внес') ||
    raw.includes('зачисл') ||
    raw.includes('поступ')
  ) {
    return 'income';
  }
  return 'expense';
}

function convertToolCall(call: AIToolCall): AIParsedAtomicCommand[] {
  const args = isRecord(call.args) ? call.args : {};

  switch (call.tool) {
    case 'create_account': {
      const name = cleanAccountName(asString(args.name || args.accountName, 'Новый счёт'));
      const initialBalance = asAmount(args.initialBalance ?? args.balance);
      const currency = normalizeCurrency(args.currency);
      const createAccount: AIParsedAtomicCommand = {
        intent: 'create_account',
        name,
        type: normalizeAccountType(args.type),
        currency,
        balance: 0,
      };

      if (!initialBalance) return [createAccount];

      return [
        createAccount,
        {
          intent: 'income',
          amount: initialBalance,
          rawCategory: 'пополнение',
          description: 'пополнение счёта',
          accountName: name,
        },
      ];
    }

    case 'create_transaction': {
      const amount = asAmount(args.amount);
      if (!amount) return [];

      const type = normalizeTransactionType(args.type, `${args.description ?? ''} ${args.category ?? ''} ${args.rawCategory ?? ''}`);
      const category = asString(
        args.category || args.rawCategory || args.description,
        type === 'income' ? 'пополнение' : 'расход',
      );

      return [
        type === 'income'
          ? {
              intent: 'income',
              amount,
              rawCategory: category,
              description: asString(args.description, category),
              accountName: asOptionalString(args.accountName),
              sectionName: asOptionalString(args.sectionName),
            }
          : {
              intent: 'expense',
              amount,
              rawCategory: category,
              description: asString(args.description, category),
              accountName: asOptionalString(args.accountName),
              sectionName: asOptionalString(args.sectionName),
            },
      ];
    }

    case 'transfer_money': {
      const amount = asAmount(args.amount);
      const toAccountName = asOptionalString(args.toAccountName || args.to || args.targetAccountName);
      if (!amount || !toAccountName) return [];
      return [
        {
          intent: 'transfer',
          amount,
          fromAccountName: asOptionalString(args.fromAccountName || args.from || args.sourceAccountName),
          toAccountName,
        },
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
          type: normalizeTransactionType(args.type, args.name || args.category || args.rawCategory),
          sectionName: asOptionalString(args.sectionName),
        },
      ];
    }

    case 'assign_expenses_to_section': {
      const rawQuery = asString(args.rawQuery || args.category || args.query || args.description);
      const sectionName = asString(args.sectionName || args.name);
      if (!rawQuery || !sectionName) return [];
      return [{ intent: 'assign_expenses_to_section', rawQuery, sectionName }];
    }

    case 'show_accounts':
      return [{ intent: 'show_accounts' }];

    case 'show_stats':
      return [
        {
          intent: 'stats',
          type: normalizeTransactionType(args.type),
          rawCategory: asOptionalString(args.category || args.rawCategory),
        },
      ];

    case 'financial_planning':
      return [
        {
          intent: 'financial_planning',
          monthlyIncome: asAmount(args.monthlyIncome) ?? undefined,
          monthlyExpenses: asAmount(args.monthlyExpenses) ?? undefined,
          targetAmount: asAmount(args.targetAmount) ?? undefined,
          targetDateText: asOptionalString(args.targetDateText),
          question: asString(args.question || args.description, ''),
        },
      ];

    case 'answer_advice':
      return [{ intent: 'advice', question: asString(args.question || args.description, '') }];

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

  const actions = value.toolCalls
    .filter((item): item is AIToolCall => isRecord(item) && typeof item.tool === 'string' && isRecord(item.args ?? {}))
    .flatMap(convertToolCall)
    .filter((item) => item.intent !== 'unknown' && item.intent !== 'help');

  if (actions.length === 0) {
    const question = asString(value.userMessage);
    return question ? { intent: 'advice', question } : { intent: 'unknown' };
  }

  if (actions.length === 1 && !value.premiumSuggestion) return actions[0];

  return {
    intent: 'batch',
    actions,
    originalText: asOptionalString(value.originalText),
    premiumSuggestion: asOptionalString(value.premiumSuggestion),
  };
}

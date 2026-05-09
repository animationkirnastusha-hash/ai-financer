import type { AIParsedCommand } from './types';
import {
  compileNaturalBatch,
  compileNaturalCreateAccount,
  compileNaturalTaxonomy,
  compileNaturalTopUp,
  compileNaturalTransaction,
  compileNaturalTransfer,
} from './utils/command-compiler';
import { extractAmountCandidates, extractAmountFromText, normalizeAmount } from './utils/amount-normalizer';

function normalize(input: string) {
  return input.trim().toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ');
}

function parseAllAmounts(input: string): number[] {
  return extractAmountCandidates(input).map((item) => item.amount);
}

function isFinancialPlanning(input: string) {
  return (
    input.includes('финансовую модель') ||
    input.includes('финансовая модель') ||
    input.includes('смогу скопить') ||
    input.includes('скопить') ||
    input.includes('накопить') ||
    input.includes('цель') ||
    input.includes('план накоп') ||
    input.includes('как накоп') ||
    input.includes('к концу года') ||
    input.includes('при зарплате') ||
    input.includes('расходом') ||
    input.includes('forecast') ||
    input.includes('goal') ||
    input.includes('plan')
  );
}

function parsePlanning(input: string): AIParsedCommand {
  const amounts = parseAllAmounts(input);

  return {
    intent: 'financial_planning',
    monthlyIncome: input.includes('зарплат') || input.includes('доход') || input.includes('income') ? amounts[0] : undefined,
    monthlyExpenses: input.includes('расход') || input.includes('expenses') ? amounts[1] : undefined,
    targetAmount: input.includes('скопить') || input.includes('накопить') || input.includes('цель') || input.includes('goal') ? amounts.at(-1) : undefined,
    targetDateText: input.includes('концу года') ? 'к концу года' : undefined,
    question: input,
  };
}

function parseStats(input: string): AIParsedCommand | null {
  if (!/(сколько|статист|покажи|потратил на|потратила на|summary|stats|statistics)/i.test(input)) return null;
  if (/(счет|счёт|счета|счёта|account)/i.test(input)) return { intent: 'show_accounts' };
  return {
    intent: 'stats',
    type: /(доход|income)/i.test(input) ? 'income' : 'expense',
    rawCategory: input
      .replace(/сколько|статист(?:ика)?|покажи|потратил(?:а)?\s+на|траты\s+на|summary|stats|statistics/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim() || undefined,
  };
}

export function fastFinanceParse(command: string): AIParsedCommand | null {
  const input = normalize(command);
  if (!input) return null;

  if (/^(счета|счёта|мои счета|покажи счета|открой счета|show accounts|accounts)$/i.test(input)) return { intent: 'show_accounts' };
  if (isFinancialPlanning(input)) return parsePlanning(input);

  const stats = parseStats(input);
  if (stats) return stats;

  const accountBatch = compileNaturalCreateAccount(input);
  if (accountBatch) return accountBatch;

  const batch = compileNaturalBatch(input);
  if (batch) return batch;

  const taxonomy = compileNaturalTaxonomy(input);
  if (taxonomy) return taxonomy;

  const transfer = compileNaturalTransfer(input);
  if (transfer) return transfer;

  const topUp = compileNaturalTopUp(input);
  if (topUp) return topUp;

  const transaction = compileNaturalTransaction(input);
  if (transaction) return transaction;

  const amount = extractAmountFromText(input) ?? normalizeAmount(input);
  if (amount) {
    return {
      intent: input.startsWith('+') ? 'income' : 'expense',
      amount,
      rawCategory: input.startsWith('+') ? 'доход' : 'расход',
      description: input,
    };
  }

  return null;
}

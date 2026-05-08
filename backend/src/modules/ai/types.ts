export type AIIntent =
  | 'batch'
  | 'expense'
  | 'income'
  | 'transfer'
  | 'show_accounts'
  | 'create_category'
  | 'create_section'
  | 'assign_expenses_to_section'
  | 'create_account'
  | 'update_settings'
  | 'stats'
  | 'financial_planning'
  | 'advice'
  | 'repeat_last'
  | 'help'
  | 'unknown';

export type AIRiskLevel = 'low' | 'medium' | 'high';

export interface AIHandleOptions {
  execute?: boolean;
  confirmed?: boolean;
}

export interface AIParsedExpense {
  intent: 'expense';
  amount: number;
  rawCategory: string;
  description?: string;
  accountName?: string;
  sectionName?: string;
}

export interface AIParsedIncome {
  intent: 'income';
  amount: number;
  rawCategory: string;
  description?: string;
  accountName?: string;
  sectionName?: string;
}

export interface AIParsedTransfer {
  intent: 'transfer';
  amount: number;
  fromAccountName?: string;
  toAccountName: string;
}

export interface AIParsedShowAccounts {
  intent: 'show_accounts';
}

export interface AIParsedCreateCategory {
  intent: 'create_category';
  name: string;
  type: 'income' | 'expense';
  sectionName?: string;
}

export interface AIParsedCreateSection {
  intent: 'create_section';
  name: string;
}

export interface AIParsedAssignExpensesToSection {
  intent: 'assign_expenses_to_section';
  rawQuery: string;
  sectionName: string;
}

export interface AIParsedCreateAccount {
  intent: 'create_account';
  name: string;
  type: string;
  currency: string;
  balance: number;
}

export interface AIParsedUpdateSettings {
  intent: 'update_settings';
  key: string;
  value: unknown;
}

export interface AIParsedStats {
  intent: 'stats';
  type: 'income' | 'expense';
  rawCategory?: string;
}

export interface AIParsedFinancialPlanning {
  intent: 'financial_planning';
  monthlyIncome?: number;
  monthlyExpenses?: number;
  targetAmount?: number;
  targetDateText?: string;
  question: string;
}

export interface AIParsedAdvice {
  intent: 'advice';
  question: string;
}

export interface AIParsedRepeatLast {
  intent: 'repeat_last';
}

export interface AIParsedHelp {
  intent: 'help';
}

export interface AIParsedUnknown {
  intent: 'unknown';
}

export type AIParsedAtomicCommand =
  | AIParsedExpense
  | AIParsedIncome
  | AIParsedTransfer
  | AIParsedShowAccounts
  | AIParsedCreateCategory
  | AIParsedCreateSection
  | AIParsedAssignExpensesToSection
  | AIParsedCreateAccount
  | AIParsedUpdateSettings
  | AIParsedStats
  | AIParsedFinancialPlanning
  | AIParsedAdvice
  | AIParsedRepeatLast
  | AIParsedHelp
  | AIParsedUnknown;

export interface AIParsedBatchCommand {
  intent: 'batch';
  actions: AIParsedAtomicCommand[];
  originalText?: string;
  summary?: string;
  premiumSuggestion?: string;
}

export type AIParsedCommand = AIParsedAtomicCommand | AIParsedBatchCommand;

export interface AIActionPolicyResult {
  canExecute: boolean;
  requiresConfirmation: boolean;
  riskLevel: AIRiskLevel;
  reason?: string;
}

export interface AIResultMeta {
  pendingActionId?: string;
  auditLogId?: string;
  confirmExpiresAt?: string;
  undo?: {
    available: boolean;
    actionType?: 'transaction';
    targetId?: string;
  };
}

export interface AIResult {
  success: boolean;
  intent: AIIntent;
  executed: boolean;
  requiresConfirmation: boolean;
  riskLevel: AIRiskLevel;
  message: string;
  parsed: Record<string, unknown> | null;
  data?: unknown;
  meta?: AIResultMeta;
}

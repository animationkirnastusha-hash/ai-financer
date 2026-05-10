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
  | 'update_account'
  | 'delete_account'
  | 'delete_all_accounts'
  | 'clear_history'
  | 'update_settings'
  | 'stats'
  | 'financial_planning'
  | 'advice'
  | 'repeat_last'
  | 'help'
  | 'unknown';

export type AIRiskLevel = 'low' | 'medium' | 'high';
export type AIAccountType = 'cash' | 'card' | 'savings' | 'investment';
export type AICurrency = 'RUB' | 'USD' | 'EUR' | 'VND';

export interface AIHandleOptions {
  execute?: boolean;
  confirmed?: boolean;
}

export interface AIParsedExpense {
  intent: 'expense';
  amount: number;
  currency?: AICurrency | string;
  rawCategory: string;
  description?: string;
  accountName?: string;
  sectionName?: string;
}

export interface AIParsedIncome {
  intent: 'income';
  amount: number;
  currency?: AICurrency | string;
  rawCategory: string;
  description?: string;
  accountName?: string;
  sectionName?: string;
}

export interface AIParsedTransfer {
  intent: 'transfer';
  amount: number;
  currency?: AICurrency | string;
  fromAccountName?: string;
  toAccountName: string;
  description?: string;
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
  type: AIAccountType;
  currency: AICurrency;
  balance: number;
}

export interface AIParsedUpdateAccount {
  intent: 'update_account';
  accountName: string;
  name?: string;
  type?: AIAccountType;
  currency?: AICurrency;
  balance?: number;
}

export interface AIParsedDeleteAccount {
  intent: 'delete_account';
  accountName: string;
}

export interface AIParsedDeleteAllAccounts {
  intent: 'delete_all_accounts';
  confirmScope?: 'accounts' | 'all_user_finance';
}

export interface AIParsedClearHistory {
  intent: 'clear_history';
  scope: 'transactions' | 'ai' | 'all';
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
  reason?: string;
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
  | AIParsedUpdateAccount
  | AIParsedDeleteAccount
  | AIParsedDeleteAllAccounts
  | AIParsedClearHistory
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
    actionType?: 'transaction' | 'account' | 'category' | 'section' | 'batch';
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

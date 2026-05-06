export type AIIntent =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'show_accounts'
  | 'create_category'
  | 'create_account'
  | 'stats'
  | 'financial_planning'
  | 'update_account'
  | 'chat_response'
  | 'multi_action'
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
}

export interface AIParsedIncome {
  intent: 'income';
  amount: number;
  rawCategory: string;
  description?: string;
  accountName?: string;
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
}

export interface AIParsedCreateAccount {
  intent: 'create_account';
  name: string;
  type: string;
  currency: string;
  balance: number;
}

export interface AIParsedStats {
  intent: 'stats';
  type: 'income' | 'expense';
  rawCategory?: string;
}


export interface AIParsedUpdateAccount {
  intent: 'update_account';
  accountName?: string;
  accountBalance?: number;
  newName?: string;
  type?: string;
  currency?: string;
  showInTotalBalance?: boolean;
  lockRename?: boolean;
  lockSpending?: boolean;
  lockTransfers?: boolean;
  lockBalance?: boolean;
  lockVisibility?: boolean;
}

export interface AIParsedChatResponse {
  intent: 'chat_response';
  message: string;
}

export interface AIParsedMultiAction {
  intent: 'multi_action';
  actions: AIParsedCommand[];
}

export interface AIParsedFinancialPlanning {
  intent: 'financial_planning';
  monthlyIncome?: number;
  monthlyExpenses?: number;
  targetAmount?: number;
  targetDateText?: string;
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

export type AIParsedCommand =
  | AIParsedExpense
  | AIParsedIncome
  | AIParsedTransfer
  | AIParsedShowAccounts
  | AIParsedCreateCategory
  | AIParsedCreateAccount
  | AIParsedStats
  | AIParsedFinancialPlanning
  | AIParsedUpdateAccount
  | AIParsedChatResponse
  | AIParsedMultiAction
  | AIParsedRepeatLast
  | AIParsedHelp
  | AIParsedUnknown;

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
export type AICurrency = 'RUB' | 'USD' | 'EUR' | 'VND';
export type AIAccountType = 'cash' | 'card' | 'savings' | 'investment';
export type AITransactionType = 'income' | 'expense';
export type AIRiskLevel = 'low' | 'medium' | 'high';

export type AIToolName =
  | 'create_account'
  | 'update_account'
  | 'delete_account'
  | 'create_transaction'
  | 'transfer_money'
  | 'create_category'
  | 'update_category'
  | 'delete_category'
  | 'create_section'
  | 'update_section'
  | 'delete_section'
  | 'assign_category_to_section'
  | 'show_accounts'
  | 'show_transactions';

export interface AIToolCall<TInput extends Record<string, unknown> = Record<string, unknown>> {
  tool: AIToolName;
  input: TInput;
  reason?: string;
}

export interface AIActionPlan {
  mode: 'actions';
  language?: string;
  summary?: string;
  actions: AIToolCall[];
}

export interface AIQuestionPlan {
  mode: 'question';
  language?: string;
  answer: string;
}

export interface AIClarificationPlan {
  mode: 'clarification';
  language?: string;
  message: string;
  missing?: string[];
}

export type AIPlan = AIActionPlan | AIQuestionPlan | AIClarificationPlan;

export interface AIValidationIssue {
  code: string;
  message: string;
  actionIndex?: number;
  field?: string;
}

export interface AIValidatedAction extends AIToolCall {
  riskLevel: AIRiskLevel;
  requiresConfirmation: boolean;
  resolved?: Record<string, unknown>;
}

export interface AIValidatedPlan {
  ok: boolean;
  summary: string;
  actions: AIValidatedAction[];
  riskLevel: AIRiskLevel;
  requiresConfirmation: boolean;
  issues: AIValidationIssue[];
}

export interface AIParsedCommand {
  intent: 'batch';
  summary: string;
  actions: AIValidatedAction[];
}

export interface AIHandleOptions {
  execute?: boolean;
}

export interface AIResult {
  success: boolean;
  intent: string;
  executed: boolean;
  requiresConfirmation: boolean;
  riskLevel: AIRiskLevel;
  message: string;
  parsed: Record<string, unknown> | null;
  result?: unknown;
  meta?: {
    auditLogId?: string;
    pendingActionId?: string;
    undo?: {
      available: boolean;
      actionType?: string;
      targetId?: string;
    };
  };
}

export interface AIPendingActionDto {
  id: string;
  userId?: string;
  command: string;
  intent: string;
  riskLevel: AIRiskLevel | string;
  parsed: Record<string, unknown> | null;
  status: string;
  expiresAt: Date | string;
  confirmedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

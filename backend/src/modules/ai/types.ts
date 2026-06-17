export type AICurrency = 'RUB' | 'USD' | 'EUR' | 'VND';
export type AIAccountType = 'cash' | 'card' | 'savings' | 'investment';
export type AITransactionType = 'income' | 'expense';
export type AIRiskLevel = 'low' | 'medium' | 'high';

export type AIToolName =
  | 'create_account'
  | 'update_account'
  | 'delete_account'
  | 'delete_accounts'
  | 'set_primary_account'
  | 'create_transaction'
  | 'update_transaction'
  | 'transfer_money'
  | 'create_category'
  | 'update_category'
  | 'delete_category'
  | 'create_section'
  | 'update_section'
  | 'delete_section'
  | 'assign_category_to_section'
  | 'show_taxonomy'
  | 'create_goal'
  | 'update_goal'
  | 'delete_goal'
  | 'show_goals'
  | 'show_accounts'
  | 'show_transactions'
  | 'query_analytics'
  | 'undo_last_action'
  | 'show_companion_reactions'
  | 'mark_companion_reactions_seen'
  | 'show_premium_capabilities'
  | 'show_ai_settings'
  | 'update_ai_settings'
  | 'apply_ai_settings_preset'
  | 'update_onboarding_state'
  | 'restart_onboarding'
  | 'create_obligation'
  | 'update_obligation'
  | 'delete_obligation'
  | 'mark_obligation_paid'
  | 'show_obligations'
  | 'create_obligation_reminder'
  | 'create_spending_limit'
  | 'update_spending_limit'
  | 'delete_spending_limit'
  | 'show_spending_limits';

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

export type AIPlan = AIActionPlan;

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

export interface AIClarificationRequest {
  type: 'account' | 'account_setup' | 'amount' | 'goal' | 'category' | 'section' | 'transaction' | 'obligation' | 'spending_limit';
  field: 'account' | 'accountSetup' | 'amount' | 'targetAmount' | 'goal' | 'category' | 'section' | 'transaction' | 'obligation' | 'spending_limit' | string;
  actionIndex: number;
  question: string;
  createdAt: string;
}

export interface AIParsedCommand {
  intent: 'batch';
  summary: string;
  actions: AIValidatedAction[];
  clarification?: AIClarificationRequest | null;
}

export type AICommandSource = 'text' | 'voice' | 'voice_session';

export interface AIVoiceSessionSegment {
  text: string;
  role: 'initial' | 'continuation' | 'correction';
  at?: number;
}

export interface AIVoiceSessionPayload {
  id?: string;
  finalText?: string;
  correctionCount?: number;
  segments?: AIVoiceSessionSegment[];
}

export interface AIHandleOptions {
  execute?: boolean;
  source?: AICommandSource;
  voiceSession?: AIVoiceSessionPayload | null;
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
    clarification?: AIClarificationRequest;
    undo?: {
      available: boolean;
      actionType?: string;
      targetId?: string;
    };
    dryRun?: boolean;
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

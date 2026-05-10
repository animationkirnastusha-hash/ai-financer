import type { AIParsedCommand } from '../types';

export type AIToolName =
  | 'money.create_account'
  | 'money.update_account'
  | 'money.delete_account'
  | 'money.record_transaction'
  | 'money.transfer'
  | 'money.delete_all_accounts'
  | 'history.clear'
  | 'finance.create_section'
  | 'finance.create_category'
  | 'finance.assign_expenses_to_section'
  | 'finance.show_accounts'
  | 'finance.show_stats'
  | 'finance.plan'
  | 'assistant.answer'
  | 'assistant.repeat_last'
  | 'create_account'
  | 'update_account'
  | 'delete_account'
  | 'create_transaction'
  | 'transfer_money'
  | 'delete_all_accounts'
  | 'clear_history'
  | 'create_section'
  | 'create_category'
  | 'assign_expenses_to_section'
  | 'show_accounts'
  | 'show_stats'
  | 'financial_planning'
  | 'answer_advice'
  | 'repeat_last';

export type AIToolArguments = Record<string, unknown>;

export interface AIToolCall {
  tool: AIToolName | string;
  args: AIToolArguments;
  confidence?: number;
  reason?: string;
}

export interface AIToolPlan {
  toolCalls: AIToolCall[];
  originalText?: string;
  userMessage?: string;
  premiumSuggestion?: string;
}

export type ToolConvertedCommand = AIParsedCommand;

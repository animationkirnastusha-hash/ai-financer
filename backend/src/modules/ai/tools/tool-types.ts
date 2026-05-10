import type { AIParsedCommand } from '../types';

export type AIToolName =
  | 'money.create_account'
  | 'money.record_transaction'
  | 'money.transfer'
  | 'money.delete_all_accounts'
  | 'history.clear'
  | 'taxonomy.create_category'
  | 'taxonomy.create_section'
  | 'taxonomy.assign_expenses_to_section'
  | 'report.show_accounts'
  | 'report.show_stats'
  | 'planning.financial_plan'
  | 'assistant.answer'
  | 'assistant.repeat_last'
  // backward compatibility with older model/tool prompts
  | 'create_account'
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
  tool: AIToolName;
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

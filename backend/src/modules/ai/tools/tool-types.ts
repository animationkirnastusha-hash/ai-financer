import type { AIParsedCommand } from '../types';

export type AIToolName =
  | 'create_account'
  | 'create_transaction'
  | 'transfer_money'
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

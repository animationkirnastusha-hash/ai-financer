import { AIToolDefinition } from './tool-types';

export const AI_TOOL_REGISTRY: AIToolDefinition[] = [
  {
    name: 'create_account',
    description: 'Create account/wallet/card/cash/savings/investment. Use with initialBalance when user says to create account and put/add money there.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string', type: 'cash|card|savings|investment|null', currency: 'RUB|USD|EUR|VND|null', initialBalance: 'number|string|null' },
  },
  {
    name: 'update_account',
    description: 'Change account fields.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { account: 'string', name: 'string|null', type: 'cash|card|savings|investment|null', currency: 'RUB|USD|EUR|VND|null', balance: 'number|string|null' },
  },
  {
    name: 'delete_account',
    description: 'Delete account. Dangerous.',
    risk: 'high',
    requiresConfirmation: true,
    input: { account: 'string' },
  },
  {
    name: 'create_transaction',
    description: 'Record expense/income/top-up/deposit/salary. Backend validates amount, balance and auto-execute policy.',
    risk: 'low',
    requiresConfirmation: false,
    input: { kind: 'income|expense', amount: 'number|string', currency: 'RUB|USD|EUR|VND|null', account: 'string|null', category: 'string|null', section: 'string|null', description: 'string|null' },
  },
  {
    name: 'transfer_money',
    description: 'Move money between two accounts.',
    risk: 'high',
    requiresConfirmation: true,
    input: { fromAccount: 'string', toAccount: 'string', amount: 'number|string', currency: 'RUB|USD|EUR|VND|null', description: 'string|null' },
  },
  {
    name: 'create_category',
    description: 'Create category.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string', type: 'income|expense', section: 'string|null' },
  },
  {
    name: 'create_section',
    description: 'Create section for grouping categories/transactions.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string' },
  },
  {
    name: 'show_accounts',
    description: 'Show accounts.',
    risk: 'low',
    requiresConfirmation: false,
    input: {},
  },
  {
    name: 'show_transactions',
    description: 'Show recent transactions.',
    risk: 'low',
    requiresConfirmation: false,
    input: { limit: 'number|null' },
  },
  {
    name: 'show_ai_settings',
    description: 'Show AI/user automation settings, default accounts, onboarding state and presets.',
    risk: 'low',
    requiresConfirmation: false,
    input: {},
  },
  {
    name: 'update_ai_settings',
    description: 'Update AI settings: default accounts, auto-confirm limits, companion tone.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      defaultExpenseAccount: 'string|null',
      defaultIncomeAccount: 'string|null',
      autoConfirmExpenseLimit: 'number|string|null',
      autoConfirmIncomeLimit: 'number|string|null',
      autoConfirmTransferLimit: 'number|string|null',
      requireConfirmForAccountActions: 'boolean|null',
      companionTone: 'calm|friendly|strict|coach|null',
    },
  },
  {
    name: 'apply_ai_settings_preset',
    description: 'Apply recommended AI settings preset: strict, balanced or simple.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { preset: 'strict|balanced|simple' },
  },
  {
    name: 'update_onboarding_state',
    description: 'Update interactive onboarding/tutorial state.',
    risk: 'low',
    requiresConfirmation: false,
    input: { status: 'not_started|active|completed|null', currentStep: 'string|null', skipped: 'boolean|null' },
  },
  {
    name: 'restart_onboarding',
    description: 'Restart optional interactive onboarding/tutorial.',
    risk: 'low',
    requiresConfirmation: false,
    input: {},
  },
  {
    name: 'query_analytics',
    description: 'Answer analytics questions about spending, income, balance, categories, accounts and periods.',
    risk: 'low',
    requiresConfirmation: false,
    input: { period: 'today|week|month|year|all|null', metric: 'summary|spending|income|top_categories|accounts|cashflow|null', limit: 'number|null' },
  },
  {
    name: 'undo_last_action',
    description: 'Undo/revert the latest AI-created financial transaction when safe.',
    risk: 'high',
    requiresConfirmation: true,
    input: { target: 'last|transaction|null' },
  },
  {
    name: 'show_companion_reactions',
    description: 'Show recent AI companion reaction events/signals.',
    risk: 'low',
    requiresConfirmation: false,
    input: { limit: 'number|null', onlyUnseen: 'boolean|null' },
  },
  {
    name: 'mark_companion_reactions_seen',
    description: 'Mark AI companion reactions as seen.',
    risk: 'low',
    requiresConfirmation: false,
    input: {},
  },
  {
    name: 'show_premium_capabilities',
    description: 'Show premium-ready capability boundaries and enabled flags.',
    risk: 'low',
    requiresConfirmation: false,
    input: {},
  },
];

export function getToolDefinition(name: string) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function getPlannerToolContract() {
  return [
    'create_transaction{kind:income|expense,amount,account,category,description,currency} // account is natural name/alias, never id',
    'create_account{name,type:cash|card|savings|investment,currency,initialBalance} // initialBalance 0 when money is added by transaction',
    'transfer_money{fromAccount,toAccount,amount,currency,description}',
    'show_accounts{}',
    'show_transactions{limit}',
    'query_analytics{period,metric,limit}',
    'undo_last_action{target}',
    'show_companion_reactions{limit,onlyUnseen}',
    'mark_companion_reactions_seen{}',
    'show_premium_capabilities{}',
    'show_ai_settings{}',
    'update_ai_settings{defaultExpenseAccount,defaultIncomeAccount,autoConfirmExpenseLimit,autoConfirmIncomeLimit,autoConfirmTransferLimit,requireConfirmForAccountActions,companionTone}',
    'apply_ai_settings_preset{preset:strict|balanced|simple}',
    'update_onboarding_state{status,currentStep,skipped}',
    'restart_onboarding{}',
  ].join('\n');
}


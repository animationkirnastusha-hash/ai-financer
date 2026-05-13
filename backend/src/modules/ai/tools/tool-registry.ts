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
    description: 'Record expense or income. Bare item + amount is expense. Small expenses may be executed without confirmation by backend policy.',
    risk: 'medium',
    requiresConfirmation: true,
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
    name: 'update_category',
    description: 'Rename/move category.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { category: 'string', name: 'string|null', section: 'string|null' },
  },
  {
    name: 'delete_category',
    description: 'Delete category. Dangerous.',
    risk: 'high',
    requiresConfirmation: true,
    input: { category: 'string' },
  },
  {
    name: 'create_section',
    description: 'Create section for grouping categories/transactions.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string' },
  },
  {
    name: 'update_section',
    description: 'Rename section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { section: 'string', name: 'string' },
  },
  {
    name: 'delete_section',
    description: 'Delete section. Dangerous.',
    risk: 'high',
    requiresConfirmation: true,
    input: { section: 'string' },
  },
  {
    name: 'assign_category_to_section',
    description: 'Attach category to section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { category: 'string', section: 'string' },
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
];

export function getToolDefinition(name: string) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function getPlannerToolContract() {
  return [
    'create_transaction {kind:income|expense,amount,account?,category?,section?,description?,currency?}',
    'create_account {name,type?,currency?,initialBalance?}',
    'transfer_money {fromAccount,toAccount,amount,currency?,description?}',
    'create_category {name,type,section?}',
    'create_section {name}',
    'show_accounts {}',
    'show_transactions {limit?}',
    'update_account {account,name?,type?,currency?,balance?}',
    'delete_account {account}',
    'update_category {category,name?,section?}',
    'delete_category {category}',
    'update_section {section,name}',
    'delete_section {section}',
    'assign_category_to_section {category,section}',
  ].join('');
}


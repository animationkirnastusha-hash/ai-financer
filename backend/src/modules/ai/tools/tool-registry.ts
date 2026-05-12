import { AIToolDefinition } from './tool-types';

export const AI_TOOL_REGISTRY: AIToolDefinition[] = [
  {
    name: 'create_account',
    description: 'Create a new account, wallet, card, cash place, savings place, or investment account.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string', type: 'cash|card|savings|investment|null', currency: 'RUB|USD|EUR|VND|null', initialBalance: 'number|string|null' },
  },
  {
    name: 'update_account',
    description: 'Change an existing account name, type, currency, visibility, balance, or settings.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { account: 'string', name: 'string|null', type: 'cash|card|savings|investment|null', currency: 'RUB|USD|EUR|VND|null', balance: 'number|string|null' },
  },
  {
    name: 'delete_account',
    description: 'Delete an existing account.',
    risk: 'high',
    requiresConfirmation: true,
    input: { account: 'string' },
  },
  {
    name: 'create_transaction',
    description: 'Record one income or expense transaction.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { kind: 'income|expense', amount: 'number|string', currency: 'RUB|USD|EUR|VND|null', account: 'string|null', category: 'string|null', section: 'string|null', description: 'string|null' },
  },
  {
    name: 'transfer_money',
    description: 'Move money between two existing accounts.',
    risk: 'high',
    requiresConfirmation: true,
    input: { fromAccount: 'string', toAccount: 'string', amount: 'number|string', currency: 'RUB|USD|EUR|VND|null', description: 'string|null' },
  },
  {
    name: 'create_category',
    description: 'Create a category for income or expenses.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string', type: 'income|expense', section: 'string|null' },
  },
  {
    name: 'update_category',
    description: 'Rename a category or move it to another section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { category: 'string', name: 'string|null', section: 'string|null' },
  },
  {
    name: 'delete_category',
    description: 'Delete a category.',
    risk: 'high',
    requiresConfirmation: true,
    input: { category: 'string' },
  },
  {
    name: 'create_section',
    description: 'Create a section for grouping categories and transactions.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string' },
  },
  {
    name: 'update_section',
    description: 'Rename a section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { section: 'string', name: 'string' },
  },
  {
    name: 'delete_section',
    description: 'Delete a section.',
    risk: 'high',
    requiresConfirmation: true,
    input: { section: 'string' },
  },
  {
    name: 'assign_category_to_section',
    description: 'Assign an existing category to an existing section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { category: 'string', section: 'string' },
  },
  {
    name: 'show_accounts',
    description: 'Show account information.',
    risk: 'low',
    requiresConfirmation: false,
    input: {},
  },
  {
    name: 'show_transactions',
    description: 'Show recent transaction history.',
    risk: 'low',
    requiresConfirmation: false,
    input: { limit: 'number|null' },
  },
];

export function getToolDefinition(name: string) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function getPlannerToolContract() {
  return JSON.stringify(AI_TOOL_REGISTRY.map((tool) => ({
    tool: tool.name,
    purpose: tool.description,
    input: tool.input,
  })));
}

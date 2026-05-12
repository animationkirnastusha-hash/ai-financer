import { AIToolDefinition } from './tool-types';

export const AI_TOOL_REGISTRY: AIToolDefinition[] = [
  {
    name: 'create_account',
    description: 'Create a new account/wallet/card/savings place for money.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string', type: 'cash|card|savings|investment|null', currency: 'RUB|USD|EUR|VND|null', initialBalance: 'number|null' },
  },
  {
    name: 'update_account',
    description: 'Rename or change an existing account.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { account: 'string', name: 'string|null', type: 'cash|card|savings|investment|null', currency: 'RUB|USD|EUR|VND|null', balance: 'number|null' },
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
    description: 'Create income or expense. Deposit/top up/add money to account = income. Buy/pay/spend = expense.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { kind: 'income|expense', amount: 'number', currency: 'RUB|USD|EUR|VND|null', account: 'string|null', category: 'string|null', section: 'string|null', description: 'string|null' },
  },
  {
    name: 'transfer_money',
    description: 'Move money from one account to another.',
    risk: 'high',
    requiresConfirmation: true,
    input: { fromAccount: 'string', toAccount: 'string', amount: 'number', currency: 'RUB|USD|EUR|VND|null', description: 'string|null' },
  },
  {
    name: 'create_category',
    description: 'Create income or expense category.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string', type: 'income|expense', section: 'string|null' },
  },
  {
    name: 'update_category',
    description: 'Rename category or move it to section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { category: 'string', name: 'string|null', section: 'string|null' },
  },
  {
    name: 'delete_category',
    description: 'Delete category.',
    risk: 'high',
    requiresConfirmation: true,
    input: { category: 'string' },
  },
  {
    name: 'create_section',
    description: 'Create section/group/context for money organization.',
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
    description: 'Delete section.',
    risk: 'high',
    requiresConfirmation: true,
    input: { section: 'string' },
  },
  {
    name: 'assign_category_to_section',
    description: 'Assign category to section.',
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
  return AI_TOOL_REGISTRY.map((tool) => `${tool.name}: ${JSON.stringify(tool.input)}`).join('\n');
}

import { AIToolDefinition } from './tool-types';

/**
 * Tool registry describes application capabilities only.
 * It must not contain phrase dictionaries, intent aliases, command examples,
 * regex-style hints, or language-specific trigger words.
 */
export const AI_TOOL_REGISTRY: AIToolDefinition[] = [
  {
    name: 'create_account',
    description: 'Create a financial account or money container.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      name: 'string',
      type: 'cash|card|savings|investment|null',
      currency: 'RUB|USD|EUR|VND|null',
      initialBalance: 'number|null',
    },
  },
  {
    name: 'update_account',
    description: 'Change an existing account name, type, currency, balance, or settings.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      account: 'string',
      name: 'string|null',
      type: 'cash|card|savings|investment|null',
      currency: 'RUB|USD|EUR|VND|null',
      balance: 'number|null',
    },
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
    description: 'Record a financial transaction. Determine income or expense from user meaning.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      kind: 'income|expense',
      amount: 'number',
      currency: 'RUB|USD|EUR|VND|null',
      account: 'string|null',
      category: 'string|null',
      section: 'string|null',
      description: 'string|null',
    },
  },
  {
    name: 'transfer_money',
    description: 'Move money between two accounts.',
    risk: 'high',
    requiresConfirmation: true,
    input: {
      fromAccount: 'string',
      toAccount: 'string',
      amount: 'number',
      currency: 'RUB|USD|EUR|VND|null',
      description: 'string|null',
    },
  },
  {
    name: 'create_category',
    description: 'Create a transaction category.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string', type: 'income|expense', section: 'string|null' },
  },
  {
    name: 'update_category',
    description: 'Change an existing category.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { category: 'string', name: 'string|null', section: 'string|null' },
  },
  {
    name: 'delete_category',
    description: 'Delete an existing category.',
    risk: 'high',
    requiresConfirmation: true,
    input: { category: 'string' },
  },
  {
    name: 'create_section',
    description: 'Create a section for organizing categories and transactions.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { name: 'string' },
  },
  {
    name: 'update_section',
    description: 'Change an existing section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { section: 'string', name: 'string' },
  },
  {
    name: 'delete_section',
    description: 'Delete an existing section.',
    risk: 'high',
    requiresConfirmation: true,
    input: { section: 'string' },
  },
  {
    name: 'assign_category_to_section',
    description: 'Attach a category to a section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { category: 'string', section: 'string' },
  },
  {
    name: 'show_accounts',
    description: 'Return user accounts.',
    risk: 'low',
    requiresConfirmation: false,
    input: {},
  },
  {
    name: 'show_transactions',
    description: 'Return recent transactions.',
    risk: 'low',
    requiresConfirmation: false,
    input: { limit: 'number|null' },
  },
];

export function getToolDefinition(name: string) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function getPlannerToolContract() {
  return AI_TOOL_REGISTRY.map((tool) => ({
    tool: tool.name,
    input: tool.input,
  }));
}

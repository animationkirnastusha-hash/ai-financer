import { AIToolDefinition } from './tool-types';

const stringOrNull = { type: ['string', 'null'] } as const;
const numberOrNull = { type: ['number', 'null'] } as const;

export const AI_TOOL_REGISTRY: AIToolDefinition[] = [
  {
    name: 'create_account',
    description: 'Create a money account/wallet/card/savings account. Use when the user wants a new place to store money.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        type: { enum: ['cash', 'card', 'savings', 'investment', null] },
        currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] },
        initialBalance: numberOrNull,
      },
      required: ['name', 'type', 'currency', 'initialBalance'],
    },
  },
  {
    name: 'update_account',
    description: 'Rename account, change account type, currency, visibility, or balance.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: {
        account: { type: 'string' },
        name: stringOrNull,
        type: { enum: ['cash', 'card', 'savings', 'investment', null] },
        currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] },
        balance: numberOrNull,
      },
      required: ['account', 'name', 'type', 'currency', 'balance'],
    },
  },
  {
    name: 'delete_account',
    description: 'Delete a specific account. Dangerous action.',
    risk: 'high',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: { account: { type: 'string' } },
      required: ['account'],
    },
  },
  {
    name: 'create_transaction',
    description: 'Create income or expense. Adding/depositing/putting money onto an account is income. Spending/buying/paying is expense.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { enum: ['income', 'expense'] },
        amount: { type: 'number' },
        currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] },
        account: stringOrNull,
        category: stringOrNull,
        section: stringOrNull,
        description: stringOrNull,
      },
      required: ['kind', 'amount', 'currency', 'account', 'category', 'section', 'description'],
    },
  },
  {
    name: 'transfer_money',
    description: 'Move money from one account to another account.',
    risk: 'high',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: {
        fromAccount: { type: 'string' },
        toAccount: { type: 'string' },
        amount: { type: 'number' },
        currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] },
        description: stringOrNull,
      },
      required: ['fromAccount', 'toAccount', 'amount', 'currency', 'description'],
    },
  },
  {
    name: 'create_category',
    description: 'Create income or expense category.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        type: { enum: ['income', 'expense'] },
        section: stringOrNull,
      },
      required: ['name', 'type', 'section'],
    },
  },
  {
    name: 'update_category',
    description: 'Rename category or move category to section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: { category: { type: 'string' }, name: stringOrNull, section: stringOrNull },
      required: ['category', 'name', 'section'],
    },
  },
  {
    name: 'delete_category',
    description: 'Delete a category.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: false, properties: { category: { type: 'string' } }, required: ['category'] },
  },
  {
    name: 'create_section',
    description: 'Create a user section/group/context for money organization.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'update_section',
    description: 'Rename a section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: false, properties: { section: { type: 'string' }, name: { type: 'string' } }, required: ['section', 'name'] },
  },
  {
    name: 'delete_section',
    description: 'Delete a section but keep transactions/categories by unlinking section.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: false, properties: { section: { type: 'string' } }, required: ['section'] },
  },
  {
    name: 'assign_category_to_section',
    description: 'Assign/move a category to a section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: false, properties: { category: { type: 'string' }, section: { type: 'string' } }, required: ['category', 'section'] },
  },
  {
    name: 'show_accounts',
    description: 'Show/list user accounts.',
    risk: 'low',
    requiresConfirmation: false,
    input: { type: 'object', additionalProperties: false, properties: {}, required: [] },
  },
  {
    name: 'show_transactions',
    description: 'Show/list recent transactions.',
    risk: 'low',
    requiresConfirmation: false,
    input: { type: 'object', additionalProperties: false, properties: { limit: { type: ['number', 'null'] } }, required: ['limit'] },
  },
];

export function getToolDefinition(name: string) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

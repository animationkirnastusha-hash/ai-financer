import { AIToolDefinition } from './tool-types';

const stringOrNull = { type: ['string', 'null'] } as const;
const numberOrNull = { type: ['number', 'null'] } as const;
const currencyOrNull = { enum: ['RUB', 'USD', 'EUR', 'VND', null] } as const;
const accountTypeOrNull = { enum: ['cash', 'card', 'savings', 'investment', null] } as const;

export const AI_TOOL_REGISTRY: AIToolDefinition[] = [
  {
    name: 'create_account',
    description: 'Create a money account, wallet, card, savings account or investment account. Name must be only the user-facing label, not command words.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: { name: { type: 'string' }, type: accountTypeOrNull, currency: currencyOrNull, initialBalance: numberOrNull },
      required: ['name', 'type', 'currency', 'initialBalance'],
    },
  },
  {
    name: 'update_account',
    description: 'Rename account, change account type, currency, visibility or balance.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: { account: { type: 'string' }, name: stringOrNull, type: accountTypeOrNull, currency: currencyOrNull, balance: numberOrNull },
      required: ['account', 'name', 'type', 'currency', 'balance'],
    },
  },
  {
    name: 'delete_account',
    description: 'Delete a specific account. Dangerous action.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: false, properties: { account: { type: 'string' } }, required: ['account'] },
  },
  {
    name: 'create_transaction',
    description: 'Create income or expense. Depositing, adding, topping up, assigning balance to account is income. Buying, spending or paying is expense.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { enum: ['income', 'expense'] },
        amount: { type: ['number', 'string'] },
        currency: currencyOrNull,
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
      properties: { fromAccount: { type: 'string' }, toAccount: { type: 'string' }, amount: { type: ['number', 'string'] }, currency: currencyOrNull, description: stringOrNull },
      required: ['fromAccount', 'toAccount', 'amount', 'currency', 'description'],
    },
  },
  {
    name: 'create_category',
    description: 'Create income or expense category.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, type: { enum: ['income', 'expense'] }, section: stringOrNull }, required: ['name', 'type', 'section'] },
  },
  {
    name: 'update_category',
    description: 'Rename category or move category to section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: false, properties: { category: { type: 'string' }, name: stringOrNull, section: stringOrNull }, required: ['category', 'name', 'section'] },
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
    description: 'Assign or move a category to a section.',
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

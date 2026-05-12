import { AIToolDefinition } from './tool-types';

const stringOrNull = { type: ['string', 'null'] } as const;
const numberOrStringOrNull = { type: ['number', 'string', 'null'] } as const;

export const AI_TOOL_REGISTRY: AIToolDefinition[] = [
  {
    name: 'create_account',
    description: 'Create a new account/wallet/card/cash/savings/investment account.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: true,
      properties: {
        name: { type: 'string' },
        type: { enum: ['cash', 'card', 'savings', 'investment', null] },
        currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] },
        initialBalance: numberOrStringOrNull,
        amountText: stringOrNull,
      },
    },
  },
  {
    name: 'update_account',
    description: 'Rename account, change account type/currency/balance/settings.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: true,
      properties: {
        account: { type: 'string' },
        name: stringOrNull,
        type: { enum: ['cash', 'card', 'savings', 'investment', null] },
        currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] },
        balance: numberOrStringOrNull,
        amountText: stringOrNull,
      },
    },
  },
  {
    name: 'delete_account',
    description: 'Delete a specific account.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { account: { type: 'string' } } },
  },
  {
    name: 'create_transaction',
    description: 'Create income or expense. Deposits/top-ups/put money onto account are income. Purchases/spending/payments are expense.',
    risk: 'medium',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: true,
      properties: {
        kind: { enum: ['income', 'expense'] },
        amount: numberOrStringOrNull,
        amountText: stringOrNull,
        currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] },
        account: stringOrNull,
        category: stringOrNull,
        section: stringOrNull,
        description: stringOrNull,
      },
    },
  },
  {
    name: 'transfer_money',
    description: 'Move money from one account to another account.',
    risk: 'high',
    requiresConfirmation: true,
    input: {
      type: 'object',
      additionalProperties: true,
      properties: {
        fromAccount: { type: 'string' },
        toAccount: { type: 'string' },
        amount: numberOrStringOrNull,
        amountText: stringOrNull,
        currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] },
        description: stringOrNull,
      },
    },
  },
  {
    name: 'create_category',
    description: 'Create income or expense category.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { name: { type: 'string' }, type: { enum: ['income', 'expense'] }, section: stringOrNull } },
  },
  {
    name: 'update_category',
    description: 'Rename category or move category to section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { category: { type: 'string' }, name: stringOrNull, section: stringOrNull } },
  },
  {
    name: 'delete_category',
    description: 'Delete a category.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { category: { type: 'string' } } },
  },
  {
    name: 'create_section',
    description: 'Create a money organization section/context.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { name: { type: 'string' } } },
  },
  {
    name: 'update_section',
    description: 'Rename a section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { section: { type: 'string' }, name: { type: 'string' } } },
  },
  {
    name: 'delete_section',
    description: 'Delete a section but keep transactions/categories by unlinking section.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { section: { type: 'string' } } },
  },
  {
    name: 'assign_category_to_section',
    description: 'Assign/move a category to a section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { category: { type: 'string' }, section: { type: 'string' } } },
  },
  {
    name: 'show_accounts',
    description: 'Show/list user accounts.',
    risk: 'low',
    requiresConfirmation: false,
    input: { type: 'object', additionalProperties: true, properties: {} },
  },
  {
    name: 'show_transactions',
    description: 'Show/list recent transactions.',
    risk: 'low',
    requiresConfirmation: false,
    input: { type: 'object', additionalProperties: true, properties: { limit: { type: ['number', 'null'] } } },
  },
];

export function getToolDefinition(name: string) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function buildToolCatalogPrompt() {
  return AI_TOOL_REGISTRY
    .map((tool) => {
      const fields = Object.keys((tool.input.properties ?? {}) as Record<string, unknown>);
      return `- ${tool.name}: ${tool.description} Fields: ${fields.join(', ') || 'none'}. Risk: ${tool.risk}.`;
    })
    .join('\n');
}

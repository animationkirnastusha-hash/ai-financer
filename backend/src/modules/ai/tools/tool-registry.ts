import { AIToolDefinition } from './tool-types';

const stringOrNull = { type: ['string', 'null'] } as const;
const numberOrStringOrNull = { type: ['number', 'string', 'null'] } as const;

export const AI_TOOL_REGISTRY: AIToolDefinition[] = [
  {
    name: 'create_account',
    description: 'Create account/wallet/card/cash/savings. Fields: name,type,currency,initialBalance,amountText.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { name: { type: 'string' }, type: { enum: ['cash', 'card', 'savings', 'investment', null] }, currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] }, initialBalance: numberOrStringOrNull, amountText: stringOrNull } },
  },
  {
    name: 'update_account',
    description: 'Rename/change account type/currency/balance. Fields: account,name,type,currency,balance,amountText.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { account: { type: 'string' }, name: stringOrNull, type: { enum: ['cash', 'card', 'savings', 'investment', null] }, currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] }, balance: numberOrStringOrNull, amountText: stringOrNull } },
  },
  {
    name: 'delete_account',
    description: 'Delete account. Fields: account.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { account: { type: 'string' } } },
  },
  {
    name: 'create_transaction',
    description: 'Create income/expense. Deposit/top-up/put/add money to account = income. Buy/spend/pay = expense. Fields: kind,amount,amountText,currency,account,category,section,description.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { kind: { enum: ['income', 'expense'] }, amount: numberOrStringOrNull, amountText: stringOrNull, currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] }, account: stringOrNull, category: stringOrNull, section: stringOrNull, description: stringOrNull } },
  },
  {
    name: 'transfer_money',
    description: 'Transfer between accounts. Fields: fromAccount,toAccount,amount,amountText,currency,description.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { fromAccount: { type: 'string' }, toAccount: { type: 'string' }, amount: numberOrStringOrNull, amountText: stringOrNull, currency: { enum: ['RUB', 'USD', 'EUR', 'VND', null] }, description: stringOrNull } },
  },
  {
    name: 'create_category',
    description: 'Create category. Fields: name,type,section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { name: { type: 'string' }, type: { enum: ['income', 'expense'] }, section: stringOrNull } },
  },
  {
    name: 'update_category',
    description: 'Rename/move category. Fields: category,name,section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { category: { type: 'string' }, name: stringOrNull, section: stringOrNull } },
  },
  {
    name: 'delete_category',
    description: 'Delete category. Fields: category.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { category: { type: 'string' } } },
  },
  {
    name: 'create_section',
    description: 'Create section. Fields: name.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { name: { type: 'string' } } },
  },
  {
    name: 'update_section',
    description: 'Rename section. Fields: section,name.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { section: { type: 'string' }, name: { type: 'string' } } },
  },
  {
    name: 'delete_section',
    description: 'Delete section. Fields: section.',
    risk: 'high',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { section: { type: 'string' } } },
  },
  {
    name: 'assign_category_to_section',
    description: 'Move category to section. Fields: category,section.',
    risk: 'medium',
    requiresConfirmation: true,
    input: { type: 'object', additionalProperties: true, properties: { category: { type: 'string' }, section: { type: 'string' } } },
  },
  {
    name: 'show_accounts',
    description: 'Show/list accounts. Fields: none.',
    risk: 'low',
    requiresConfirmation: false,
    input: { type: 'object', additionalProperties: true, properties: {} },
  },
  {
    name: 'show_transactions',
    description: 'Show/list transactions. Fields: limit.',
    risk: 'low',
    requiresConfirmation: false,
    input: { type: 'object', additionalProperties: true, properties: { limit: { type: ['number', 'null'] } } },
  },
];

export function getToolDefinition(name: string) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function buildToolCatalogPrompt() {
  return AI_TOOL_REGISTRY.map((tool) => `- ${tool.name}: ${tool.description}`).join('\n');
}

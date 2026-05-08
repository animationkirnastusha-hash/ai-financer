import type { AIParsedCommand } from '../types';
import type { AIToolCall } from './tool-types';

export interface AIToolMemorySnapshot {
  lastAccountName?: string;
  lastSectionName?: string;
  lastCategoryName?: string;
  lastTransactionType?: 'income' | 'expense';
  lastAmount?: number;
}

function getArg(call: AIToolCall, key: string) {
  const value = call.args?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getAmount(call: AIToolCall) {
  const raw = call.args?.amount ?? call.args?.initialBalance ?? call.args?.balance;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function buildToolMemoryFromCalls(toolCalls: AIToolCall[] = []): AIToolMemorySnapshot {
  const memory: AIToolMemorySnapshot = {};

  for (const call of toolCalls) {
    if (call.tool === 'create_account') {
      memory.lastAccountName = getArg(call, 'name') || getArg(call, 'accountName') || memory.lastAccountName;
    }

    if (call.tool === 'create_section') {
      memory.lastSectionName = getArg(call, 'name') || getArg(call, 'sectionName') || memory.lastSectionName;
    }

    if (call.tool === 'create_category') {
      memory.lastCategoryName = getArg(call, 'name') || getArg(call, 'category') || memory.lastCategoryName;
      memory.lastSectionName = getArg(call, 'sectionName') || memory.lastSectionName;
    }

    if (call.tool === 'create_transaction') {
      memory.lastAccountName = getArg(call, 'accountName') || memory.lastAccountName;
      memory.lastSectionName = getArg(call, 'sectionName') || memory.lastSectionName;
      memory.lastCategoryName = getArg(call, 'category') || getArg(call, 'rawCategory') || memory.lastCategoryName;
      memory.lastAmount = getAmount(call) || memory.lastAmount;
      const type = getArg(call, 'type');
      if (type === 'income' || type === 'expense') memory.lastTransactionType = type;
    }

    if (call.tool === 'transfer_money') {
      memory.lastAccountName = getArg(call, 'toAccountName') || getArg(call, 'to') || memory.lastAccountName;
      memory.lastAmount = getAmount(call) || memory.lastAmount;
    }
  }

  return memory;
}

export function buildToolMemoryFromParsed(command: AIParsedCommand): AIToolMemorySnapshot {
  const memory: AIToolMemorySnapshot = {};

  const visit = (item: AIParsedCommand) => {
    if (item.intent === 'batch') {
      item.actions.forEach(visit);
      return;
    }

    if (item.intent === 'create_account') {
      memory.lastAccountName = item.name;
    }

    if (item.intent === 'create_section') {
      memory.lastSectionName = item.name;
    }

    if (item.intent === 'create_category') {
      memory.lastCategoryName = item.name;
      memory.lastSectionName = item.sectionName || memory.lastSectionName;
    }

    if (item.intent === 'income' || item.intent === 'expense') {
      memory.lastTransactionType = item.intent;
      memory.lastAmount = item.amount;
      memory.lastAccountName = item.accountName || memory.lastAccountName;
      memory.lastSectionName = item.sectionName || memory.lastSectionName;
      memory.lastCategoryName = item.rawCategory || memory.lastCategoryName;
    }

    if (item.intent === 'transfer') {
      memory.lastAmount = item.amount;
      memory.lastAccountName = item.toAccountName || memory.lastAccountName;
    }
  };

  visit(command);
  return memory;
}

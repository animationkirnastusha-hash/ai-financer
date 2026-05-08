import type { AIToolMemorySnapshot } from './tool-memory';

export interface AIToolContextMessage {
  role: string;
  content: string;
}

export interface AIToolContext {
  historyText: string;
  memory: AIToolMemorySnapshot;
}

function normalizeRole(role: string) {
  return role === 'user' ? 'Пользователь' : 'AI';
}

export function buildToolContext(history: AIToolContextMessage[] = [], memory: AIToolMemorySnapshot = {}): AIToolContext {
  const compactHistory = history
    .slice(-8)
    .map((message) => `${normalizeRole(message.role)}: ${message.content}`)
    .join('\n');

  return {
    historyText: compactHistory,
    memory,
  };
}

export function buildToolContextPrompt(context: AIToolContext) {
  const memoryLines = [
    context.memory.lastAccountName ? `lastAccountName: ${context.memory.lastAccountName}` : '',
    context.memory.lastSectionName ? `lastSectionName: ${context.memory.lastSectionName}` : '',
    context.memory.lastCategoryName ? `lastCategoryName: ${context.memory.lastCategoryName}` : '',
    context.memory.lastTransactionType ? `lastTransactionType: ${context.memory.lastTransactionType}` : '',
    context.memory.lastAmount ? `lastAmount: ${context.memory.lastAmount}` : '',
  ].filter(Boolean);

  return `
DIALOG CONTEXT:
${context.historyText || 'Истории пока нет.'}

SHORT MEMORY:
${memoryLines.length ? memoryLines.join('\n') : 'Пока нет явных сущностей.'}

Правила контекста:
- «туда», «на него», «на этот счёт» связывай с последним явно созданным или упомянутым счётом.
- «ещё», «так же», «повтори» связывай с последней операцией, но не выдумывай сумму, если её нет.
- если не хватает критичного поля, верни toolCalls: [] и один короткий уточняющий вопрос.
`;
}

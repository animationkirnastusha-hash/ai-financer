import type { MessageEntity } from '@/entities/message/model/message.types';

export function createUserMessage(text: string): MessageEntity {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    kind: 'text',
    text,
    createdAt: new Date().toISOString(),
  };
}

export function createTemporaryAssistantMessage(
  text = 'Думаю...',
): MessageEntity {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    kind: 'text',
    text,
    createdAt: new Date().toISOString(),
  };
}
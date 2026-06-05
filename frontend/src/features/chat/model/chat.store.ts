import { create } from 'zustand';
import type { MessageEntity } from '@/entities/message/model/message.types';

type MessagesUpdater = MessageEntity[] | ((messages: MessageEntity[]) => MessageEntity[]);

type ChatState = {
  messages: MessageEntity[];
  isSending: boolean;
  error: string | null;
  setMessages: (value: MessagesUpdater) => void;
  appendMessage: (message: MessageEntity) => void;
  replaceLastAssistantMessage: (message: MessageEntity) => void;
  setIsSending: (value: boolean) => void;
  setError: (value: string | null) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isSending: false,
  error: null,

  setMessages: (value) =>
    set((state) => ({
      messages: typeof value === 'function' ? value(state.messages) : value,
    })),

  appendMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  replaceLastAssistantMessage: (message) =>
    set((state) => {
      const next = [...state.messages];
      const reverseIndex = [...next]
        .reverse()
        .findIndex((item) => item.role === 'assistant');

      if (reverseIndex === -1) {
        next.push(message);
        return { messages: next };
      }

      const index = next.length - 1 - reverseIndex;
      next[index] = message;

      return { messages: next };
    }),

  setIsSending: (value) => set({ isSending: value }),
  setError: (value) => set({ error: value }),
}));

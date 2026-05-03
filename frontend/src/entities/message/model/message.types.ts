export type MessageRole = 'user' | 'assistant';

export type MessageKind =
  | 'text'
  | 'preview'
  | 'success'
  | 'error'
  | 'pending';

export type MessageEntity = {
  id: string;
  role: MessageRole;
  kind: MessageKind;
  text: string;
  createdAt: string;

  actionId?: string;
  actionType?: string;
  data?: Record<string, unknown>;
};
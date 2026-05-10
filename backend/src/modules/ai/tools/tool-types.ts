import { AIToolCall, AIToolName } from '../types';

export type { AIToolCall, AIToolName };

export interface AIToolDefinition {
  name: AIToolName;
  description: string;
  input: Record<string, unknown>;
  risk: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
}

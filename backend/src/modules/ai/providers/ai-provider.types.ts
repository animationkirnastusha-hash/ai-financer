export type AIProviderMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AIProviderRequest = {
  messages: AIProviderMessage[];
  temperature?: number;
  model?: string;
  format?: unknown;
};

export type AIProviderResponse = {
  content: string;
};

export interface AIProvider {
  complete(request: AIProviderRequest): Promise<AIProviderResponse>;
}

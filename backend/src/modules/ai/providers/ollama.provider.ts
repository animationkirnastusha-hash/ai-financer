import { env } from '../../../config/env';
import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
} from './ai-provider.types';

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

export class OllamaProvider implements AIProvider {
  async complete(request: AIProviderRequest): Promise<AIProviderResponse> {
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, env.aiLlmTimeoutMs || 4500);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${env.ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model || env.ollamaModel,
          stream: false,
          format: 'json',
          options: {
            temperature: request.temperature ?? 0.05,
            num_predict: 700,
          },
          messages: request.messages,
        }),
      });

      const payload = (await response.json()) as OllamaChatResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'Ollama request failed');
      }

      const content = payload.message?.content?.trim();

      if (!content) {
        throw new Error('Ollama returned empty message');
      }

      return { content };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
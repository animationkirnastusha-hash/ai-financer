import { env } from '../../../config/env';
import { AIProvider, AIProviderJsonRequest } from './ai-provider.types';

function stripCodeFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

export class OllamaProvider implements AIProvider {
  async generateJson<T>(request: AIProviderJsonRequest): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? env.aiLlmTimeoutMs);

    try {
      const response = await fetch(`${env.ollamaBaseUrl.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: env.ollamaModel,
          system: request.system,
          prompt: request.prompt,
          stream: false,
          format: request.schema,
          options: {
            temperature: request.temperature ?? 0.1,
            num_ctx: 8192,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as { response?: string };
      const raw = stripCodeFences(payload.response ?? '');
      if (!raw) throw new Error('Ollama returned empty response');

      return JSON.parse(raw) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

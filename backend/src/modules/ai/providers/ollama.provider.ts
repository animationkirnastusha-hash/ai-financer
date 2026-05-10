import { env } from '../../../config/env';
import { AIProvider, AIProviderJsonRequest } from './ai-provider.types';

function stripCodeFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function normalizeOllamaBaseUrl(value: string | undefined) {
  const fallback = 'http://127.0.0.1:11434';
  const raw = (value || fallback).trim() || fallback;

  // The env must be the Ollama host, not the API endpoint.
  // Accept both variants safely:
  //   http://127.0.0.1:11434
  //   http://127.0.0.1:11434/api
  return raw.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function getOllamaModel() {
  return (env.ollamaModel || 'qwen3:8b').trim();
}

async function readErrorBody(response: Response) {
  try {
    const text = await response.text();
    if (!text) return '';

    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

export class OllamaProvider implements AIProvider {
  async generateJson<T>(request: AIProviderJsonRequest): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? env.aiLlmTimeoutMs);

    const baseUrl = normalizeOllamaBaseUrl(env.ollamaBaseUrl);
    const model = getOllamaModel();
    const url = `${baseUrl}/api/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
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
        const body = await readErrorBody(response);
        const hint = response.status === 404
          ? ` Проверь: OLLAMA_BASE_URL=${baseUrl}, OLLAMA_MODEL=${model}. Команды: curl ${baseUrl}/api/tags и ollama list.`
          : '';

        throw new Error(
          `Ollama request failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}.${hint}`,
        );
      }

      const payload = (await response.json()) as { response?: string };
      const raw = stripCodeFences(payload.response ?? '');
      if (!raw) throw new Error('Ollama returned empty response');

      return JSON.parse(raw) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama request timeout. Проверь, что модель ${model} запущена и сервер отвечает: ${baseUrl}/api/tags`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

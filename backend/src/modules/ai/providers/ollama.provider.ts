import { env } from '../../../config/env';
import { AIProvider, AIProviderJsonRequest } from './ai-provider.types';

function stripCodeFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function stripThinking(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/"thinking"\s*:\s*"[\s\S]*?"\s*,?/gi, '')
    .trim();
}

function extractJsonObject(value: string) {
  const cleaned = stripCodeFences(stripThinking(value));

  if (!cleaned) return '';

  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return cleaned;
  }

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');

  if (first >= 0 && last > first) {
    return cleaned.slice(first, last + 1);
  }

  return cleaned;
}

function normalizeOllamaBaseUrl(value: string | undefined) {
  const fallback = 'http://127.0.0.1:11434';
  const raw = (value || fallback).trim() || fallback;

  return raw.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function getOllamaModel() {
  return (env.ollamaModel || 'qwen3:4b').trim();
}

function getTimeoutMs(request: AIProviderJsonRequest) {
  return Math.max(30_000, request.timeoutMs ?? env.aiLlmTimeoutMs ?? 120_000);
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
    const timeoutMs = getTimeoutMs(request);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const baseUrl = normalizeOllamaBaseUrl(env.ollamaBaseUrl);
    const model = getOllamaModel();
    const url = `${baseUrl}/api/generate`;

    try {
      const startedAt = Date.now();

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          system: [
            request.system,
            '',
            'Return ONLY valid JSON.',
            'Do not include markdown.',
            'Do not include explanations.',
            'Do not include <think> blocks.',
          ].filter(Boolean).join('\n'),
          prompt: request.prompt,
          stream: false,
          format: request.schema || 'json',
          options: {
            temperature: request.temperature ?? 0,
            top_p: 0.8,
            repeat_penalty: 1.05,
            num_ctx: 4096,
            num_predict: 700,
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

      const payload = (await response.json()) as {
        response?: string;
        thinking?: string;
        total_duration?: number;
      };

      const rawText = payload.response ?? '';
      const rawJson = extractJsonObject(rawText);

      if (!rawJson) {
        console.error('[OLLAMA] Empty JSON response', {
          model,
          elapsedMs: Date.now() - startedAt,
          responsePreview: rawText.slice(0, 500),
        });

        throw new Error('Ollama returned empty response');
      }

      try {
        return JSON.parse(rawJson) as T;
      } catch (parseError) {
        console.error('[OLLAMA] JSON parse failed', {
          model,
          elapsedMs: Date.now() - startedAt,
          responsePreview: rawText.slice(0, 1200),
          extractedPreview: rawJson.slice(0, 1200),
        });

        throw parseError;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Ollama request timeout after ${timeoutMs}ms. Проверь модель ${model}: curl ${baseUrl}/api/tags`,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

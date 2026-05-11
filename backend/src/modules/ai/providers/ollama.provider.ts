import { env } from '../../../config/env';
import { AIProvider, AIProviderJsonRequest } from './ai-provider.types';

type OllamaGenerateResponse = {
  response?: string;
  thinking?: string;
  error?: string;
};

function normalizeBaseUrl(value: string | undefined) {
  const fallback = 'http://127.0.0.1:11434';
  const raw = (value || fallback).trim() || fallback;

  return raw.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function getModel() {
  return (env.ollamaModel || 'qwen3:4b').trim();
}

function getTimeoutMs(request: AIProviderJsonRequest) {
  return Math.max(30_000, request.timeoutMs ?? env.aiLlmTimeoutMs ?? 90_000);
}

function stripThinking(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function stripCodeFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractJson(value: string) {
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

async function readError(response: Response) {
  try {
    const text = await response.text();
    if (!text) return response.statusText;

    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return response.statusText;
  }
}

export class OllamaProvider implements AIProvider {
  async generateJson<T>(request: AIProviderJsonRequest): Promise<T> {
    const baseUrl = normalizeBaseUrl(env.ollamaBaseUrl);
    const model = getModel();
    const timeoutMs = getTimeoutMs(request);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const system = [
      '/no_think',
      request.system,
      '',
      'Return ONLY compact valid JSON.',
      'No markdown.',
      'No explanations.',
      'No <think>.',
    ].filter(Boolean).join('\n');

    try {
      const startedAt = Date.now();

      console.log('[OLLAMA] generateJson:start', {
        model,
        timeoutMs,
        baseUrl,
      });

      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          system,
          prompt: `/no_think\n${request.prompt}`,
          stream: false,
          think: false,
          format: request.schema || 'json',
          keep_alive: '10m',
          options: {
            temperature: request.temperature ?? 0,
            top_p: 0.7,
            repeat_penalty: 1.08,
            num_ctx: 4096,
            num_predict: 280,
          },
        }),
      });

      if (!response.ok) {
        const error = await readError(response);
        throw new Error(`Ollama request failed: ${response.status} ${error}`);
      }

      const payload = (await response.json()) as OllamaGenerateResponse;

      const raw = payload.response ?? '';
      const json = extractJson(raw);

      console.log('[OLLAMA] generateJson:done', {
        model,
        elapsedMs: Date.now() - startedAt,
        hasRaw: Boolean(raw),
        hasJson: Boolean(json),
      });

      if (!json) {
        console.error('[OLLAMA] no json response', {
          rawPreview: raw.slice(0, 1200),
          thinkingPreview: payload.thinking?.slice(0, 500),
        });

        throw new Error('Ollama returned no JSON');
      }

      try {
        return JSON.parse(json) as T;
      } catch (error) {
        console.error('[OLLAMA] json parse failed', {
          rawPreview: raw.slice(0, 1200),
          extractedPreview: json.slice(0, 1200),
        });

        throw error;
      }
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

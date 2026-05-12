import { env } from '../../../config/env';
import { AIProvider, AIProviderJsonRequest } from './ai-provider.types';

type OllamaGenerateResponse = {
  response?: string;
  thinking?: string;
  error?: string;
  done_reason?: string;
};

function normalizeBaseUrl(value: string | undefined) {
  const fallback = 'http://127.0.0.1:11434';
  const raw = (value || fallback).trim() || fallback;
  return raw.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function getModel() {
  return (env.ollamaModel || 'qwen2.5:3b').trim();
}

function getTimeoutMs(request: AIProviderJsonRequest) {
  return Math.max(15_000, request.timeoutMs ?? env.aiLlmTimeoutMs ?? 45_000);
}

function getNumCtx(request: AIProviderJsonRequest) {
  return Math.max(512, Math.min(request.numCtx ?? env.ollamaNumCtx ?? 1024, 2048));
}

function getNumPredict(request: AIProviderJsonRequest) {
  return Math.max(64, Math.min(request.numPredict ?? env.ollamaNumPredict ?? 160, 256));
}

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

function stripCodeFences(value: string) {
  return value.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

function extractJson(value: string) {
  const cleaned = stripCodeFences(stripThinking(value));
  if (!cleaned) return '';
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1);

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
    const numCtx = getNumCtx(request);
    const numPredict = getNumPredict(request);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const system = [
      request.system.trim(),
      'Return valid minified JSON only.',
    ].filter(Boolean).join('\n');

    try {
      const startedAt = Date.now();
      console.log('[OLLAMA] generateJson:start', {
        model,
        timeoutMs,
        baseUrl,
        numCtx,
        numPredict,
        format: 'json',
        promptChars: request.prompt.length,
      });

      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          system,
          prompt: request.prompt,
          stream: false,
          format: 'json',
          keep_alive: '2m',
          options: {
            temperature: request.temperature ?? 0,
            top_p: 0.4,
            repeat_penalty: 1.05,
            num_ctx: numCtx,
            num_predict: numPredict,
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
        doneReason: payload.done_reason,
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

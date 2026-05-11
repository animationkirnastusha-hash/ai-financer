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

function stripThinking(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*?<\/think>/gi, '')
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

  if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
    return cleaned;
  }

  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) return cleaned.slice(objectStart, objectEnd + 1);

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) return cleaned.slice(arrayStart, arrayEnd + 1);

  return '';
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
    const model = env.ollamaModel.trim() || 'qwen2.5:3b';
    const timeoutMs = Math.max(15_000, request.timeoutMs ?? env.aiLlmTimeoutMs);
    const numCtx = Math.max(512, request.numCtx ?? env.ollamaNumCtx);
    const numPredict = Math.max(128, request.numPredict ?? env.ollamaNumPredict);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const system = [
      request.system,
      '',
      'Return only one compact valid JSON object.',
      'Do not use markdown.',
      'Do not add explanations.',
      'Do not include comments.',
    ].filter(Boolean).join('\n');

    try {
      const startedAt = Date.now();
      console.log('[OLLAMA] generateJson:start', { model, timeoutMs, baseUrl, numCtx, numPredict, format: 'json' });

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
          keep_alive: '10m',
          options: {
            temperature: request.temperature ?? 0,
            top_p: 0.8,
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
          rawPreview: raw.slice(0, 1000),
          thinkingPreview: payload.thinking?.slice(0, 500),
        });
        throw new Error('Ollama returned no JSON');
      }

      try {
        return JSON.parse(json) as T;
      } catch (error) {
        console.error('[OLLAMA] json parse failed', {
          rawPreview: raw.slice(0, 1000),
          extractedPreview: json.slice(0, 1000),
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

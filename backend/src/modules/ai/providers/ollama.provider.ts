import { env } from '../../../config/env';
import { AIProvider, AIProviderJsonRequest } from './ai-provider.types';

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
  };
  response?: string;
  thinking?: string;
  error?: string;
  done_reason?: string;
};

const QWEN3_MAIN_MODEL = 'qwen3:14b-q4_K_M';

function normalizeBaseUrl(value: string | undefined) {
  const fallback = 'http://127.0.0.1:11434';
  const raw = (value || fallback).trim() || fallback;

  return raw.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function getModel() {
  return (env.ollamaModel || QWEN3_MAIN_MODEL).trim();
}

function getTimeoutMs(request: AIProviderJsonRequest) {
  return Math.max(30_000, request.timeoutMs ?? env.ollamaTimeoutMs ?? env.aiLlmTimeoutMs ?? 120_000);
}

function getNumCtx(request: AIProviderJsonRequest) {
  return Math.max(1024, Math.min(4096, request.numCtx ?? env.ollamaNumCtx ?? 2048));
}

function getNumPredict(request: AIProviderJsonRequest) {
  return Math.max(96, Math.min(512, request.numPredict ?? env.ollamaNumPredict ?? 220));
}

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
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

  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1);

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
    const model = getModel();
    const timeoutMs = getTimeoutMs(request);
    const numCtx = getNumCtx(request);
    const numPredict = getNumPredict(request);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const system = [
      request.system,
      'Return one compact valid JSON object only. No markdown. No prose outside JSON.',
    ].filter(Boolean).join('\n');

    try {
      const startedAt = Date.now();

      console.log('[OLLAMA] generateJson:start', {
        model,
        timeoutMs,
        baseUrl,
        endpoint: '/api/chat',
        think: false,
        numCtx,
        numPredict,
        format: 'json',
        promptChars: system.length + request.prompt.length,
      });

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: request.prompt },
          ],
          think: false,
          stream: false,
          format: 'json',
          keep_alive: '20m',
          options: {
            temperature: request.temperature ?? 0,
            top_p: 0.65,
            repeat_penalty: 1.04,
            num_ctx: numCtx,
            num_predict: numPredict,
          },
        }),
      });

      if (!response.ok) {
        const error = await readError(response);
        throw new Error(`Ollama request failed: ${response.status} ${error}`);
      }

      const payload = (await response.json()) as OllamaChatResponse;
      const raw = payload.message?.content ?? payload.response ?? '';
      const json = extractJson(raw);

      console.log('[OLLAMA] generateJson:done', {
        model,
        elapsedMs: Date.now() - startedAt,
        doneReason: payload.done_reason,
        hasRaw: Boolean(raw),
        hasJson: Boolean(json),
        hasThinking: Boolean(payload.message?.thinking || payload.thinking),
      });

      if (env.aiDebug) {
        console.log('[OLLAMA] raw preview', raw.slice(0, 1600));
        const thinking = payload.message?.thinking ?? payload.thinking ?? '';
        if (thinking) console.log('[OLLAMA] thinking preview', thinking.slice(0, 800));
      }

      if (!json) {
        throw new Error('Ollama returned no JSON');
      }

      return JSON.parse(json) as T;
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

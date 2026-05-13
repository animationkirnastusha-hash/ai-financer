import { env } from '../../../config/env';
import { AIModelRole, AIProvider, AIProviderJsonRequest } from './ai-provider.types';

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

function normalizeBaseUrl(value: string | undefined) {
  const fallback = 'http://127.0.0.1:11434';
  const raw = (value || fallback).trim() || fallback;
  return raw.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function modelForRole(role: AIModelRole) {
  if (role === 'fast') return env.ollamaFastModel || env.ollamaModel;
  if (role === 'premium') return env.ollamaPremiumModel || env.ollamaFreeReasoningModel || env.ollamaModel;
  return env.ollamaFreeReasoningModel || env.ollamaModel;
}

function fallbackRole(role: AIModelRole): AIModelRole | null {
  if (role === 'premium') return 'base';
  if (role === 'base') return 'fast';
  return null;
}

function getTimeoutMs(request: AIProviderJsonRequest, role: AIModelRole) {
  const fallback = role === 'fast' ? 15_000 : env.ollamaTimeoutMs ?? env.aiLlmTimeoutMs ?? 60_000;
  return Math.max(5_000, request.timeoutMs ?? fallback);
}

function getNumCtx(request: AIProviderJsonRequest, role: AIModelRole) {
  const fallback = role === 'fast' ? 768 : env.ollamaNumCtx ?? 1536;
  return Math.max(256, Math.min(4096, request.numCtx ?? fallback));
}

function getNumPredict(request: AIProviderJsonRequest, role: AIModelRole) {
  const fallback = role === 'fast' ? 96 : env.ollamaNumPredict ?? 128;
  return Math.max(16, Math.min(512, request.numPredict ?? fallback));
}

function keepAliveForRole(role: AIModelRole) {
  if (role === 'fast') return '1h';
  if (role === 'premium') return '2m';
  return '20m';
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
    const role = request.modelRole ?? 'base';

    try {
      return await this.generateJsonWithRole<T>(request, role);
    } catch (error) {
      const fallback = fallbackRole(role);
      if (!fallback) throw error;

      console.warn('[OLLAMA] generateJson:fallback', {
        fromRole: role,
        toRole: fallback,
        reason: error instanceof Error ? error.message : String(error),
      });

      return this.generateJsonWithRole<T>(request, fallback);
    }
  }

  private async generateJsonWithRole<T>(request: AIProviderJsonRequest, role: AIModelRole): Promise<T> {
    const baseUrl = normalizeBaseUrl(env.ollamaBaseUrl);
    const model = modelForRole(role).trim();
    const timeoutMs = getTimeoutMs(request, role);
    const numCtx = getNumCtx(request, role);
    const numPredict = getNumPredict(request, role);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const system = [
      request.system,
      'Return one compact valid JSON object only. No markdown. No prose outside JSON. No <think>.',
    ].filter(Boolean).join('\n');

    try {
      const startedAt = Date.now();

      console.log('[OLLAMA] generateJson:start', {
        role,
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
          keep_alive: keepAliveForRole(role),
          options: {
            temperature: request.temperature ?? 0,
            top_p: role === 'fast' ? 0.25 : 0.65,
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
        role,
        model,
        elapsedMs: Date.now() - startedAt,
        doneReason: payload.done_reason,
        hasRaw: Boolean(raw),
        hasJson: Boolean(json),
        hasThinking: Boolean(payload.message?.thinking || payload.thinking || /<think>/i.test(raw)),
      });

      if (env.aiDebug) {
        console.log('[OLLAMA] raw preview', raw.slice(0, 1600));
        const thinking = payload.message?.thinking ?? payload.thinking ?? '';
        if (thinking) console.log('[OLLAMA] thinking preview', thinking.slice(0, 800));
      }

      if (!json) throw new Error('Ollama returned no JSON');
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

import { env } from '../../../config/env';
import { AIModelRole, AIProvider, AIProviderJsonRequest } from './ai-provider.types';

type DeepSeekChoice = {
  finish_reason?: string | null;
  message?: {
    role?: string;
    content?: string | null;
  };
};

type DeepSeekResponse = {
  id?: string;
  model?: string;
  choices?: DeepSeekChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
};

function normalizeBaseUrl(value: string | undefined) {
  const fallback = 'https://api.deepseek.com';
  const raw = (value || fallback).trim() || fallback;
  return raw.replace(/\/+$/, '');
}

function modelForRole(role: AIModelRole) {
  if (role === 'fast') return env.deepseekFastModel || env.deepseekModel;
  if (role === 'premium') return env.deepseekReasoningModel || env.deepseekModel;
  return env.deepseekModel || env.deepseekFastModel;
}

function timeoutForRole(request: AIProviderJsonRequest, role: AIModelRole) {
  if (request.timeoutMs) return Math.max(3_000, request.timeoutMs);
  return role === 'fast' ? env.aiFastTimeoutMs : env.aiLlmTimeoutMs;
}

function maxTokensForRole(request: AIProviderJsonRequest, role: AIModelRole) {
  const requested = request.numPredict;
  if (role === 'fast') return Math.max(64, Math.min(180, requested ?? 96));
  if (role === 'premium') return Math.max(180, Math.min(900, requested ?? 500));
  return Math.max(128, Math.min(600, requested ?? 300));
}

function stripCodeFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractJson(value: string) {
  const cleaned = stripCodeFences(value || '');
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
      const parsed = JSON.parse(text) as { error?: { message?: string; code?: string | number }; message?: string };
      return parsed.error?.message || parsed.error?.code || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return response.statusText;
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class DeepSeekProvider implements AIProvider {
  async generateJson<T>(request: AIProviderJsonRequest): Promise<T> {
    if (!env.deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY is not set');
    }

    const role = request.modelRole ?? 'base';
    const baseUrl = normalizeBaseUrl(env.deepseekBaseUrl);
    const model = modelForRole(role).trim();
    const timeoutMs = timeoutForRole(request, role);
    const maxTokens = maxTokensForRole(request, role);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    const system = [
      request.system,
      'Return valid JSON only. No markdown. No prose.',
    ].filter(Boolean).join('\n');

    try {
      console.log('[DEEPSEEK] generateJson:start', {
        role,
        model,
        timeoutMs,
        baseUrl,
        endpoint: '/chat/completions',
        maxTokens,
        promptChars: system.length + request.prompt.length,
      });

      let response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: request.prompt },
          ],
          temperature: request.temperature ?? 0,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok && [408, 429, 500, 502, 503, 504].includes(response.status)) {
        const firstError = await readError(response);
        console.warn('[DEEPSEEK] generateJson:retry', { role, model, status: response.status, reason: firstError });
        await delay(250);
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${env.deepseekApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: request.prompt },
            ],
            temperature: request.temperature ?? 0,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
          }),
        });
      }

      if (!response.ok) {
        const error = await readError(response);
        throw new Error(`DeepSeek request failed: ${response.status} ${error}`);
      }

      const payload = (await response.json()) as DeepSeekResponse;
      if (payload.error) {
        throw new Error(`DeepSeek response error: ${payload.error.message || payload.error.code || 'unknown error'}`);
      }

      const choice = payload.choices?.[0];
      const raw = choice?.message?.content ?? '';
      const json = extractJson(raw);

      console.log('[DEEPSEEK] generateJson:done', {
        role,
        model: payload.model || model,
        elapsedMs: Date.now() - startedAt,
        finishReason: choice?.finish_reason,
        hasRaw: Boolean(raw),
        hasJson: Boolean(json),
        totalTokens: payload.usage?.total_tokens,
      });

      if (env.aiDebug) {
        console.log('[DEEPSEEK] raw preview', raw.slice(0, 1600));
      }

      if (!json) throw new Error('DeepSeek returned no JSON');
      return JSON.parse(json) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`DeepSeek request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

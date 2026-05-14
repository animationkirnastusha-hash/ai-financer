import { env } from '../../../config/env';
import { AIModelRole, AIProvider, AIProviderJsonRequest } from './ai-provider.types';

type OpenRouterChoice = {
  finish_reason?: string | null;
  native_finish_reason?: string | null;
  message?: {
    role?: string;
    content?: string | null;
  };
  error?: {
    code?: number;
    message?: string;
    metadata?: Record<string, unknown>;
  };
};

type OpenRouterResponse = {
  id?: string;
  model?: string;
  choices?: OpenRouterChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  error?: {
    code?: number;
    message?: string;
    metadata?: Record<string, unknown>;
  };
};

function normalizeBaseUrl(value: string | undefined) {
  const fallback = 'https://openrouter.ai/api/v1';
  const raw = (value || fallback).trim() || fallback;
  return raw.replace(/\/+$/, '');
}

function modelForRole(role: AIModelRole) {
  if (role === 'fast') return env.openrouterFastModel || env.openrouterModel;
  if (role === 'premium') return env.openrouterReasoningModel || env.openrouterModel;
  return env.openrouterModel || env.openrouterFastModel;
}

function timeoutForRole(request: AIProviderJsonRequest, role: AIModelRole) {
  if (request.timeoutMs) return Math.max(3_000, request.timeoutMs);
  return role === 'fast' ? env.aiFastTimeoutMs : env.aiLlmTimeoutMs;
}

function maxTokensForRole(request: AIProviderJsonRequest, role: AIModelRole) {
  const requested = request.numPredict;
  if (role === 'fast') return Math.max(96, Math.min(320, requested ?? 180));
  if (role === 'premium') return Math.max(180, Math.min(800, requested ?? 420));
  return Math.max(128, Math.min(500, requested ?? 260));
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
      const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
      return parsed.error?.message || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return response.statusText;
  }
}

export class OpenRouterProvider implements AIProvider {
  async generateJson<T>(request: AIProviderJsonRequest): Promise<T> {
    if (!env.openrouterApiKey) {
      throw new Error('OPENROUTER_API_KEY is not set');
    }

    const role = request.modelRole ?? 'base';
    const baseUrl = normalizeBaseUrl(env.openrouterBaseUrl);
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
      console.log('[OPENROUTER] generateJson:start', {
        role,
        model,
        timeoutMs,
        baseUrl,
        endpoint: '/chat/completions',
        maxTokens,
        promptChars: system.length + request.prompt.length,
      });

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': env.frontendUrl,
          'X-OpenRouter-Title': env.openrouterAppTitle,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: request.prompt },
          ],
          temperature: request.temperature ?? 0,
          max_tokens: maxTokens,
          response_format: request.schema
            ? {
                type: 'json_schema',
                json_schema: {
                  name: 'ai_financer_response',
                  strict: true,
                  schema: request.schema,
                },
              }
            : { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const error = await readError(response);
        throw new Error(`OpenRouter request failed: ${response.status} ${error}`);
      }

      const payload = (await response.json()) as OpenRouterResponse;
      const choice = payload.choices?.[0];
      if (choice?.error) {
        throw new Error(`OpenRouter choice error: ${choice.error.message || choice.error.code || 'unknown error'}`);
      }

      const raw = choice?.message?.content ?? '';
      const json = extractJson(raw);

      console.log('[OPENROUTER] generateJson:done', {
        role,
        model: payload.model || model,
        elapsedMs: Date.now() - startedAt,
        finishReason: choice?.finish_reason,
        nativeFinishReason: choice?.native_finish_reason,
        hasRaw: Boolean(raw),
        hasJson: Boolean(json),
        totalTokens: payload.usage?.total_tokens,
        cost: payload.usage?.cost,
      });

      if (env.aiDebug) {
        console.log('[OPENROUTER] raw preview', raw.slice(0, 1600));
      }

      if (!json) throw new Error('OpenRouter returned no JSON');
      return JSON.parse(json) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

import { env } from '../../../config/env';
import { AIModelRole, AIProvider, AIProviderJsonRequest } from './ai-provider.types';

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

function normalizeBaseUrl(value: string | undefined) {
  const fallback = 'https://api.deepseek.com';
  const raw = (value || fallback).trim() || fallback;
  return raw.replace(/\/+$/, '').replace(/\/v1$/i, '');
}

function modelForRole(role: AIModelRole) {
  if (role === 'premium') return env.deepseekReasoningModel || env.deepseekModel || 'deepseek-chat';
  return env.deepseekFastModel || env.deepseekModel || 'deepseek-chat';
}

function timeoutForRole(request: AIProviderJsonRequest, role: AIModelRole) {
  const fallback = role === 'fast' ? env.aiFastTimeoutMs : env.aiLlmTimeoutMs;
  return Math.max(3_000, request.timeoutMs ?? fallback);
}

function maxTokensForRole(request: AIProviderJsonRequest, role: AIModelRole) {
  const requested = request.numPredict;
  if (requested) return Math.max(16, Math.min(1024, requested));
  if (role === 'fast') return 160;
  if (role === 'premium') return 900;
  return 500;
}

function stripCodeFences(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
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
      const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
      return parsed.error?.message || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return response.statusText;
  }
}

export class DeepSeekProvider implements AIProvider {
  async generateJson<T>(request: AIProviderJsonRequest): Promise<T> {
    const role = request.modelRole ?? 'base';
    const apiKey = env.deepseekApiKey;

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is missing');
    }

    const baseUrl = normalizeBaseUrl(env.deepseekBaseUrl);
    const model = modelForRole(role).trim();
    const timeoutMs = timeoutForRole(request, role);
    const maxTokens = maxTokensForRole(request, role);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const system = [request.system, 'Return valid JSON only. No markdown. No prose.']
      .filter(Boolean)
      .join('\n');

    try {
      const startedAt = Date.now();

      console.log('[DEEPSEEK] generateJson:start', {
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
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: request.temperature ?? 0,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: request.prompt },
          ],
        }),
      });

      if (!response.ok) {
        const error = await readError(response);
        throw new Error(`DeepSeek request failed: ${response.status} ${error}`);
      }

      const payload = (await response.json()) as DeepSeekChatResponse;
      const raw = payload.choices?.[0]?.message?.content ?? '';
      const json = extractJson(raw);

      console.log('[DEEPSEEK] generateJson:done', {
        role,
        model,
        elapsedMs: Date.now() - startedAt,
        finishReason: payload.choices?.[0]?.finish_reason,
        hasRaw: Boolean(raw),
        hasJson: Boolean(json),
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

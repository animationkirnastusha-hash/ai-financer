import { env } from '../../../config/env';
import { AIModelRole, AIProvider, AIProviderJsonRequest } from './ai-provider.types';

type GroqChatCompletionResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      role?: string;
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

function modelForRole(role: AIModelRole): string {
  if (role === 'premium') return env.groqPremiumModel || env.groqModel;
  if (role === 'base') return env.groqModel;
  return env.groqFastModel || env.groqModel;
}

function timeoutForRequest(request: AIProviderJsonRequest, role: AIModelRole): number {
  const fallback = role === 'fast' ? env.aiFastTimeoutMs : env.aiLlmTimeoutMs;
  return Math.max(2_000, request.timeoutMs ?? fallback);
}

function maxTokensForRequest(request: AIProviderJsonRequest, role: AIModelRole): number {
  const fallback = role === 'fast' ? 128 : 512;
  return Math.max(16, Math.min(1024, request.numPredict ?? fallback));
}

function stripCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractJson(value: string): string {
  const cleaned = stripCodeFences(value);
  if (!cleaned) return '';
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) return cleaned.slice(first, last + 1);

  return '';
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return response.statusText;

    try {
      const parsed = JSON.parse(text) as GroqChatCompletionResponse;
      return parsed.error?.message || text;
    } catch {
      return text;
    }
  } catch {
    return response.statusText;
  }
}

export class GroqProvider implements AIProvider {
  async generateJson<T>(request: AIProviderJsonRequest): Promise<T> {
    if (!env.groqApiKey) {
      throw new Error('GROQ_API_KEY is required when AI_PROVIDER=groq');
    }

    const role = request.modelRole ?? 'base';
    const model = modelForRole(role);
    const timeoutMs = timeoutForRequest(request, role);
    const maxTokens = maxTokensForRequest(request, role);
    const baseUrl = env.groqBaseUrl.replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    try {
      console.log('[GROQ] generateJson:start', {
        role,
        model,
        timeoutMs,
        baseUrl,
        endpoint: '/chat/completions',
        maxTokens,
        promptChars: request.system.length + request.prompt.length,
      });

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: request.temperature ?? 0,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.system || 'Return valid JSON only.' },
            { role: 'user', content: request.prompt },
          ],
        }),
      });

      if (!response.ok) {
        const error = await readError(response);
        throw new Error(`Groq request failed: ${response.status} ${error}`);
      }

      const payload = (await response.json()) as GroqChatCompletionResponse;
      const raw = payload.choices?.[0]?.message?.content ?? '';
      const json = extractJson(raw);

      console.log('[GROQ] generateJson:done', {
        role,
        model,
        elapsedMs: Date.now() - startedAt,
        finishReason: payload.choices?.[0]?.finish_reason,
        hasRaw: Boolean(raw),
        hasJson: Boolean(json),
      });

      if (env.aiDebug) {
        console.log('[GROQ] raw preview', raw.slice(0, 1600));
      }

      if (!json) throw new Error('Groq returned no JSON');
      return JSON.parse(json) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Groq request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

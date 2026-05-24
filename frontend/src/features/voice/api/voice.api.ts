import { env } from '@/shared/config/env';

type VoiceTranscriptionResponse = {
  success: boolean;
  text: string;
  provider?: string;
  model?: string;
  language?: string;
  message?: string;
  code?: string;
};

type VoiceStatusResponse = {
  success: boolean;
  configured: boolean;
  provider: string;
  model: string;
  maxAudioMb: number;
  language: string;
};

function getAuthHeaders() {
  const token = localStorage.getItem('auth-token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

type VoiceDebugDetails = Record<string, string | number | boolean | null | undefined>;

function getVoiceDebugHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(getAuthHeaders() ?? {}),
  };
}

export function logVoiceDebugEvent(event: string, details?: VoiceDebugDetails) {
  const body = JSON.stringify({
    event,
    details: {
      ...details,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : undefined,
      url: typeof window !== 'undefined' ? window.location.pathname : undefined,
    },
  });

  try {
    const headers = getVoiceDebugHeaders();
    const token = localStorage.getItem('auth-token');
    if (!token) return;

    void fetch(`${env.apiBaseUrl}/voice/debug`, {
      method: 'POST',
      headers,
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Debug events must never affect voice flow.
  }
}

export async function getVoiceStatus(): Promise<VoiceStatusResponse> {
  const response = await fetch(`${env.apiBaseUrl}/voice/status`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'voice-status-failed');
  }

  return payload;
}

export async function transcribeVoice(
  audioBlob: Blob,
  filename = 'voice.webm',
  language = 'ru',
  timeoutMs = 34_000,
): Promise<VoiceTranscriptionResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, filename);
  formData.append('language', language);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), Math.max(8_000, timeoutMs));

  try {
    const response = await fetch(`${env.apiBaseUrl}/voice/transcribe`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload?.message || 'voice-transcription-failed');
      (error as Error & { code?: string; status?: number }).code = payload?.code;
      (error as Error & { code?: string; status?: number }).status = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && String((error as { name?: unknown }).name) === 'AbortError') {
      const timeoutError = new Error('voice-transcription-timeout');
      (timeoutError as Error & { code?: string; status?: number }).code = 'VOICE_TRANSCRIPTION_CLIENT_TIMEOUT';
      (timeoutError as Error & { code?: string; status?: number }).status = 408;
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

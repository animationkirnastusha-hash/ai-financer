import { env } from '@/shared/config/env';
import { getAccessToken } from '@/features/auth/lib/accessToken';

type VoiceDebugDetails = Record<string, string | number | boolean | null | undefined>;

type VoiceTranscriptionResponse = {
  success: boolean;
  text: string;
  provider?: string;
  model?: string;
  language?: string;
  message?: string;
  code?: string;
};

const voiceDebugLastSent = new Map<string, number>();
let voiceDebugWindowStartedAt = 0;
let voiceDebugWindowCount = 0;

const VOICE_DEBUG_IMPORTANT_EVENTS = new Set([
  'voice_press_start',
  'voice_release',
  'voice_cancel',
  'voice_permission_request',
  'voice_permission_granted',
  'voice_permission_denied',
  'voice_recorder_started',
  'voice_recorder_stopped',
  'voice_blob_ready',
  'voice_transcribe_sent',
  'voice_transcribe_success',
  'voice_transcribe_failed',
  'voice_text_received',
]);

function getAuthHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function shouldSendVoiceDebugEvent(event: string) {
  const now = Date.now();
  if (now - voiceDebugWindowStartedAt > 10_000) {
    voiceDebugWindowStartedAt = now;
    voiceDebugWindowCount = 0;
  }
  if (voiceDebugWindowCount >= 24) return false;

  const lastSentAt = voiceDebugLastSent.get(event) || 0;
  const minGapMs = VOICE_DEBUG_IMPORTANT_EVENTS.has(event) ? 260 : 1500;
  if (now - lastSentAt < minGapMs) return false;

  voiceDebugLastSent.set(event, now);
  voiceDebugWindowCount += 1;
  return true;
}

export function logVoiceDebugEvent(event: string, details?: VoiceDebugDetails) {
  if (!shouldSendVoiceDebugEvent(event)) return;
  if (!getAccessToken()) return;

  const body = JSON.stringify({
    event,
    details: {
      ...details,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : undefined,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    },
  });

  try {
    const route = '/voice/' + 'debug';
    void fetch(`${env.apiBaseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getAuthHeaders() ?? {}),
      },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Debug must not affect voice flow.
  }
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

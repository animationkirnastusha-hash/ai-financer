import { env } from '@/shared/config/env';
import { getAccessToken } from '@/features/auth/lib/accessToken';
import type { VoiceCue, VoiceDebugDetails, VoiceStatusResponse, VoiceTranscriptionResponse } from './voiceTypes';

function getAuthHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

const debugLastSent = new Map<string, number>();
let debugWindowStartedAt = 0;
let debugWindowCount = 0;

const IMPORTANT_DEBUG_EVENTS = new Set([
  'voice_press_start',
  'voice_start_requested',
  'voice_permission_requested',
  'voice_permission_granted',
  'voice_recorder_started',
  'voice_release',
  'voice_stop_requested',
  'voice_recorder_stopped',
  'voice_blob_ready',
  'voice_transcribe_sent',
  'voice_transcribe_success',
  'voice_transcribe_failed',
  'voice_cancelled',
  'voice_error',
  'voice_text_received',
]);

function shouldSendDebug(event: string) {
  const now = Date.now();

  if (now - debugWindowStartedAt > 10_000) {
    debugWindowStartedAt = now;
    debugWindowCount = 0;
    debugLastSent.clear();
  }

  if (debugWindowCount >= 24) return false;

  const lastSentAt = debugLastSent.get(event) || 0;
  const minGapMs = IMPORTANT_DEBUG_EVENTS.has(event) ? 100 : 1800;
  if (now - lastSentAt < minGapMs) return false;

  debugLastSent.set(event, now);
  debugWindowCount += 1;
  return true;
}

export function logVoiceDebugEvent(event: string, details?: VoiceDebugDetails) {
  if (!shouldSendDebug(event)) return;

  try {
    const token = getAccessToken();
    if (!token) return;

    const body = JSON.stringify({
      event,
      details: {
        ...details,
        visibilityState: typeof document !== 'undefined' ? document.visibilityState : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : undefined,
        url: typeof window !== 'undefined' ? window.location.pathname : undefined,
      },
    });

    void fetch(`${env.apiBaseUrl}/voice/debug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Voice debug must never affect recording.
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

  logVoiceDebugEvent('voice_transcribe_sent', {
    filename,
    language,
    blobSize: audioBlob.size,
    blobType: audioBlob.type || 'unknown',
  });

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

    logVoiceDebugEvent('voice_transcribe_success', {
      textLength: typeof payload?.text === 'string' ? payload.text.length : 0,
      provider: payload?.provider,
      model: payload?.model,
    });

    return payload;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && String((error as { name?: unknown }).name) === 'AbortError') {
      const timeoutError = new Error('voice-transcription-timeout');
      (timeoutError as Error & { code?: string; status?: number }).code = 'VOICE_TRANSCRIPTION_CLIENT_TIMEOUT';
      (timeoutError as Error & { code?: string; status?: number }).status = 408;
      logVoiceDebugEvent('voice_transcribe_failed', { reason: 'timeout' });
      throw timeoutError;
    }

    logVoiceDebugEvent('voice_transcribe_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getVoiceCueAudio(cue: VoiceCue, timeoutMs = 12_000): Promise<Blob> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), Math.max(4_000, timeoutMs));

  try {
    const response = await fetch(`${env.apiBaseUrl}/voice/tts/${cue}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const error = new Error(payload?.message || 'voice-tts-failed');
      (error as Error & { code?: string; status?: number }).code = payload?.code;
      (error as Error & { code?: string; status?: number }).status = response.status;
      throw error;
    }

    return response.blob();
  } finally {
    window.clearTimeout(timeout);
  }
}

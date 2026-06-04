import { env } from '@/shared/config/env';
import { getAccessToken } from '@/features/auth/lib/accessToken';

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
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

type VoiceDebugDetails = Record<string, string | number | boolean | null | undefined>;

const voiceDebugLastSent = new Map<string, number>();
let voiceDebugWindowStartedAt = 0;
let voiceDebugWindowCount = 0;

const VOICE_DEBUG_IMPORTANT_EVENTS = new Set([
  'recorder_format_selected',
  'permission_denied',
  'permission_granted',
  'recorder_start_failed',
  'recorder_started',
  'recorder_stopped',
  'audio_blob_ready',
  'transcribe_request_sent',
  'transcribe_request_success',
  'transcribe_request_failed',
  'voice_session_segment_added',
  'voice_session_finalized',
  'voice_session_dispatched',
  'voice_state_changed',
  'command_capture_text_received',
]);

const VOICE_DEBUG_NOISY_EVENTS = new Set([
  'tts_audio_unlock_ready',
  'recorder_start_call',
  'audio_blob_skipped_no_voice',
  'vad_stop_no_speech',
]);

function getVoiceDebugHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(getAuthHeaders() ?? {}),
  };
}

function shouldSendVoiceDebugEvent(event: string) {
  const now = Date.now();

  if (now - voiceDebugWindowStartedAt > 10_000) {
    voiceDebugWindowStartedAt = now;
    voiceDebugWindowCount = 0;
  }

  if (voiceDebugWindowCount >= 45) return false;

  const lastSentAt = voiceDebugLastSent.get(event) || 0;
  const minGapMs = VOICE_DEBUG_NOISY_EVENTS.has(event) ? 2500 : VOICE_DEBUG_IMPORTANT_EVENTS.has(event) ? 350 : 1200;

  if (now - lastSentAt < minGapMs) return false;

  voiceDebugLastSent.set(event, now);
  voiceDebugWindowCount += 1;
  return true;
}

export function logVoiceDebugEvent(event: string, details?: VoiceDebugDetails) {
  if (!shouldSendVoiceDebugEvent(event)) return;

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
    if (!getAccessToken()) return;

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

export type VoiceCue = 'here' | 'listening' | 'thinking' | 'done' | 'not-heard' | 'confirm';

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

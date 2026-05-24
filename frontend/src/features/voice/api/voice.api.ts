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
  supportedProviders?: string[];
  gladiaConfigured?: boolean;
  deepgramConfigured?: boolean;
  assemblyaiConfigured?: boolean;
};

function getAuthHeaders() {
  const token = localStorage.getItem('auth-token');
  return token ? { Authorization: `Bearer ${token}` } : undefined;
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
): Promise<VoiceTranscriptionResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, filename);
  formData.append('language', language);

  const response = await fetch(`${env.apiBaseUrl}/voice/transcribe`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || 'voice-transcription-failed');
    (error as Error & { code?: string; status?: number; provider?: string }).code = payload?.code;
    (error as Error & { code?: string; status?: number; provider?: string }).status = response.status;
    (error as Error & { code?: string; status?: number; provider?: string }).provider = payload?.provider;
    throw error;
  }

  return payload;
}

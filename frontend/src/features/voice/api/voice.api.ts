import { env } from '@/shared/config/env';

type VoiceTranscriptionResponse = {
  success: boolean;
  text: string;
  message?: string;
};

export async function transcribeVoice(audioBlob: Blob, filename = 'voice.webm'): Promise<VoiceTranscriptionResponse> {
  const token = localStorage.getItem('auth-token');

  const formData = new FormData();
  formData.append('audio', audioBlob, filename);

  const response = await fetch(`${env.apiBaseUrl}/voice/transcribe`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || 'voice-transcription-failed');
  }

  return payload;
}

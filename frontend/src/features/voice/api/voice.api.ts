import { env } from '@/shared/config/env';

type VoiceTranscriptionResponse = {
  success: boolean;
  text: string;
};

export async function transcribeVoice(audioBlob: Blob): Promise<VoiceTranscriptionResponse> {
  const token = localStorage.getItem('auth-token');

  const formData = new FormData();
  formData.append('audio', audioBlob, 'voice.webm');

  const response = await fetch(`${env.apiBaseUrl}/voice/transcribe`, {
    method: 'POST',
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
    body: formData,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.message || 'Voice transcription failed');
  }

  return payload;
}
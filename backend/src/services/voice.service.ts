import OpenAI from 'openai';

type TranscribeParams = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

export class VoiceTranscriptionNotConfiguredError extends Error {
  constructor() {
    super('VOICE_TRANSCRIPTION_NOT_CONFIGURED');
    this.name = 'VoiceTranscriptionNotConfiguredError';
  }
}

class VoiceService {
  private client: OpenAI | null;

  constructor() {
    this.client = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  async transcribe({ buffer, mimeType, originalName }: TranscribeParams) {
    if (!this.client) {
      throw new VoiceTranscriptionNotConfiguredError();
    }

    const file = new File([buffer], originalName || 'voice.webm', {
      type: mimeType || 'audio/webm',
    });

    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
    });

    return {
      text: transcription.text,
      mode: 'openai',
    };
  }
}

export const voiceService = new VoiceService();

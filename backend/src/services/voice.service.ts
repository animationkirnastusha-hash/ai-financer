import OpenAI from 'openai';

type TranscribeParams = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

class VoiceService {
  private client: OpenAI | null;

  constructor() {
    this.client = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  async transcribe({ buffer, mimeType, originalName }: TranscribeParams) {
    if (!this.client) {
      return {
        text: '',
        mode: 'stub',
      };
    }

    const file = new File([buffer], originalName || 'voice.webm', {
      type: mimeType || 'audio/webm',
    });

    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: 'gpt-4o-mini-transcribe',
    });

    return {
      text: transcription.text,
      mode: 'openai',
    };
  }
}

export const voiceService = new VoiceService();
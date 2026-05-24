import OpenAI from 'openai';
import { File } from 'node:buffer';

type TranscribeParams = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  language?: string;
};

type VoiceStatus = {
  configured: boolean;
  provider: string;
  model: string;
  maxAudioMb: number;
  language: string;
};

const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_LANGUAGE = 'ru';
const DEFAULT_MAX_AUDIO_MB = 8;

const SUPPORTED_MIME_PREFIXES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/ogg',
];

export class VoiceTranscriptionNotConfiguredError extends Error {
  constructor() {
    super('VOICE_TRANSCRIPTION_NOT_CONFIGURED');
    this.name = 'VoiceTranscriptionNotConfiguredError';
  }
}

export class VoiceAudioTooLargeError extends Error {
  constructor() {
    super('VOICE_AUDIO_TOO_LARGE');
    this.name = 'VoiceAudioTooLargeError';
  }
}

export class VoiceAudioUnsupportedError extends Error {
  constructor() {
    super('VOICE_AUDIO_UNSUPPORTED');
    this.name = 'VoiceAudioUnsupportedError';
  }
}

function getMaxAudioMb() {
  const value = Number(process.env.VOICE_MAX_AUDIO_MB || DEFAULT_MAX_AUDIO_MB);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_AUDIO_MB;
  return Math.min(25, Math.max(1, value));
}

function getProvider() {
  return (process.env.VOICE_STT_PROVIDER || 'openai').trim().toLowerCase();
}

function getModel() {
  return (process.env.VOICE_STT_MODEL || process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_MODEL).trim();
}

function getLanguage(language?: string) {
  const raw = (language || process.env.VOICE_LANGUAGE || DEFAULT_LANGUAGE).trim().toLowerCase();
  if (raw.startsWith('en')) return 'en';
  return 'ru';
}

function sanitizeFilename(originalName: string, mimeType: string) {
  const safeName = originalName.replace(/[\\/\0\r\n]/g, '').trim();
  if (safeName) return safeName;

  if (mimeType.includes('mp4')) return 'voice.mp4';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'voice.mp3';
  if (mimeType.includes('wav')) return 'voice.wav';
  if (mimeType.includes('aac')) return 'voice.aac';
  if (mimeType.includes('ogg')) return 'voice.ogg';
  return 'voice.webm';
}

function normalizeMimeType(mimeType: string) {
  const value = (mimeType || 'audio/webm').toLowerCase().split(';')[0].trim();
  return value || 'audio/webm';
}

function assertSupportedAudio(buffer: Buffer, mimeType: string) {
  if (!buffer.length) throw new VoiceAudioUnsupportedError();

  const maxBytes = getMaxAudioMb() * 1024 * 1024;
  if (buffer.length > maxBytes) throw new VoiceAudioTooLargeError();

  const normalized = normalizeMimeType(mimeType);
  if (!SUPPORTED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new VoiceAudioUnsupportedError();
  }
}

class VoiceService {
  private client: OpenAI | null = null;
  private lastApiKey: string | null = null;

  getStatus(): VoiceStatus {
    const provider = getProvider();
    return {
      configured: provider === 'mock' || Boolean(process.env.OPENAI_API_KEY),
      provider,
      model: getModel(),
      maxAudioMb: getMaxAudioMb(),
      language: getLanguage(),
    };
  }

  private getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new VoiceTranscriptionNotConfiguredError();

    if (!this.client || this.lastApiKey !== apiKey) {
      this.client = new OpenAI({ apiKey });
      this.lastApiKey = apiKey;
    }

    return this.client;
  }

  async transcribe({ buffer, mimeType, originalName, language }: TranscribeParams) {
    const provider = getProvider();
    const normalizedMimeType = normalizeMimeType(mimeType);
    assertSupportedAudio(buffer, normalizedMimeType);

    if (provider === 'mock') {
      return {
        text: '',
        provider,
        model: 'mock',
        language: getLanguage(language),
      };
    }

    if (provider !== 'openai') {
      throw new VoiceTranscriptionNotConfiguredError();
    }

    const client = this.getOpenAIClient();
    const model = getModel();
    const normalizedLanguage = getLanguage(language);

    const file = new File([buffer], sanitizeFilename(originalName, normalizedMimeType), {
      type: normalizedMimeType,
    });

    const transcription = await client.audio.transcriptions.create({
      file,
      model,
      language: normalizedLanguage,
      response_format: 'json',
    });

    return {
      text: (transcription.text || '').trim(),
      provider,
      model,
      language: normalizedLanguage,
    };
  }
}

export const voiceService = new VoiceService();

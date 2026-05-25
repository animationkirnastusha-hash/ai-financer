import fs from 'node:fs/promises';
import path from 'node:path';

export type VoiceCue = 'here' | 'listening' | 'thinking' | 'done' | 'not-heard' | 'confirm';

export type VoiceCueAudio = {
  cue: VoiceCue;
  text: string;
  buffer: Buffer;
  contentType: string;
  cached: boolean;
};

export class VoiceTtsNotConfiguredError extends Error {
  constructor() {
    super('Voice TTS is not configured.');
    this.name = 'VoiceTtsNotConfiguredError';
  }
}

export class VoiceTtsProviderError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.name = 'VoiceTtsProviderError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const CUE_TEXT: Record<VoiceCue, string> = {
  here: 'Я здесь.',
  listening: 'Слушаю.',
  thinking: 'Думаю.',
  done: 'Готово.',
  'not-heard': 'Не расслышала.',
  confirm: 'Проверь действие.',
};

const CUE_CONTENT_TYPE: Record<string, string> = {
  mp3: 'audio/mpeg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
};

function isVoiceCue(value: string): value is VoiceCue {
  return Object.prototype.hasOwnProperty.call(CUE_TEXT, value);
}

function getModel() {
  return (process.env.VOICE_TTS_MODEL || 'gpt-4o-mini-tts').trim();
}

function getVoice() {
  return (process.env.VOICE_TTS_VOICE || 'coral').trim();
}

function getFormat() {
  const format = (process.env.VOICE_TTS_FORMAT || 'mp3').trim().toLowerCase();
  if (format === 'opus' || format === 'wav') return format;
  return 'mp3';
}

function getCacheDir() {
  return process.env.VOICE_TTS_CACHE_DIR?.trim() || path.join(process.cwd(), 'storage', 'voice-cues');
}

function isEnabled() {
  return process.env.VOICE_TTS_ENABLED !== '0';
}

function hasOpenAIConfig() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function safePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 80);
}

async function readErrorPayload(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json().catch(() => undefined);
  return response.text().catch(() => undefined);
}

export const voiceTtsService = {
  isCue: isVoiceCue,

  getStatus() {
    return {
      ttsEnabled: isEnabled(),
      ttsProvider: 'openai',
      ttsModel: getModel(),
      ttsVoice: getVoice(),
      ttsFormat: getFormat(),
      ttsConfigured: isEnabled() && hasOpenAIConfig(),
    };
  },

  getCueText(cue: VoiceCue) {
    return CUE_TEXT[cue];
  },

  async getCueAudio(cue: VoiceCue): Promise<VoiceCueAudio> {
    if (!isEnabled() || !hasOpenAIConfig()) throw new VoiceTtsNotConfiguredError();

    const model = getModel();
    const voice = getVoice();
    const format = getFormat();
    const contentType = CUE_CONTENT_TYPE[format] || 'audio/mpeg';
    const cacheDir = getCacheDir();
    const cacheFile = path.join(cacheDir, `${safePart(cue)}.${safePart(model)}.${safePart(voice)}.${format}`);

    if (process.env.VOICE_TTS_CACHE !== '0') {
      try {
        const buffer = await fs.readFile(cacheFile);
        return { cue, text: CUE_TEXT[cue], buffer, contentType, cached: true };
      } catch {
        // Cache miss.
      }
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new VoiceTtsNotConfiguredError();

    const timeoutMs = Number(process.env.OPENAI_TTS_TIMEOUT_MS || process.env.VOICE_TTS_TIMEOUT_MS || 30_000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(8_000, timeoutMs));

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          voice,
          input: CUE_TEXT[cue],
          response_format: format,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await readErrorPayload(response);
        const code = typeof payload === 'object' && payload && 'error' in payload
          ? String((payload as { error?: { code?: unknown; type?: unknown } }).error?.code || (payload as { error?: { type?: unknown } }).error?.type || 'VOICE_TTS_PROVIDER_FAILED')
          : 'VOICE_TTS_PROVIDER_FAILED';
        throw new VoiceTtsProviderError(response.status, code, payload);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (process.env.VOICE_TTS_CACHE !== '0') {
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.writeFile(cacheFile, buffer).catch(() => undefined);
      }

      return { cue, text: CUE_TEXT[cue], buffer, contentType, cached: false };
    } catch (error) {
      if (error instanceof VoiceTtsProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new VoiceTtsProviderError(504, 'VOICE_TTS_TIMEOUT');
      }
      throw new VoiceTtsProviderError(502, 'VOICE_TTS_REQUEST_FAILED', error instanceof Error ? error.message : undefined);
    } finally {
      clearTimeout(timeout);
    }
  },
};

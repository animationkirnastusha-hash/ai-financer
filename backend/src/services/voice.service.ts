const DEFAULT_GLADIA_MODEL = 'gladia-pre-recorded-v2';
const DEFAULT_DEEPGRAM_MODEL = 'nova-3';
const DEFAULT_ASSEMBLYAI_MODEL = 'universal-3-pro,universal-2';
const DEFAULT_LANGUAGE = 'ru';
const DEFAULT_MAX_AUDIO_MB = 8;

const SUPPORTED_MIME_PREFIXES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/ogg',
  'audio/x-m4a',
];

const SUPPORTED_AUDIO_EXTENSIONS = [
  '.webm',
  '.mp4',
  '.m4a',
  '.mp3',
  '.mpeg',
  '.wav',
  '.aac',
  '.ogg',
];

type SttProvider = 'gladia' | 'deepgram' | 'assemblyai' | 'mock';

type TranscribeParams = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  language?: string;
};

type VoiceStatus = {
  configured: boolean;
  provider: SttProvider;
  model: string;
  maxAudioMb: number;
  language: string;
  supportedProviders: SttProvider[];
  gladiaConfigured: boolean;
  deepgramConfigured: boolean;
  assemblyaiConfigured: boolean;
};

type TranscribeResult = {
  text: string;
  provider: SttProvider;
  model: string;
  language: string;
};

export class VoiceTranscriptionNotConfiguredError extends Error {
  constructor(provider?: string) {
    super(provider ? `VOICE_TRANSCRIPTION_NOT_CONFIGURED:${provider}` : 'VOICE_TRANSCRIPTION_NOT_CONFIGURED');
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

export class VoiceProviderRequestError extends Error {
  readonly provider: SttProvider;
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(provider: SttProvider, status: number, code: string, details?: unknown) {
    super(code);
    this.name = 'VoiceProviderRequestError';
    this.provider = provider;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getMaxAudioMb() {
  const value = Number(process.env.VOICE_MAX_AUDIO_MB || DEFAULT_MAX_AUDIO_MB);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_AUDIO_MB;
  return Math.min(25, Math.max(1, value));
}

function normalizeProvider(value?: string): SttProvider {
  const provider = (value || process.env.VOICE_STT_PROVIDER || 'gladia').trim().toLowerCase();
  if (provider === 'gladia' || provider === 'deepgram' || provider === 'assemblyai' || provider === 'mock') {
    return provider;
  }
  return 'gladia';
}

function getProvider(): SttProvider {
  return normalizeProvider();
}

function getModel(provider = getProvider()) {
  const explicitModel = process.env.VOICE_STT_MODEL?.trim();
  if (explicitModel) return explicitModel;

  if (provider === 'gladia') return process.env.GLADIA_STT_MODEL?.trim() || DEFAULT_GLADIA_MODEL;
  if (provider === 'deepgram') return process.env.DEEPGRAM_STT_MODEL?.trim() || DEFAULT_DEEPGRAM_MODEL;
  if (provider === 'assemblyai') return process.env.ASSEMBLYAI_STT_MODEL?.trim() || DEFAULT_ASSEMBLYAI_MODEL;
  return 'mock';
}

function getLanguage(language?: string) {
  const raw = (language || process.env.VOICE_LANGUAGE || DEFAULT_LANGUAGE).trim().toLowerCase();
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('ru')) return 'ru';
  return raw || DEFAULT_LANGUAGE;
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

function hasSupportedAudioExtension(originalName: string) {
  const value = originalName.toLowerCase().trim();
  return SUPPORTED_AUDIO_EXTENSIONS.some((extension) => value.endsWith(extension));
}

function inferMimeType(mimeType: string, originalName: string) {
  const normalized = normalizeMimeType(mimeType);
  const name = originalName.toLowerCase().trim();

  if (normalized !== 'application/octet-stream' && normalized !== 'binary/octet-stream') return normalized;

  if (name.endsWith('.webm')) return 'audio/webm';
  if (name.endsWith('.mp4') || name.endsWith('.m4a')) return 'audio/mp4';
  if (name.endsWith('.mp3') || name.endsWith('.mpeg')) return 'audio/mpeg';
  if (name.endsWith('.wav')) return 'audio/wav';
  if (name.endsWith('.aac')) return 'audio/aac';
  if (name.endsWith('.ogg')) return 'audio/ogg';

  return normalized;
}

function assertSupportedAudio(buffer: Buffer, mimeType: string, originalName = '') {
  if (!buffer.length) throw new VoiceAudioUnsupportedError();

  const maxBytes = getMaxAudioMb() * 1024 * 1024;
  if (buffer.length > maxBytes) throw new VoiceAudioTooLargeError();

  const normalized = normalizeMimeType(mimeType);
  const hasSupportedMime = SUPPORTED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  const isGenericBinary = normalized === 'application/octet-stream' || normalized === 'binary/octet-stream';

  if (!hasSupportedMime && !(isGenericBinary && hasSupportedAudioExtension(originalName))) {
    throw new VoiceAudioUnsupportedError();
  }
}

function hasGladiaConfig() {
  return Boolean(process.env.GLADIA_API_KEY?.trim());
}

function hasDeepgramConfig() {
  return Boolean(process.env.DEEPGRAM_API_KEY?.trim());
}

function hasAssemblyAIConfig() {
  return Boolean(process.env.ASSEMBLYAI_API_KEY?.trim());
}

function isConfigured(provider: SttProvider) {
  if (provider === 'mock') return true;
  if (provider === 'gladia') return hasGladiaConfig();
  if (provider === 'deepgram') return hasDeepgramConfig();
  if (provider === 'assemblyai') return hasAssemblyAIConfig();
  return false;
}

async function readJsonSafely(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function getObjectValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>)[key];
}

function extractDeepgramTranscript(payload: unknown) {
  const results = getObjectValue(payload, 'results');
  const channels = getObjectValue(results, 'channels');
  if (!Array.isArray(channels)) return '';
  const firstChannel = channels[0];
  const alternatives = getObjectValue(firstChannel, 'alternatives');
  if (!Array.isArray(alternatives)) return '';
  const transcript = getObjectValue(alternatives[0], 'transcript');
  return typeof transcript === 'string' ? transcript.trim() : '';
}

function extractAssemblyTranscript(payload: unknown) {
  const text = getObjectValue(payload, 'text');
  return typeof text === 'string' ? text.trim() : '';
}

function extractGladiaTranscript(payload: unknown) {
  const result = getObjectValue(payload, 'result');
  const transcription = getObjectValue(result, 'transcription');

  const fullTranscript = getObjectValue(transcription, 'full_transcript');
  if (typeof fullTranscript === 'string' && fullTranscript.trim()) return fullTranscript.trim();

  const transcript = getObjectValue(transcription, 'transcript');
  if (typeof transcript === 'string' && transcript.trim()) return transcript.trim();

  const utterances = getObjectValue(transcription, 'utterances');
  if (Array.isArray(utterances)) {
    return utterances
      .map((utterance) => getObjectValue(utterance, 'text'))
      .filter((text): text is string => typeof text === 'string' && Boolean(text.trim()))
      .join(' ')
      .trim();
  }

  const sentences = getObjectValue(transcription, 'sentences');
  if (Array.isArray(sentences)) {
    return sentences
      .map((sentence) => getObjectValue(sentence, 'text'))
      .filter((text): text is string => typeof text === 'string' && Boolean(text.trim()))
      .join(' ')
      .trim();
  }

  return '';
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1500, timeoutMs));

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && String((error as { name?: unknown }).name) === 'AbortError') {
      throw new VoiceProviderRequestError(getProvider(), 504, 'VOICE_PROVIDER_FETCH_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class VoiceService {
  getStatus(): VoiceStatus {
    const provider = getProvider();
    return {
      configured: isConfigured(provider),
      provider,
      model: getModel(provider),
      maxAudioMb: getMaxAudioMb(),
      language: getLanguage(),
      supportedProviders: ['gladia', 'deepgram', 'assemblyai', 'mock'],
      gladiaConfigured: hasGladiaConfig(),
      deepgramConfigured: hasDeepgramConfig(),
      assemblyaiConfigured: hasAssemblyAIConfig(),
    };
  }

  private async transcribeWithGladia(buffer: Buffer, mimeType: string, originalName: string, language?: string): Promise<TranscribeResult> {
    const provider: SttProvider = 'gladia';
    const apiKey = process.env.GLADIA_API_KEY?.trim();
    if (!apiKey) throw new VoiceTranscriptionNotConfiguredError(provider);

    const model = getModel(provider);
    const normalizedLanguage = getLanguage(language);
    const filename = sanitizeFilename(originalName, mimeType);

    const formData = new FormData();
    formData.append('audio', new Blob([buffer], { type: mimeType }), filename);

    const uploadResponse = await fetchWithTimeout('https://api.gladia.io/v2/upload', {
      method: 'POST',
      headers: {
        'x-gladia-key': apiKey,
      },
      body: formData,
    }, Number(process.env.GLADIA_UPLOAD_TIMEOUT_MS || 30_000));
    const uploadPayload = await readJsonSafely(uploadResponse);

    if (!uploadResponse.ok) {
      throw new VoiceProviderRequestError(provider, uploadResponse.status, 'VOICE_GLADIA_UPLOAD_FAILED', uploadPayload);
    }

    const audioUrl = getObjectValue(uploadPayload, 'audio_url');
    if (typeof audioUrl !== 'string' || !audioUrl) {
      throw new VoiceProviderRequestError(provider, 502, 'VOICE_GLADIA_AUDIO_URL_MISSING', uploadPayload);
    }

    const requestBody: Record<string, unknown> = {
      audio_url: audioUrl,
      custom_vocabulary: false,
      callback: false,
      subtitles: false,
      diarization: false,
      translation: false,
      summarization: false,
      named_entity_recognition: false,
      language_config: {
        languages: [normalizedLanguage],
        code_switching: false,
      },
      punctuation_enhanced: true,
      sentences: false,
    };

    const createResponse = await fetchWithTimeout('https://api.gladia.io/v2/pre-recorded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gladia-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    }, Number(process.env.GLADIA_CREATE_TIMEOUT_MS || 30_000));
    const createPayload = await readJsonSafely(createResponse);

    if (!createResponse.ok) {
      throw new VoiceProviderRequestError(provider, createResponse.status, 'VOICE_GLADIA_CREATE_FAILED', createPayload);
    }

    const id = getObjectValue(createPayload, 'id');
    if (typeof id !== 'string' || !id) {
      throw new VoiceProviderRequestError(provider, 502, 'VOICE_GLADIA_TRANSCRIPTION_ID_MISSING', createPayload);
    }

    const timeoutMs = Number(process.env.GLADIA_POLL_TIMEOUT_MS || 60_000);
    const intervalMs = Number(process.env.GLADIA_POLL_INTERVAL_MS || 900);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      await delay(Math.max(350, Math.min(3000, intervalMs)));

      const pollResponse = await fetchWithTimeout(`https://api.gladia.io/v2/pre-recorded/${id}`, {
        headers: {
          'x-gladia-key': apiKey,
        },
      }, Number(process.env.GLADIA_POLL_REQUEST_TIMEOUT_MS || 15_000));
      const pollPayload = await readJsonSafely(pollResponse);

      if (!pollResponse.ok) {
        throw new VoiceProviderRequestError(provider, pollResponse.status, 'VOICE_GLADIA_POLL_FAILED', pollPayload);
      }

      const status = getObjectValue(pollPayload, 'status');
      if (status === 'done') {
        return {
          text: extractGladiaTranscript(pollPayload),
          provider,
          model,
          language: normalizedLanguage,
        };
      }

      if (status === 'error') {
        throw new VoiceProviderRequestError(provider, 502, 'VOICE_GLADIA_TRANSCRIPTION_ERROR', pollPayload);
      }
    }

    throw new VoiceProviderRequestError(provider, 504, 'VOICE_GLADIA_TIMEOUT');
  }

  private async transcribeWithDeepgram(buffer: Buffer, mimeType: string, language?: string): Promise<TranscribeResult> {
    const provider: SttProvider = 'deepgram';
    const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
    if (!apiKey) throw new VoiceTranscriptionNotConfiguredError(provider);

    const model = getModel(provider);
    const normalizedLanguage = getLanguage(language);
    const url = new URL('https://api.deepgram.com/v1/listen');
    url.searchParams.set('model', model);
    url.searchParams.set('language', normalizedLanguage);
    url.searchParams.set('smart_format', 'true');
    url.searchParams.set('punctuate', 'true');
    url.searchParams.set('numerals', 'true');

    const keyterms = (process.env.DEEPGRAM_KEYTERMS || 'Фина,Fina,фина').split(',').map((item) => item.trim()).filter(Boolean);
    for (const keyterm of keyterms) {
      url.searchParams.append('keyterm', keyterm);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': mimeType,
      },
      body: buffer,
    });

    const payload = await readJsonSafely(response);

    if (!response.ok) {
      throw new VoiceProviderRequestError(provider, response.status, 'VOICE_DEEPGRAM_REQUEST_FAILED', payload);
    }

    return {
      text: extractDeepgramTranscript(payload),
      provider,
      model,
      language: normalizedLanguage,
    };
  }

  private async transcribeWithAssemblyAI(buffer: Buffer, mimeType: string, language?: string): Promise<TranscribeResult> {
    const provider: SttProvider = 'assemblyai';
    const apiKey = process.env.ASSEMBLYAI_API_KEY?.trim();
    if (!apiKey) throw new VoiceTranscriptionNotConfiguredError(provider);

    const model = getModel(provider);
    const normalizedLanguage = getLanguage(language);

    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': mimeType,
      },
      body: buffer,
    });
    const uploadPayload = await readJsonSafely(uploadResponse);

    if (!uploadResponse.ok) {
      throw new VoiceProviderRequestError(provider, uploadResponse.status, 'VOICE_ASSEMBLYAI_UPLOAD_FAILED', uploadPayload);
    }

    const uploadUrl = getObjectValue(uploadPayload, 'upload_url');
    if (typeof uploadUrl !== 'string' || !uploadUrl) {
      throw new VoiceProviderRequestError(provider, 502, 'VOICE_ASSEMBLYAI_UPLOAD_URL_MISSING', uploadPayload);
    }

    const speechModels = model
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const transcriptBody: Record<string, unknown> = {
      audio_url: uploadUrl,
      language_code: normalizedLanguage,
      speech_models: speechModels.length ? speechModels : ['universal-3-pro', 'universal-2'],
      punctuate: true,
      format_text: true,
      keyterms_prompt: ['Фина', 'Fina', 'счёт', 'наличные', 'карта'],
    };

    const createResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transcriptBody),
    });
    const createPayload = await readJsonSafely(createResponse);

    if (!createResponse.ok) {
      throw new VoiceProviderRequestError(provider, createResponse.status, 'VOICE_ASSEMBLYAI_CREATE_FAILED', createPayload);
    }

    const id = getObjectValue(createPayload, 'id');
    if (typeof id !== 'string' || !id) {
      throw new VoiceProviderRequestError(provider, 502, 'VOICE_ASSEMBLYAI_TRANSCRIPT_ID_MISSING', createPayload);
    }

    const timeoutMs = Number(process.env.ASSEMBLYAI_POLL_TIMEOUT_MS || 25_000);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      await delay(1200);

      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { Authorization: apiKey },
      });
      const pollPayload = await readJsonSafely(pollResponse);

      if (!pollResponse.ok) {
        throw new VoiceProviderRequestError(provider, pollResponse.status, 'VOICE_ASSEMBLYAI_POLL_FAILED', pollPayload);
      }

      const status = getObjectValue(pollPayload, 'status');
      if (status === 'completed') {
        return {
          text: extractAssemblyTranscript(pollPayload),
          provider,
          model,
          language: normalizedLanguage,
        };
      }

      if (status === 'error') {
        throw new VoiceProviderRequestError(provider, 502, 'VOICE_ASSEMBLYAI_TRANSCRIPTION_ERROR', pollPayload);
      }
    }

    throw new VoiceProviderRequestError(provider, 504, 'VOICE_ASSEMBLYAI_TIMEOUT');
  }

  async transcribe({ buffer, mimeType, originalName, language }: TranscribeParams): Promise<TranscribeResult> {
    const provider = getProvider();
    const normalizedMimeType = inferMimeType(mimeType, originalName);
    assertSupportedAudio(buffer, normalizedMimeType, originalName);

    if (provider === 'mock') {
      return {
        text: '',
        provider,
        model: 'mock',
        language: getLanguage(language),
      };
    }

    if (!isConfigured(provider)) {
      throw new VoiceTranscriptionNotConfiguredError(provider);
    }

    if (provider === 'gladia') return this.transcribeWithGladia(buffer, normalizedMimeType, originalName, language);
    if (provider === 'deepgram') return this.transcribeWithDeepgram(buffer, normalizedMimeType, language);
    return this.transcribeWithAssemblyAI(buffer, normalizedMimeType, language);
  }
}

export const voiceService = new VoiceService();

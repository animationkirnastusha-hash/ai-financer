import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_LANGUAGE = 'ru';
const DEFAULT_MAX_AUDIO_MB = 8;

type SttProvider = 'openai';

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
  openaiConfigured: boolean;
  audioNormalize: boolean;
};

type TranscribeResult = {
  text: string;
  provider: SttProvider;
  model: string;
  language: string;
  normalized: boolean;
};

const SUPPORTED_AUDIO_EXTENSIONS = ['.webm', '.mp4', '.m4a', '.mp3', '.mpeg', '.wav', '.aac', '.ogg', '.caf'];
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
  'audio/m4a',
  'audio/caf',
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

function getProvider(): SttProvider {
  const provider = (process.env.VOICE_STT_PROVIDER || 'openai').trim().toLowerCase();
  if (provider && provider !== 'openai') {
    console.warn(`[voice] Unsupported VOICE_STT_PROVIDER=${provider}; only openai is enabled in the production STT layer.`);
  }
  return 'openai';
}

function getModel() {
  return process.env.VOICE_STT_MODEL?.trim() || process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}


function getSttPrompt() {
  return process.env.VOICE_STT_PROMPT?.trim()
    || [
      'Русская речь в финансовом приложении Ai-financer.',
      'Пользователь часто начинает команду с имени помощника: Фина. Если в начале фразы звучит имя Фина, сохрани его в тексте именно как Фина.',
      'Финансовые слова и названия, которые нужно распознавать буквально: счёт, счет, наличка, наличные, карта, Т-Банк, Тинькофф, Сбер, Сбербанк, Альфа, ВТБ, Озон, Ozon, зарплата, доход, расход, перевод, списание, пополнение, кэшбэк, аренда, продукты, кофе, такси, подписка, категория, раздел, цель, рубли, рублей, тысяча, тысяч, 10к.',
      'Примеры: Фина кофе 300 рублей; Фина я потратил на кофе 300 рублей спиши с налички; Фина создай счет Т-Банк и положи туда десять тысяч; Фина переведи 5 тысяч с налички на карту Т-Банк.',
    ].join(' ');
}

function getLanguage(language?: string) {
  const raw = (language || process.env.VOICE_LANGUAGE || DEFAULT_LANGUAGE).trim().toLowerCase();
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('ru')) return 'ru';
  return raw || DEFAULT_LANGUAGE;
}

function getMaxAudioMb() {
  const value = Number(process.env.VOICE_MAX_AUDIO_MB || DEFAULT_MAX_AUDIO_MB);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_AUDIO_MB;
  return Math.min(25, Math.max(1, value));
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
  if (name.endsWith('.caf')) return 'audio/caf';
  return normalized;
}

function sanitizeFilename(originalName: string, mimeType: string) {
  const safeName = originalName.replace(/[\\/\0\r\n]/g, '').trim();
  if (safeName) return safeName;
  if (mimeType.includes('mp4')) return 'voice.m4a';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'voice.mp3';
  if (mimeType.includes('wav')) return 'voice.wav';
  if (mimeType.includes('aac')) return 'voice.aac';
  if (mimeType.includes('ogg')) return 'voice.ogg';
  if (mimeType.includes('caf')) return 'voice.caf';
  return 'voice.webm';
}

function getAudioExtension(mimeType: string, originalName: string) {
  const fromName = extname(originalName || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
  if (fromName && SUPPORTED_AUDIO_EXTENSIONS.includes(fromName)) return fromName.slice(1);
  const normalized = normalizeMimeType(mimeType);
  if (normalized.includes('mp4') || normalized.includes('m4a')) return 'm4a';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('aac')) return 'aac';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('caf')) return 'caf';
  return 'webm';
}

function shouldNormalizeAudio(mimeType: string, originalName: string) {
  if (process.env.VOICE_AUDIO_NORMALIZE === '0') return false;
  const normalized = normalizeMimeType(mimeType);
  const name = originalName.toLowerCase();
  if (normalized === 'audio/wav' || normalized === 'audio/x-wav' || normalized === 'audio/wave') return false;
  if (name.endsWith('.wav')) return false;
  return true;
}

function sniffAudioSignature(buffer: Buffer, mimeType: string, originalName: string) {
  if (buffer.length < 12) return false;
  const header4 = buffer.subarray(0, 4).toString('ascii');
  const header3 = buffer.subarray(0, 3).toString('ascii');
  const ftyp = buffer.subarray(4, 8).toString('ascii');

  if (header4 === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return true;
  if (ftyp === 'ftyp') return true;
  if (header3 === 'ID3') return true;
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return true;
  if (header4 === 'OggS') return true;
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return true;

  const normalized = normalizeMimeType(mimeType);
  if (normalized.startsWith('audio/') && hasSupportedAudioExtension(originalName)) return true;
  return false;
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

  if (!sniffAudioSignature(buffer, mimeType, originalName)) {
    throw new VoiceAudioUnsupportedError();
  }
}

type NormalizedAudio = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  normalized: boolean;
};

async function normalizeAudioForStt(buffer: Buffer, mimeType: string, originalName: string): Promise<NormalizedAudio> {
  if (!shouldNormalizeAudio(mimeType, originalName)) return { buffer, mimeType, originalName, normalized: false };

  const startedAt = Date.now();
  const tempDir = await mkdtemp(join(tmpdir(), 'ai-financer-voice-'));
  const inputPath = join(tempDir, `input.${getAudioExtension(mimeType, originalName)}`);
  const outputPath = join(tempDir, 'normalized.wav');

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync('ffmpeg', [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      inputPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-f',
      'wav',
      outputPath,
    ], {
      timeout: Number(process.env.VOICE_AUDIO_NORMALIZE_TIMEOUT_MS || 12_000),
      maxBuffer: 1024 * 1024,
    });

    const normalizedBuffer = await readFile(outputPath);
    if (process.env.VOICE_DEBUG_LOGS !== '0') {
      console.info('[voice-transcribe]', JSON.stringify({
        at: new Date().toISOString(),
        event: 'audio_normalized',
        details: {
          provider: 'openai',
          fromMimeType: normalizeMimeType(mimeType),
          fromBytes: buffer.length,
          toMimeType: 'audio/wav',
          toBytes: normalizedBuffer.length,
          elapsedMs: Date.now() - startedAt,
        },
      }));
    }

    return { buffer: normalizedBuffer, mimeType: 'audio/wav', originalName: 'voice-normalized.wav', normalized: true };
  } catch (error) {
    if (process.env.VOICE_DEBUG_LOGS !== '0') {
      console.info('[voice-transcribe]', JSON.stringify({
        at: new Date().toISOString(),
        event: 'audio_normalize_failed',
        details: {
          provider: 'openai',
          mimeType: normalizeMimeType(mimeType),
          originalName,
          error: error instanceof Error ? error.message.slice(0, 240) : 'unknown',
        },
      }));
    }
    return { buffer, mimeType, originalName, normalized: false };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
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

function extractOpenAITranscript(payload: unknown) {
  const text = getObjectValue(payload, 'text');
  return typeof text === 'string' ? text.trim() : '';
}

function getProviderErrorCode(payload: unknown, fallbackCode: string) {
  const error = getObjectValue(payload, 'error');
  const nestedCode = getObjectValue(error, 'code');
  const topLevelCode = getObjectValue(payload, 'code');
  const code = typeof nestedCode === 'string' ? nestedCode : typeof topLevelCode === 'string' ? topLevelCode : '';
  if (code === 'unsupported_country_region_territory') return 'VOICE_PROVIDER_REGION_UNSUPPORTED';
  return fallbackCode;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1500, timeoutMs));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && String((error as { name?: unknown }).name) === 'AbortError') {
      throw new VoiceProviderRequestError('openai', 504, 'VOICE_PROVIDER_FETCH_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

class VoiceService {
  getStatus(): VoiceStatus {
    return {
      configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      provider: getProvider(),
      model: getModel(),
      maxAudioMb: getMaxAudioMb(),
      language: getLanguage(),
      supportedProviders: ['openai'],
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      audioNormalize: process.env.VOICE_AUDIO_NORMALIZE !== '0',
    };
  }

  async transcribe({ buffer, mimeType, originalName, language }: TranscribeParams): Promise<TranscribeResult> {
    const provider = getProvider();
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new VoiceTranscriptionNotConfiguredError();

    const inferredMimeType = inferMimeType(mimeType, originalName);
    assertSupportedAudio(buffer, inferredMimeType, originalName);

    const audio = await normalizeAudioForStt(buffer, inferredMimeType, originalName);
    const model = getModel();
    const normalizedLanguage = getLanguage(language);
    const filename = sanitizeFilename(audio.originalName, audio.mimeType);

    const formData = new FormData();
    formData.append('file', new Blob([audio.buffer], { type: audio.mimeType }), filename);
    formData.append('model', model);
    formData.append('language', normalizedLanguage);
    formData.append('response_format', 'json');
    formData.append('prompt', getSttPrompt());

    const response = await fetchWithTimeout('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    }, Number(process.env.OPENAI_TRANSCRIBE_TIMEOUT_MS || process.env.VOICE_PROVIDER_TIMEOUT_MS || 45_000));

    const payload = await readJsonSafely(response);
    if (!response.ok) {
      throw new VoiceProviderRequestError('openai', response.status, getProviderErrorCode(payload, 'VOICE_OPENAI_REQUEST_FAILED'), payload);
    }

    return {
      text: extractOpenAITranscript(payload),
      provider,
      model,
      language: normalizedLanguage,
      normalized: audio.normalized,
    };
  }
}

export const voiceService = new VoiceService();

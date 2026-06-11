import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import type { RecorderFormat } from './voiceRecorderPlatform';
import {
  VOICE_RECORDER_DEFAULT_SESSION_MS,
  VOICE_RECORDER_MAX_SESSION_MS,
  VOICE_RECORDER_MIN_SESSION_MS,
} from './voiceRecorder.constants';

export function getBestRecorderFormat(formats: RecorderFormat[], platform: string): RecorderFormat | null {
  if (typeof MediaRecorder === 'undefined') {
    logVoiceDebugEvent('mediarecorder_unavailable', { platform });
    return null;
  }

  const selected = formats.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null;
  logVoiceDebugEvent('recorder_format_selected', {
    platform,
    mimeType: selected?.mimeType,
    extension: selected?.extension,
    candidates: formats.map((format) => format.mimeType).join(',').slice(0, 220),
  });
  return selected;
}

export function toSttLanguage(lang: string) {
  return lang.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

export function clampVoiceRecorderSessionMs(value: number) {
  if (!Number.isFinite(value)) return VOICE_RECORDER_DEFAULT_SESSION_MS;
  return Math.max(
    VOICE_RECORDER_MIN_SESSION_MS,
    Math.min(VOICE_RECORDER_MAX_SESSION_MS, Math.round(value)),
  );
}

export function hasActiveTracks(stream: MediaStream | null) {
  return Boolean(stream?.getTracks().some((track) => track.readyState === 'live'));
}

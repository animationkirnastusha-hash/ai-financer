import { ANDROID_AUDIO_CONSTRAINTS, ANDROID_RECORDER_FORMATS, ANDROID_VAD_PROFILE } from './voiceRecorderAndroid';
import { IOS_AUDIO_CONSTRAINTS, IOS_RECORDER_FORMATS, IOS_VAD_PROFILE } from './voiceRecorderIos';

export type VoiceRecorderPlatform = 'ios' | 'android' | 'desktop';

export type RecorderFormat = {
  mimeType: string;
  extension: string;
};

export type VoiceVadProfile = {
  minRecordingMs: number;
  noVoiceAutoStopMs: number;
  graceAfterVoiceMs: number;
  graceAfterStrongVoiceMs: number;
  voiceRms: number;
  continueRms: number;
  strongVoiceRms: number;
};

export type VoiceRecorderPlatformConfig = {
  platform: VoiceRecorderPlatform;
  formats: RecorderFormat[];
  audioConstraints: MediaTrackConstraints;
  vad: VoiceVadProfile;
};

const DESKTOP_RECORDER_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/aac', extension: 'aac' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mimeType: 'audio/ogg', extension: 'ogg' },
];

const DESKTOP_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
};

const DESKTOP_VAD_PROFILE: VoiceVadProfile = {
  minRecordingMs: 900,
  noVoiceAutoStopMs: 1900,
  graceAfterVoiceMs: 2000,
  graceAfterStrongVoiceMs: 2300,
  voiceRms: 0.018,
  continueRms: 0.011,
  strongVoiceRms: 0.075,
};

function getUserAgent() {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}

export function getVoiceRecorderPlatform(userAgent = getUserAgent()): VoiceRecorderPlatform {
  const value = userAgent.toLowerCase();
  const isIPadOSDesktopMode = value.includes('macintosh') && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(value) || isIPadOSDesktopMode) return 'ios';
  if (value.includes('android')) return 'android';
  return 'desktop';
}

export function getVoiceRecorderPlatformConfig(platform = getVoiceRecorderPlatform()): VoiceRecorderPlatformConfig {
  if (platform === 'ios') {
    return {
      platform,
      formats: IOS_RECORDER_FORMATS,
      audioConstraints: IOS_AUDIO_CONSTRAINTS,
      vad: IOS_VAD_PROFILE,
    };
  }

  if (platform === 'android') {
    return {
      platform,
      formats: ANDROID_RECORDER_FORMATS,
      audioConstraints: ANDROID_AUDIO_CONSTRAINTS,
      vad: ANDROID_VAD_PROFILE,
    };
  }

  return {
    platform,
    formats: DESKTOP_RECORDER_FORMATS,
    audioConstraints: DESKTOP_AUDIO_CONSTRAINTS,
    vad: DESKTOP_VAD_PROFILE,
  };
}

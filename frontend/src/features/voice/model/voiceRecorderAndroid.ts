import type { RecorderFormat, VoiceVadProfile } from './voiceRecorderPlatform';

// Android Telegram/Chrome records WEBM/Opus reliably and it is cheaper to send than WAV.
export const ANDROID_RECORDER_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
  { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mimeType: 'audio/ogg', extension: 'ogg' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
];

export const ANDROID_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
};

export const ANDROID_VAD_PROFILE: VoiceVadProfile = {
  minRecordingMs: 2350,
  noVoiceAutoStopMs: 2400,
  graceAfterVoiceMs: 1150,
  graceAfterStrongVoiceMs: 950,
  voiceRms: 0.014,
  continueRms: 0.009,
  strongVoiceRms: 0.034,
};

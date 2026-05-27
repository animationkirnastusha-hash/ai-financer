import type { RecorderFormat, VoiceVadProfile } from './voiceRecorderPlatform';

// iOS/WebKit can report audio/webm support, but real Telegram/Safari blobs may be silent or decoded poorly by STT.
// Keep iPhone/iPad on MP4/AAC first and use WEBM only as a last fallback.
export const IOS_RECORDER_FORMATS: RecorderFormat[] = [
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { mimeType: 'audio/mp4', extension: 'm4a' },
  { mimeType: 'audio/aac', extension: 'aac' },
  { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
  { mimeType: 'audio/webm', extension: 'webm' },
];

export const IOS_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: false,
  autoGainControl: true,
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 44100 },
  sampleSize: { ideal: 16 },
};

export const IOS_VAD_PROFILE: VoiceVadProfile = {
  minRecordingMs: 700,
  noVoiceAutoStopMs: 1100,
  graceAfterVoiceMs: 1050,
  graceAfterStrongVoiceMs: 1200,
  voiceRms: 0.020,
  continueRms: 0.014,
  strongVoiceRms: 0.080,
};

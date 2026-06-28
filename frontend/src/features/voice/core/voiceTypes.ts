export type VoiceInputState = 'idle' | 'recording' | 'uploading' | 'speaking' | 'error';
export type VoiceInputMode = 'speech' | 'recorder';
export type VoiceStartResult = 'started' | 'permission-consumed' | 'permission-ready' | 'busy' | 'error';
export type MicrophonePermissionState = PermissionState | 'unsupported' | 'unknown';
export type VoiceCue = 'here' | 'listening' | 'thinking' | 'done' | 'not-heard' | 'confirm';

export type VoiceDebugDetails = Record<string, string | number | boolean | null | undefined>;

export type VoiceTranscriptionResponse = {
  success: boolean;
  text: string;
  provider?: string;
  model?: string;
  language?: string;
  message?: string;
  code?: string;
};

export type VoiceStatusResponse = {
  success: boolean;
  configured: boolean;
  provider: string;
  model: string;
  maxAudioMb: number;
  language: string;
};

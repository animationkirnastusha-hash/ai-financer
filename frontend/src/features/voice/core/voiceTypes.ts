export type {
  VoiceInputState,
  VoiceInputMode,
  VoicePermissionState,
  VoicePermissionState as MicrophonePermissionState,
  VoiceStartResult,
  VoiceCaptureMode,
  VoiceSessionPhase,
  VoiceCompanionMood,
  VoiceBubbleTone,
  VoiceThought,
  VoiceSessionSegment,
  VoicePointerHandler,
} from './voiceCapture.types';

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

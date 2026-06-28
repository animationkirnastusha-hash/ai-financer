export type { VoiceInputMode, VoiceInputState } from '@/features/voice/core/voiceTypes';

export type VoiceRecognitionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'unsupported'
  | 'error';

export type VoiceRecognitionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'unsupported'
  | 'error';

export type VoiceInputState =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'speaking'
  | 'error';

export type VoiceInputMode = 'speech' | 'recorder';
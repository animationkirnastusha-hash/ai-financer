import type { PointerEvent as ReactPointerEvent } from 'react';

export type VoiceInputState = 'idle' | 'recording' | 'uploading' | 'speaking' | 'error';
export type VoiceInputMode = 'recorder';
export type VoicePermissionState = PermissionState | 'unsupported' | 'unknown';
export type VoiceStartResult = 'started' | 'busy' | 'permission-ready' | 'error';
export type VoiceCaptureMode = 'manual' | 'locked';
export type VoiceSessionPhase = 'idle' | 'holding' | 'locked' | 'uploading' | 'dispatching' | 'cooldown';
export type VoiceCompanionMood = 'idle' | 'listening' | 'thinking' | 'confirm' | 'success' | 'warning';
export type VoiceBubbleTone = 'neutral' | 'listening' | 'thinking' | 'success' | 'warning';

export type VoiceThought = {
  id: string;
  text: string;
  tone: VoiceBubbleTone;
};

export type VoiceSessionSegment = {
  text: string;
  role: 'initial' | 'continuation' | 'correction';
  at: number;
};

export type VoicePointerHandler<T extends Element = Element> = (event: ReactPointerEvent<T>) => void;

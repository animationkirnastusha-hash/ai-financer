import type { PointerEvent } from 'react';
import type { VoiceCompanionMood, VoiceThought, VoiceBubbleTone } from '@/features/voice/model/voiceSession.types';
import type { VoiceInputState } from '@/features/voice/model/voice.types';
import type { VoiceCaptureMode, VoiceSessionPhase } from '@/features/voice/model/voiceSession.types';

export type GestureMode = 'idle' | 'holding';

export type GestureRuntime = {
  pointerId: number | null;
  startX: number;
  startY: number;
  started: boolean;
  releaseAfterStart: boolean;
  cancelled: boolean;
  mode: GestureMode;
};

export type ShowVoiceThought = (text: string, tone?: VoiceBubbleTone, timeoutMs?: number) => void;

export type VoiceCompanionSurfaceProps = {
  needsIntro: boolean;
  showFloatingCompanion: boolean;
  wakeName: string;
  isPriming: boolean;
  permissionState: PermissionState | 'unsupported' | 'unknown';
  onPrimePermission: () => Promise<void> | void;
  onSkipPermissionIntro: () => void;
  thought: VoiceThought | null;
  canUseVoice: boolean;
  isBusy: boolean;
  voiceState: VoiceInputState;
  captureMode: VoiceCaptureMode;
  phase: VoiceSessionPhase;
  cooldownUntil: number;
  mood: VoiceCompanionMood;
  ariaLabel: string;
  tapToTextEnabled?: boolean;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
};

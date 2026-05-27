export type VoiceCompanionMood = 'idle' | 'listening' | 'thinking' | 'confirm' | 'success' | 'warning';
export type VoiceBubbleTone = 'neutral' | 'listening' | 'thinking' | 'success' | 'warning';
export type VoiceCaptureMode = 'wake' | 'command';
export type VoiceSessionPhase = 'idle' | 'wake' | 'command' | 'dispatching' | 'cooldown';
export type VoiceSegmentRole = 'initial' | 'continuation' | 'correction';

export type VoiceThought = {
  id: string;
  text: string;
  tone: VoiceBubbleTone;
};

export type VoiceSessionSegment = {
  text: string;
  role: VoiceSegmentRole;
  at: number;
};

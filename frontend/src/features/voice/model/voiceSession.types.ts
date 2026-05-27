export type VoiceCompanionMood = 'idle' | 'listening' | 'thinking' | 'confirm' | 'success' | 'warning';
export type VoiceBubbleTone = 'neutral' | 'listening' | 'thinking' | 'success' | 'warning';
export type VoiceCaptureMode = 'wake' | 'command';
export type VoiceSessionPhase = 'idle' | 'wake' | 'command' | 'transcribing' | 'dispatching' | 'clarification' | 'confirm' | 'success' | 'cooldown' | 'error';
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

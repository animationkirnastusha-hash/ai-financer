import { usePressToTalkVoice } from '@/features/voice/core';
import type { VoiceCue } from '@/features/voice/core';

type UseVoiceInputParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  sessionMs?: number;
  permissionWasPrompted?: boolean;
};

export function useVoiceInput(params: UseVoiceInputParams) {
  return usePressToTalkVoice(params);
}

export type { VoiceCue };

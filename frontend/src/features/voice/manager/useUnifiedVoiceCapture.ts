import { usePressToTalkVoice } from '@/features/voice/core';
import type { VoiceCue } from '@/features/voice/core';

type UseUnifiedVoiceCaptureParams = {
  onText: (text: string) => Promise<void> | void;
  lang?: string;
  sessionMs?: number;
  permissionWasPrompted?: boolean;
  watchdogMs?: number;
  onWatchdogTimeout?: () => void;
};

export function useUnifiedVoiceCapture({ watchdogMs: _watchdogMs, onWatchdogTimeout: _onWatchdogTimeout, ...params }: UseUnifiedVoiceCaptureParams) {
  return usePressToTalkVoice(params);
}

export type { VoiceCue };

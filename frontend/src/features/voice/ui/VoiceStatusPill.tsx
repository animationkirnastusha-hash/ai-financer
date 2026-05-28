import type { VoiceCaptureMode, VoiceSessionPhase } from '@/features/voice/model/voiceSession.types';
import type { VoiceInputState } from '@/features/voice/model/voice.types';

type VoiceStatusPillProps = {
  canUseVoice: boolean;
  isBusy: boolean;
  voiceState: VoiceInputState;
  captureMode: VoiceCaptureMode;
  phase?: VoiceSessionPhase;
  cooldownUntil?: number;
  isLocked?: boolean;
};

export function VoiceStatusPill({
  canUseVoice,
  isBusy,
  voiceState,
  phase = 'idle',
  isLocked = false,
}: VoiceStatusPillProps) {
  let label = 'Голос выключен';

  if (canUseVoice) {
    if (isBusy || phase === 'dispatching') label = 'Выполняю';
    else if (voiceState === 'uploading' || phase === 'uploading') label = 'Распознаю';
    else if (isLocked || phase === 'locked') label = 'Запись закреплена';
    else if (voiceState === 'recording' || phase === 'holding') label = 'Слушаю';
    else if (phase === 'cooldown') label = 'Готова';
    else label = 'Зажми для голоса';
  }

  return (
    <div className={canUseVoice ? 'voice-first-status voice-first-status--on' : 'voice-first-status'}>
      {label}
    </div>
  );
}

import type { VoiceCaptureMode, VoiceSessionPhase } from '@/features/voice/model/voiceSession.types';
import type { VoiceInputState } from '@/features/voice/model/voice.types';
import { useI18n } from '@/shared/lib/i18n';

type VoiceStatusPillProps = {
  canUseVoice: boolean;
  isBusy: boolean;
  voiceState: VoiceInputState;
  captureMode: VoiceCaptureMode;
  phase?: VoiceSessionPhase;
  cooldownUntil?: number;
};

export function VoiceStatusPill({
  canUseVoice,
  isBusy,
  voiceState,
  phase = 'idle',
}: VoiceStatusPillProps) {
  const { t } = useI18n();
  let label = t('voice.status.off');

  if (canUseVoice) {
    if (isBusy || phase === 'dispatching') label = t('voice.status.dispatching');
    else if (voiceState === 'uploading' || phase === 'uploading') label = t('voice.status.uploading');
    else if (voiceState === 'recording' || phase === 'holding') label = t('voice.status.listening');
    else if (phase === 'cooldown') label = t('voice.status.ready');
    else label = t('voice.status.tapTextHoldVoice');
  }

  return (
    <div className={canUseVoice ? 'voice-first-status voice-first-status--on' : 'voice-first-status'}>
      {label}
    </div>
  );
}

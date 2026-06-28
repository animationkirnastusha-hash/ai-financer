import type { VoiceCaptureMode, VoiceSessionPhase } from '@/features/voice';
import type { VoiceInputState } from '@/features/voice';
import { useI18n } from '@/shared/lib/i18n';

type VoiceStatusPillProps = {
  canUseVoice: boolean;
  isBusy: boolean;
  voiceState: VoiceInputState;
  captureMode: VoiceCaptureMode;
  phase?: VoiceSessionPhase;
  cooldownUntil?: number;
  tapToTextEnabled?: boolean;
};

export function VoiceStatusPill({
  canUseVoice,
  isBusy,
  voiceState,
  phase = 'idle',
  tapToTextEnabled = true,
}: VoiceStatusPillProps) {
  const { t } = useI18n();
  let label = t('voice.status.off');

  if (canUseVoice) {
    if (isBusy || phase === 'dispatching') label = t('voice.status.dispatching');
    else if (voiceState === 'uploading' || phase === 'uploading') label = t('voice.status.uploading');
    else if (voiceState === 'recording' || phase === 'holding') label = t('voice.status.listening');
    else if (phase === 'cooldown') label = t('voice.status.ready');
    else label = t(tapToTextEnabled ? 'voice.status.tapTextHoldVoice' : 'voice.status.holdVoiceOnly');
  }

  return (
    <div className={canUseVoice ? 'voice-first-status voice-first-status--on' : 'voice-first-status'}>
      {label}
    </div>
  );
}

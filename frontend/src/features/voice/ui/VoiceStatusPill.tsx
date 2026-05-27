import type { VoiceCaptureMode, VoiceSessionPhase } from '@/features/voice/model/voiceSession.types';
import type { VoiceInputState } from '@/features/voice/model/voice.types';

type VoiceStatusPillProps = {
  canUseVoice: boolean;
  isBusy: boolean;
  voiceState: VoiceInputState;
  captureMode: VoiceCaptureMode;
  phase: VoiceSessionPhase;
  cooldownUntil: number;
  voiceAlwaysOnEnabled: boolean;
  wakeName: string;
};

export function VoiceStatusPill({
  canUseVoice,
  isBusy,
  voiceState,
  captureMode,
  phase,
  cooldownUntil,
  voiceAlwaysOnEnabled,
  wakeName,
}: VoiceStatusPillProps) {
  let label = 'Голос выключен';

  if (canUseVoice) {
    const cooldownLeftMs = Math.max(0, cooldownUntil - Date.now());

    if (phase === 'dispatching' || isBusy) label = 'Выполняю';
    else if (voiceState === 'uploading') label = captureMode === 'command' ? 'Распознаю команду' : 'Проверяю имя';
    else if (voiceState === 'recording') label = captureMode === 'command' ? 'Слушаю команду' : `Жду «${wakeName}»`;
    else if (phase === 'command' || captureMode === 'command') label = 'Слушаю команду';
    else if (phase === 'cooldown' && cooldownLeftMs > 0) label = `Жду «${wakeName}»`;
    else label = voiceAlwaysOnEnabled ? `Жду «${wakeName}»` : 'Голос выключен';
  }

  return (
    <div className={canUseVoice ? 'voice-first-status voice-first-status--on' : 'voice-first-status'}>
      {label}
    </div>
  );
}

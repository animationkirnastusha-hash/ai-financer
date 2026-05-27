import type { VoiceCaptureMode, VoiceSessionPhase } from '@/features/voice/model/voiceSession.types';
import type { VoiceInputState } from '@/features/voice/model/voice.types';

type VoiceStatusPillProps = {
  canUseVoice: boolean;
  isBusy: boolean;
  voiceState: VoiceInputState;
  captureMode: VoiceCaptureMode;
  voiceAlwaysOnEnabled: boolean;
  wakeName: string;
  phase?: VoiceSessionPhase;
  cooldownUntil?: number;
};

export function VoiceStatusPill({
  canUseVoice,
  isBusy,
  voiceState,
  captureMode,
  voiceAlwaysOnEnabled,
  wakeName,
  phase = 'idle',
  cooldownUntil = 0,
}: VoiceStatusPillProps) {
  let label = 'Голос выключен';
  const isCooldown = phase === 'cooldown' || Date.now() < cooldownUntil;

  if (canUseVoice) {
    if (isBusy) label = 'Выполняю';
    else if (isCooldown) label = `Жду «${wakeName}»`;
    else if (voiceState === 'uploading') label = captureMode === 'command' ? 'Распознаю команду' : 'Проверяю имя';
    else if (voiceState === 'recording') label = captureMode === 'command' ? 'Слушаю команду' : `Жду «${wakeName}»`;
    else if (captureMode === 'command') label = 'Слушаю команду';
    else label = voiceAlwaysOnEnabled ? `Жду «${wakeName}»` : 'Голос выключен';
  }

  return (
    <div className={canUseVoice ? 'voice-first-status voice-first-status--on' : 'voice-first-status'}>
      {label}
    </div>
  );
}

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
  hasConfirmation?: boolean;
  hasClarification?: boolean;
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
  hasConfirmation = false,
  hasClarification = false,
}: VoiceStatusPillProps) {
  let label = 'Голос выключен';
  const isCooldown = phase === 'cooldown' || Date.now() < cooldownUntil;

  if (canUseVoice) {
    if (hasConfirmation) label = 'Жду подтверждение';
    else if (hasClarification) label = `Жду уточнение после «${wakeName}»`;
    else if (isBusy || phase === 'dispatching') label = 'Выполняю';
    else if (voiceState === 'uploading' || phase === 'transcribing') label = captureMode === 'command' ? 'Распознаю команду' : 'Проверяю имя';
    else if (voiceState === 'recording') label = captureMode === 'command' ? 'Слушаю команду' : `Жду «${wakeName}»`;
    else if (isCooldown) label = 'Пауза';
    else if (captureMode === 'command') label = 'Слушаю команду';
    else label = voiceAlwaysOnEnabled ? `Жду «${wakeName}»` : 'Голос выключен';
  }

  const className = [
    'voice-first-status',
    canUseVoice ? 'voice-first-status--on' : '',
    voiceState === 'recording' ? 'voice-first-status--recording' : '',
    voiceState === 'uploading' || isBusy ? 'voice-first-status--thinking' : '',
    hasConfirmation || hasClarification ? 'voice-first-status--attention' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <span className="voice-first-status__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

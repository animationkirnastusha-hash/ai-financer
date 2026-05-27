import type { VoiceCaptureMode } from '@/features/voice/model/voiceSession.types';
import type { VoiceInputState } from '@/features/voice/model/voice.types';

type VoiceStatusPillProps = {
  canUseVoice: boolean;
  isBusy: boolean;
  voiceState: VoiceInputState;
  captureMode: VoiceCaptureMode;
  voiceAlwaysOnEnabled: boolean;
  wakeName: string;
};

export function VoiceStatusPill({
  canUseVoice,
  isBusy,
  voiceState,
  captureMode,
  voiceAlwaysOnEnabled,
  wakeName,
}: VoiceStatusPillProps) {
  let label = 'Голос выключен';

  if (canUseVoice) {
    if (isBusy) label = 'Выполняю';
    else if (voiceState === 'uploading') label = captureMode === 'command' ? 'Распознаю команду' : 'Проверяю имя';
    else if (voiceState === 'recording') label = captureMode === 'command' ? 'Слушаю команду' : 'Слушаю';
    else if (captureMode === 'command') label = 'Слушаю команду';
    else label = voiceAlwaysOnEnabled ? `Жду «${wakeName}»` : 'Голос выключен';
  }

  return (
    <div className={canUseVoice ? 'voice-first-status voice-first-status--on' : 'voice-first-status'}>
      {label}
    </div>
  );
}

import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useI18n } from '@/shared/lib/i18n';

export function VoiceKeyboardEntry() {
  const { t } = useI18n();
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  return (
    <button
      type="button"
      className="voice-keyboard-entry"
      aria-label={t('textChat.title')}
      data-no-swipe="true"
      onClick={() => openAIWithCommand()}
    >
      ⌨
    </button>
  );
}

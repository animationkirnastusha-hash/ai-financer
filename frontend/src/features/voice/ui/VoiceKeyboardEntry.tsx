import { useNavigationStore } from '@/features/navigation/model/navigation.store';

export function VoiceKeyboardEntry() {
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  return (
    <button
      type="button"
      className="voice-keyboard-entry"
      aria-label="Открыть текстовый ввод"
      data-no-swipe="true"
      onClick={() => openAIWithCommand()}
    >
      ⌨
    </button>
  );
}

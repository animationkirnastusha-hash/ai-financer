import { useEffect } from 'react';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';

type OpenModal = (modal: AppModalDescriptor) => void;

type TextChatEventDetail = {
  command?: string | null;
  mode?: 'text' | 'voice';
  autoStartVoice?: boolean;
  autoCloseOnVoiceResult?: boolean;
  autoSubmitInitialCommand?: boolean;
};

export function useTextChatModalEvent(openModal: OpenModal) {
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<TextChatEventDetail>).detail;
      openModal({
        type: 'ai-text-overlay',
        initialCommand: detail?.command ?? null,
        mode: detail?.mode ?? 'text',
        autoStartVoice: Boolean(detail?.autoStartVoice),
        autoCloseOnVoiceResult: Boolean(detail?.autoCloseOnVoiceResult),
        autoSubmitInitialCommand: Boolean(detail?.autoSubmitInitialCommand),
      });
    };

    window.addEventListener('ai-financer:open-text-chat', handler);
    return () => window.removeEventListener('ai-financer:open-text-chat', handler);
  }, [openModal]);
}

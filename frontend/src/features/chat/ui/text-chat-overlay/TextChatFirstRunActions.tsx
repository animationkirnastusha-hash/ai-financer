import type { FirstRunSetupStage } from '@/features/chat/model/firstRunChatSetup.store';

type Props = {
  stage: FirstRunSetupStage;
  isBusy: boolean;
  enableMicLabel: string;
  skipLabel: string;
  closeChatLabel: string;
  onEnableMic: () => void | Promise<void>;
  onSkipMic: () => void;
  onCloseChat: () => void;
};

export function TextChatFirstRunActions({
  stage,
  isBusy,
  enableMicLabel,
  skipLabel,
  closeChatLabel,
  onEnableMic,
  onSkipMic,
  onCloseChat,
}: Props) {
  if (stage === 'microphone') {
    return (
      <div className="text-chat-setup-panel" role="group" aria-label={enableMicLabel}>
        <button
          type="button"
          className="text-chat-setup-panel__primary"
          disabled={isBusy}
          onClick={() => void onEnableMic()}
        >
          <span className="text-chat-setup-panel__icon" aria-hidden="true">🎙</span>
          <span>{enableMicLabel}</span>
        </button>
        <button
          type="button"
          disabled={isBusy}
          className="text-chat-setup-panel__secondary"
          onClick={onSkipMic}
        >
          {skipLabel}
        </button>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="text-chat-setup-panel" role="group">
        <button
          type="button"
          className="text-chat-setup-panel__primary"
          disabled={isBusy}
          onClick={onCloseChat}
        >
          {closeChatLabel}
        </button>
      </div>
    );
  }

  return null;
}

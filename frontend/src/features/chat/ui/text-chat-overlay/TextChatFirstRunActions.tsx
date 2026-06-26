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
      <div className="text-chat-setup-actions" role="group">
        <button type="button" disabled={isBusy} onClick={() => void onEnableMic()}>{enableMicLabel}</button>
        <button type="button" disabled={isBusy} className="is-secondary" onClick={onSkipMic}>{skipLabel}</button>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="text-chat-setup-actions" role="group">
        <button type="button" disabled={isBusy} onClick={onCloseChat}>{closeChatLabel}</button>
      </div>
    );
  }

  return null;
}

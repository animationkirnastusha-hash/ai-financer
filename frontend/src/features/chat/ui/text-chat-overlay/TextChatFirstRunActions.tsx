import type { FirstRunSetupStage } from '@/features/chat/model/firstRunChatSetup.store';

type Props = {
  stage: FirstRunSetupStage;
  isBusy: boolean;
  enableMicLabel: string;
  skipLabel: string;
  closeChatLabel: string;
  skipBalanceLabel: string;
  onEnableMic: () => void | Promise<void>;
  onSkipMic: () => void;
  onSkipBalance: () => void;
  onCloseChat: () => void;
};

export function TextChatFirstRunActions({
  stage,
  isBusy,
  enableMicLabel,
  skipLabel,
  closeChatLabel,
  skipBalanceLabel,
  onEnableMic,
  onSkipMic,
  onSkipBalance,
  onCloseChat,
}: Props) {
  if (stage === 'microphone') {
    return (
      <div className="text-chat-setup-actions text-chat-setup-actions--microphone" role="group">
        <button type="button" disabled={isBusy} onClick={() => void onEnableMic()}>{enableMicLabel}</button>
        <button type="button" disabled={isBusy} className="is-secondary" onClick={onSkipMic}>{skipLabel}</button>
      </div>
    );
  }

  if (stage === 'balance') {
    return (
      <div className="text-chat-setup-actions text-chat-setup-actions--balance" role="group">
        <button type="button" disabled={isBusy} className="is-secondary" onClick={onSkipBalance}>{skipBalanceLabel}</button>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="text-chat-setup-actions text-chat-setup-actions--done" role="group">
        <button type="button" disabled={isBusy} onClick={onCloseChat}>{closeChatLabel}</button>
      </div>
    );
  }

  return null;
}

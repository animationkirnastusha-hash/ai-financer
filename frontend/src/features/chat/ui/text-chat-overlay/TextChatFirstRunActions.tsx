import type { FirstRunSetupStage } from '@/features/chat/model/firstRunChatSetup.store';

type Props = {
  stage: FirstRunSetupStage;
  isBusy: boolean;
  closeChatLabel: string;
  skipBalanceLabel: string;
  onSkipBalance: () => void;
  onCloseChat: () => void;
};

export function TextChatFirstRunActions({
  stage,
  isBusy,
  closeChatLabel,
  skipBalanceLabel,
  onSkipBalance,
  onCloseChat,
}: Props) {
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

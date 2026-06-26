import type { FirstRunSetupStage } from '@/features/chat/model/firstRunChatSetup.store';

type Props = {
  stage: FirstRunSetupStage;
  isBusy: boolean;
  enableMicLabel: string;
  skipLabel: string;
  cardLabel: string;
  cashLabel: string;
  customLabel: string;
  zeroBalanceLabel: string;
  quickBalanceLabel: string;
  closeChatLabel: string;
  customAccountHint: string;
  customBalanceHint: string;
  onEnableMic: () => void | Promise<void>;
  onSkipMic: () => void;
  onCard: () => void;
  onCash: () => void;
  onCustomAccount: () => void;
  onZeroBalance: () => void | Promise<void>;
  onQuickBalance: () => void | Promise<void>;
  onCustomBalance: () => void;
  onCloseChat: () => void;
};

export function TextChatFirstRunActions({
  stage,
  isBusy,
  enableMicLabel,
  skipLabel,
  cardLabel,
  cashLabel,
  customLabel,
  zeroBalanceLabel,
  quickBalanceLabel,
  closeChatLabel,
  customAccountHint,
  customBalanceHint,
  onEnableMic,
  onSkipMic,
  onCard,
  onCash,
  onCustomAccount,
  onZeroBalance,
  onQuickBalance,
  onCustomBalance,
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

  if (stage === 'account') {
    return (
      <div className="text-chat-setup-actions" role="group">
        <button type="button" disabled={isBusy} onClick={onCard}>{cardLabel}</button>
        <button type="button" disabled={isBusy} onClick={onCash}>{cashLabel}</button>
        <button type="button" disabled={isBusy} className="is-secondary" onClick={onCustomAccount}>{customLabel}</button>
      </div>
    );
  }

  if (stage === 'account_custom') {
    return <div className="text-chat-setup-hint">{customAccountHint}</div>;
  }

  if (stage === 'balance') {
    return (
      <div className="text-chat-setup-actions" role="group">
        <button type="button" disabled={isBusy} onClick={() => void onZeroBalance()}>{zeroBalanceLabel}</button>
        <button type="button" disabled={isBusy} onClick={() => void onQuickBalance()}>{quickBalanceLabel}</button>
        <button type="button" disabled={isBusy} className="is-secondary" onClick={onCustomBalance}>{customLabel}</button>
      </div>
    );
  }

  if (stage === 'balance_custom') {
    return <div className="text-chat-setup-hint">{customBalanceHint}</div>;
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

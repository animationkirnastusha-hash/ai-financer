import { CompanionButton } from '@/shared/ui/CompanionButton';

type Props = {
  state?: string;
  isActive?: boolean;
  isVoiceLocked?: boolean;
  onClick?: () => void;
  onTap?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  onHoldCancel?: () => void;
  onHoldLock?: () => void;
  onLockedDone?: () => void;
  onLockedCancel?: () => void;
};

export function AICoreOrb({ state, isActive = false, isVoiceLocked = false, onClick, onTap, onHoldStart, onHoldEnd, onHoldCancel }: Props) {
  const active = isActive || isVoiceLocked || state === 'listening' || state === 'thinking';

  return (
    <div
      onPointerDown={onHoldStart}
      onPointerUp={onHoldEnd}
      onPointerCancel={onHoldCancel}
      onPointerLeave={onHoldCancel}
    >
      <CompanionButton
        size="lg"
        mood={active ? 'focused' : 'calm'}
        onClick={onTap || onClick}
        label="Открыть AI Companion"
      />
    </div>
  );
}

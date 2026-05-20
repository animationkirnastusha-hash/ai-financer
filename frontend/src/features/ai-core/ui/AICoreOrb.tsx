import { useRef } from 'react';
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

const HOLD_DELAY_MS = 240;

export function AICoreOrb({
  state,
  isActive = false,
  isVoiceLocked = false,
  onClick,
  onTap,
  onHoldStart,
  onHoldEnd,
  onHoldCancel,
}: Props) {
  const active = isActive || isVoiceLocked || state === 'listening' || state === 'thinking';
  const holdTimerRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);

    clearHoldTimer();
    isHoldingRef.current = false;

    holdTimerRef.current = window.setTimeout(() => {
      isHoldingRef.current = true;
      document.body.classList.add('ai-voice-gesture-active');
      onHoldStart?.();
    }, HOLD_DELAY_MS);
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    event.preventDefault();
    clearHoldTimer();

    if (pointerIdRef.current !== null) {
      try {
        event.currentTarget.releasePointerCapture?.(pointerIdRef.current);
      } catch {
        // ignore pointer capture release race
      }
    }

    pointerIdRef.current = null;
    document.body.classList.remove('ai-voice-gesture-active');

    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      if (cancelled) onHoldCancel?.();
      else onHoldEnd?.();
      return;
    }

    if (!cancelled) {
      (onTap || onClick)?.();
    }
  };

  return (
    <div
      className="select-none"
      data-no-swipe="true"
      onPointerDown={handlePointerDown}
      onPointerUp={(event) => finishPointer(event)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <CompanionButton
        size="lg"
        mood={active ? state === 'listening' ? 'listening' : 'focused' : 'calm'}
        label="AI помощник"
        tabIndex={-1}
      />
    </div>
  );
}

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

const HOLD_DELAY_MS = 220;

function moodFromState(state?: string, active?: boolean, locked?: boolean) {
  if (locked || state === 'listening') return 'listening';
  if (state === 'thinking' || active) return 'thinking';
  if (state === 'success') return 'success';
  if (state === 'warning') return 'warning';
  return 'idle';
}

export function AICoreOrb({ state, isActive = false, isVoiceLocked = false, onClick, onTap, onHoldStart, onHoldEnd, onHoldCancel }: Props) {
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
      try { event.currentTarget.releasePointerCapture?.(pointerIdRef.current); } catch { /* ignore */ }
    }
    pointerIdRef.current = null;
    document.body.classList.remove('ai-voice-gesture-active');

    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      if (cancelled) onHoldCancel?.();
      else onHoldEnd?.();
      return;
    }

    if (!cancelled) (onTap || onClick)?.();
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
      <CompanionButton size="lg" mood={moodFromState(state, isActive, isVoiceLocked)} label="AI помощник" tabIndex={-1} />
    </div>
  );
}

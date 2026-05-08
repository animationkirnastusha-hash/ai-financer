import { useEffect, useRef } from 'react';
import type React from 'react';
import { cn } from '@/shared/lib/cn';
import type { AICoreState } from '@/features/ai-core/model/aiCore.types';

type Props = {
  state: AICoreState;
  onTap: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
};

function getStateLabel(state: AICoreState) {
  if (state === 'listening') return 'Слушаю';
  if (state === 'thinking') return 'Думаю';
  if (state === 'responding') return 'Готово';
  if (state === 'expanded') return 'Введите команду';
  return 'AI Core';
}

function getStateHint(state: AICoreState) {
  if (state === 'listening') return 'удерживай, пока говоришь';
  if (state === 'thinking') return 'проверяю действие';
  if (state === 'responding') return 'можно продолжать';
  if (state === 'expanded') return 'или зажми сферу для голоса';
  return 'нажми или зажми';
}

function getRingClasses(state: AICoreState) {
  if (state === 'listening') {
    return 'scale-[1.06] border-cyan-300/50 bg-cyan-400/15 shadow-[0_0_96px_rgba(34,211,238,0.34)]';
  }

  if (state === 'thinking') {
    return 'scale-[1.04] border-amber-300/40 bg-amber-400/12 shadow-[0_0_80px_rgba(251,191,36,0.24)]';
  }

  if (state === 'responding') {
    return 'scale-[1.05] border-emerald-300/45 bg-emerald-400/15 shadow-[0_0_90px_rgba(52,211,153,0.30)]';
  }

  return 'border-emerald-300/30 bg-emerald-400/8 shadow-[0_0_86px_rgba(45,212,191,0.24)]';
}

export function AICoreOrb({ state, onTap, onHoldStart, onHoldEnd }: Props) {
  const holdTimerRef = useRef<number | null>(null);
  const didHoldRef = useRef(false);
  const pointerIsDownRef = useRef(false);
  const cancelledByMoveRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const finishPointerInteraction = () => {
    if (!pointerIsDownRef.current) return;

    const wasHold = didHoldRef.current;
    const wasCancelled = cancelledByMoveRef.current;

    clearHoldTimer();

    pointerIsDownRef.current = false;
    didHoldRef.current = false;
    cancelledByMoveRef.current = false;

    if (wasCancelled) return;

    if (wasHold) {
      onHoldEnd();
      return;
    }

    onTap();
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => finishPointerInteraction();

    const handleGlobalPointerCancel = () => {
      clearHoldTimer();
      pointerIsDownRef.current = false;
      didHoldRef.current = false;
      cancelledByMoveRef.current = false;
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    pointerIsDownRef.current = true;
    didHoldRef.current = false;
    cancelledByMoveRef.current = false;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;

    clearHoldTimer();

    holdTimerRef.current = window.setTimeout(() => {
      if (!pointerIsDownRef.current || cancelledByMoveRef.current) return;

      didHoldRef.current = true;
      onHoldStart();
    }, 340);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerIsDownRef.current) return;

    const deltaX = Math.abs(event.clientX - startXRef.current);
    const deltaY = Math.abs(event.clientY - startYRef.current);

    if (deltaX > 14 || deltaY > 14) {
      cancelledByMoveRef.current = true;
      clearHoldTimer();
    }
  };

  return (
    <div className="flex flex-col items-center" data-no-swipe="true">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          'relative flex h-52 w-52 select-none items-center justify-center rounded-full border transition-all duration-300 active:scale-[0.985] sm:h-56 sm:w-56',
          getRingClasses(state),
        )}
        aria-label="AI Core"
      >
        <div className="absolute -inset-8 rounded-full border border-emerald-300/10" />
        <div className="absolute -inset-4 rounded-full border border-cyan-300/10" />
        <div className="absolute inset-4 rounded-full border border-white/10" />
        <div className="absolute inset-9 rounded-full border border-white/8" />

        {state === 'listening' ? (
          <div className="absolute bottom-12 flex items-end gap-1">
            <span className="h-3 w-1 rounded-full bg-cyan-200/60" />
            <span className="h-6 w-1 rounded-full bg-cyan-200/80" />
            <span className="h-4 w-1 rounded-full bg-cyan-200/65" />
            <span className="h-7 w-1 rounded-full bg-cyan-200/90" />
            <span className="h-3 w-1 rounded-full bg-cyan-200/60" />
          </div>
        ) : null}

        <div className="relative text-center">
          <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
            AI Core
          </div>

          <div className="mt-6 text-2xl font-semibold text-white">
            {getStateLabel(state)}
          </div>

          <div className="mt-2 text-sm text-white/42">{getStateHint(state)}</div>
        </div>
      </button>
    </div>
  );
}

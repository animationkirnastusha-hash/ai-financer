import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { cn } from '@/shared/lib/cn';
import type { AICoreState } from '@/features/ai-core/model/aiCore.types';

type VoiceGesture = 'idle' | 'holding' | 'cancel' | 'lock';

type Props = {
  state: AICoreState;
  isVoiceLocked?: boolean;
  onTap: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onHoldCancel: () => void;
  onHoldLock: () => void;
  onLockedDone: () => void;
  onLockedCancel: () => void;
};

function getStateLabel(state: AICoreState, isVoiceLocked: boolean) {
  if (isVoiceLocked) return 'Запись закреплена';
  if (state === 'listening') return 'Слушаю';
  if (state === 'thinking') return 'Думаю';
  if (state === 'responding') return 'Готово';
  return 'AI Core';
}

function getStateHint(state: AICoreState, isVoiceLocked: boolean) {
  if (isVoiceLocked) return 'нажми сферу, чтобы отправить';
  if (state === 'listening') return 'отпусти — отправить';
  if (state === 'thinking') return 'проверяю действие';
  if (state === 'responding') return 'можно продолжать';
  return 'зажми для голоса';
}

function getRingClasses(state: AICoreState, isVoiceLocked: boolean) {
  if (isVoiceLocked) {
    return 'scale-[1.04] border-emerald-200/60 bg-emerald-400/18 shadow-[0_0_110px_rgba(52,211,153,0.34)]';
  }

  if (state === 'listening') {
    return 'scale-[1.04] border-cyan-300/55 bg-cyan-400/15 shadow-[0_0_96px_rgba(34,211,238,0.32)]';
  }

  if (state === 'thinking') {
    return 'scale-[1.02] border-amber-300/40 bg-amber-400/12 shadow-[0_0_80px_rgba(251,191,36,0.24)]';
  }

  if (state === 'responding') {
    return 'scale-[1.03] border-emerald-300/45 bg-emerald-400/14 shadow-[0_0_90px_rgba(52,211,153,0.28)]';
  }

  return 'border-emerald-300/30 bg-emerald-400/8 shadow-[0_0_86px_rgba(45,212,191,0.22)]';
}

export function AICoreOrb({
  state,
  isVoiceLocked = false,
  onTap,
  onHoldStart,
  onHoldEnd,
  onHoldCancel,
  onHoldLock,
  onLockedDone,
  onLockedCancel,
}: Props) {
  const holdTimerRef = useRef<number | null>(null);
  const didHoldRef = useRef(false);
  const pointerIsDownRef = useRef(false);
  const gestureCompletedRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const [gesture, setGesture] = useState<VoiceGesture>('idle');

  const isListening = state === 'listening' || isVoiceLocked;
  const showGestureBar = state === 'listening' && !isVoiceLocked;

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const lockPageGestures = () => {
    document.documentElement.classList.add('ai-voice-gesture-active');
    document.body.classList.add('ai-voice-gesture-active');
  };

  const unlockPageGestures = () => {
    document.documentElement.classList.remove('ai-voice-gesture-active');
    document.body.classList.remove('ai-voice-gesture-active');
  };

  const resetPointerState = () => {
    clearHoldTimer();
    pointerIsDownRef.current = false;
    didHoldRef.current = false;
    gestureCompletedRef.current = false;
    setGesture('idle');
    if (!isVoiceLocked) unlockPageGestures();
  };

  const finishPointerInteraction = () => {
    if (!pointerIsDownRef.current) return;

    const wasHold = didHoldRef.current;
    const wasCompleted = gestureCompletedRef.current;

    clearHoldTimer();
    pointerIsDownRef.current = false;
    didHoldRef.current = false;
    gestureCompletedRef.current = false;

    if (wasCompleted) {
      setGesture('idle');
      if (!isVoiceLocked) unlockPageGestures();
      return;
    }

    if (wasHold) {
      setGesture('idle');
      if (!isVoiceLocked) unlockPageGestures();
      onHoldEnd();
      return;
    }

    setGesture('idle');
    if (!isVoiceLocked) unlockPageGestures();
  };

  useEffect(() => {
    const styleId = 'ai-voice-gesture-style';

    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        html.ai-voice-gesture-active,
        body.ai-voice-gesture-active {
          overflow: hidden !important;
          overscroll-behavior: none !important;
          touch-action: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    const preventPageMove = (event: Event) => {
      if (didHoldRef.current || isVoiceLocked) {
        event.preventDefault();
      }
    };

    const handleGlobalPointerUp = () => finishPointerInteraction();

    const handleGlobalPointerCancel = () => {
      if (didHoldRef.current && !gestureCompletedRef.current) {
        onHoldCancel();
      }
      resetPointerState();
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);
    window.addEventListener('touchmove', preventPageMove, { passive: false });
    window.addEventListener('wheel', preventPageMove, { passive: false });

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
      window.removeEventListener('touchmove', preventPageMove);
      window.removeEventListener('wheel', preventPageMove);
      unlockPageGestures();
    };
  }, [isVoiceLocked, onHoldCancel]);

  useEffect(() => {
    if (isVoiceLocked) {
      lockPageGestures();
      return;
    }

    if (!pointerIsDownRef.current) unlockPageGestures();
  }, [isVoiceLocked]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isVoiceLocked) return;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerIsDownRef.current = true;
    didHoldRef.current = false;
    gestureCompletedRef.current = false;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;

    clearHoldTimer();

    holdTimerRef.current = window.setTimeout(() => {
      if (!pointerIsDownRef.current || gestureCompletedRef.current) return;

      didHoldRef.current = true;
      setGesture('holding');
      lockPageGestures();
      onHoldStart();
    }, 560);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerIsDownRef.current || gestureCompletedRef.current) return;

    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;
    const distance = Math.hypot(deltaX, deltaY);

    if (!didHoldRef.current) {
      if (distance > 24) {
        resetPointerState();
      }
      return;
    }

    event.preventDefault();

    if (deltaX <= -58) {
      gestureCompletedRef.current = true;
      setGesture('cancel');
      onHoldCancel();
      return;
    }

    if (deltaY <= -64) {
      gestureCompletedRef.current = true;
      setGesture('lock');
      onHoldLock();
      return;
    }

    if (deltaX < -18) {
      setGesture('cancel');
      return;
    }

    if (deltaY < -20) {
      setGesture('lock');
      return;
    }

    setGesture('holding');
  };

  const handleClick = () => {
    if (isVoiceLocked) {
      onLockedDone();
      return;
    }

    void onTap;
  };

  return (
    <div className="flex flex-col items-center" data-no-swipe="true">
      {showGestureBar ? (
        <div className="mb-5 grid w-full max-w-[320px] grid-cols-2 gap-2 px-2">
          <div
            className={cn(
              'rounded-2xl border px-3 py-2 text-center transition-all duration-200',
              gesture === 'lock'
                ? 'border-emerald-200/45 bg-emerald-400/18 text-emerald-100 shadow-[0_0_28px_rgba(52,211,153,0.20)]'
                : 'border-white/10 bg-white/[0.045] text-white/50',
            )}
          >
            <div className="text-lg leading-none">🔒</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em]">замок</div>
          </div>

          <div
            className={cn(
              'rounded-2xl border px-3 py-2 text-center transition-all duration-200',
              gesture === 'cancel'
                ? 'border-rose-200/45 bg-rose-400/18 text-rose-100 shadow-[0_0_28px_rgba(251,113,133,0.18)]'
                : 'border-white/10 bg-white/[0.045] text-white/50',
            )}
          >
            <div className="text-lg leading-none">←</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.16em]">отмена</div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          'relative flex h-52 w-52 select-none items-center justify-center rounded-full border transition-all duration-300 sm:h-56 sm:w-56',
          isListening ? 'touch-none' : 'touch-pan-y',
          gesture === 'cancel' ? '-translate-x-4 border-rose-300/50 bg-rose-400/14 shadow-[0_0_80px_rgba(251,113,133,0.26)]' : null,
          gesture === 'lock' ? '-translate-y-4' : null,
          getRingClasses(state, isVoiceLocked),
        )}
        aria-label="AI Core"
      >
        <div className="absolute -inset-8 rounded-full border border-emerald-300/10" />
        <div className="absolute -inset-4 rounded-full border border-cyan-300/10" />
        <div className="absolute inset-4 rounded-full border border-white/10" />
        <div className="absolute inset-9 rounded-full border border-white/8" />

        {isListening ? (
          <div className="absolute bottom-11 flex items-end gap-1">
            <span className="h-3 w-1 rounded-full bg-cyan-200/60" />
            <span className="h-6 w-1 rounded-full bg-cyan-200/80" />
            <span className="h-4 w-1 rounded-full bg-cyan-200/65" />
            <span className="h-7 w-1 rounded-full bg-cyan-200/90" />
            <span className="h-3 w-1 rounded-full bg-cyan-200/60" />
          </div>
        ) : null}

        <div className="relative flex max-w-[165px] flex-col items-center justify-center text-center">
          <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">
            AI Core
          </div>

          <div className="mt-6 text-center text-2xl font-semibold leading-tight text-white">
            {getStateLabel(state, isVoiceLocked)}
          </div>

          <div className="mt-2 text-center text-sm leading-5 text-white/42">
            {getStateHint(state, isVoiceLocked)}
          </div>
        </div>
      </button>

      {isVoiceLocked ? (
        <button
          type="button"
          onClick={onLockedCancel}
          className="mt-5 rounded-full border border-rose-300/20 bg-rose-400/10 px-8 py-3 text-sm font-medium text-rose-100 shadow-[0_0_28px_rgba(251,113,133,0.10)]"
        >
          Отменить запись
        </button>
      ) : null}
    </div>
  );
}

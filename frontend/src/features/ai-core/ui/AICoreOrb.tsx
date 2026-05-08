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
  if (state === 'expanded') return 'Введите команду';
  return 'AI Core';
}

function getStateHint(state: AICoreState, isVoiceLocked: boolean) {
  if (isVoiceLocked) return 'говори свободно, затем нажми «Готово»';
  if (state === 'listening') return 'отпусти — отправить, влево — отменить';
  if (state === 'thinking') return 'проверяю действие';
  if (state === 'responding') return 'можно продолжать';
  if (state === 'expanded') return 'зажми сферу для голоса';
  return 'нажми или зажми';
}

function getRingClasses(state: AICoreState, isVoiceLocked: boolean) {
  if (isVoiceLocked) {
    return 'scale-[1.07] border-emerald-200/60 bg-emerald-400/18 shadow-[0_0_110px_rgba(52,211,153,0.36)]';
  }

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
    unlockPageGestures();
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
      unlockPageGestures();
      return;
    }

    if (wasHold) {
      setGesture('idle');
      unlockPageGestures();
      onHoldEnd();
      return;
    }

    setGesture('idle');
    unlockPageGestures();
    onTap();
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

    const handleGlobalPointerUp = () => finishPointerInteraction();

    const handleGlobalPointerCancel = () => {
      if (didHoldRef.current && !gestureCompletedRef.current) {
        onHoldCancel();
      }
      resetPointerState();
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
      unlockPageGestures();
    };
  }, [onHoldCancel]);

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
    }, 260);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerIsDownRef.current || !didHoldRef.current || gestureCompletedRef.current) return;

    event.preventDefault();

    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;

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

  const isListening = state === 'listening' || isVoiceLocked;

  return (
    <div className="flex flex-col items-center" data-no-swipe="true">
      <div className="relative flex w-full justify-center">
        {isListening ? (
          <>
            <div
              className={cn(
                'pointer-events-none absolute -left-1 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2 rounded-full border px-3 py-2 text-xs transition-all duration-200',
                gesture === 'cancel'
                  ? 'translate-x-1 border-rose-300/45 bg-rose-400/18 text-rose-100 opacity-100'
                  : 'border-white/10 bg-white/[0.06] text-white/45 opacity-80',
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-400/15 text-lg">
                ←
              </span>
              <span>отмена</span>
            </div>

            <div
              className={cn(
                'pointer-events-none absolute -top-14 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 transition-all duration-200',
                gesture === 'lock' || isVoiceLocked ? 'opacity-100' : 'opacity-75',
              )}
            >
              <div
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full border text-xl transition-all duration-200',
                  gesture === 'lock' || isVoiceLocked
                    ? 'border-emerald-200/50 bg-emerald-400/18 text-emerald-100 shadow-[0_0_36px_rgba(52,211,153,0.25)]'
                    : 'border-white/10 bg-white/[0.06] text-white/45',
                )}
              >
                🔒
              </div>
              <div className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/45">
                вверх — замок
              </div>
            </div>
          </>
        ) : null}

        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            'relative flex h-52 w-52 select-none items-center justify-center rounded-full border transition-all duration-300 active:scale-[0.985] sm:h-56 sm:w-56',
            isListening ? 'touch-none' : 'touch-manipulation',
            gesture === 'cancel' ? '-translate-x-4 border-rose-300/50 bg-rose-400/14 shadow-[0_0_80px_rgba(251,113,133,0.26)]' : null,
            gesture === 'lock' ? '-translate-y-5' : null,
            getRingClasses(state, isVoiceLocked),
          )}
          aria-label="AI Core"
        >
          <div className="absolute -inset-8 rounded-full border border-emerald-300/10" />
          <div className="absolute -inset-4 rounded-full border border-cyan-300/10" />
          <div className="absolute inset-4 rounded-full border border-white/10" />
          <div className="absolute inset-9 rounded-full border border-white/8" />

          {isListening ? (
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
              {getStateLabel(state, isVoiceLocked)}
            </div>

            <div className="mt-2 max-w-[150px] text-sm leading-5 text-white/42">
              {getStateHint(state, isVoiceLocked)}
            </div>
          </div>
        </button>
      </div>

      {isVoiceLocked ? (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={onLockedCancel}
            className="rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-3 text-sm font-medium text-rose-100"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onLockedDone}
            className="rounded-full border border-emerald-300/25 bg-emerald-400/15 px-5 py-3 text-sm font-medium text-emerald-100"
          >
            Готово
          </button>
        </div>
      ) : null}
    </div>
  );
}

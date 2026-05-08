import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { cn } from '@/shared/lib/cn';
import type { AICoreState } from '@/features/ai-core/model/aiCore.types';

type Props = {
  state: AICoreState;
  isVoiceLocked?: boolean;
  voiceGestureHint?: string | null;
  onTap: () => void;
  onHoldStart: () => void | Promise<void>;
  onHoldEnd: () => void;
  onVoiceCancel: () => void;
  onVoiceLock: () => void;
  onVoiceLockedFinish: () => void;
};

function getStateLabel(state: AICoreState, isVoiceLocked: boolean) {
  if (isVoiceLocked) return 'Запись';
  if (state === 'listening') return 'Слушаю';
  if (state === 'thinking') return 'Думаю';
  if (state === 'responding') return 'Готово';
  if (state === 'expanded') return 'Введите команду';
  return 'AI Core';
}

function getStateHint(state: AICoreState, isVoiceLocked: boolean) {
  if (isVoiceLocked) return 'микрофон закреплён';
  if (state === 'listening') return 'отпусти — отправить';
  if (state === 'thinking') return 'проверяю действие';
  if (state === 'responding') return 'можно продолжать';
  if (state === 'expanded') return 'зажми сферу для голоса';
  return 'нажми или зажми';
}

function getRingClasses(state: AICoreState, isVoiceLocked: boolean) {
  if (isVoiceLocked) {
    return 'scale-[1.07] border-sky-200/60 bg-sky-400/18 shadow-[0_0_108px_rgba(56,189,248,0.38)]';
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
  voiceGestureHint = null,
  onTap,
  onHoldStart,
  onHoldEnd,
  onVoiceCancel,
  onVoiceLock,
  onVoiceLockedFinish,
}: Props) {
  const holdTimerRef = useRef<number | null>(null);
  const pointerIsDownRef = useRef(false);
  const isHoldingVoiceRef = useRef(false);
  const gestureFinishedRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const [gestureState, setGestureState] = useState<'idle' | 'holding' | 'cancel' | 'lock'>('idle');

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const resetPointerState = () => {
    pointerIsDownRef.current = false;
    isHoldingVoiceRef.current = false;
    gestureFinishedRef.current = false;
    setGestureState('idle');
    clearHoldTimer();
  };

  const finishPointerInteraction = () => {
    if (!pointerIsDownRef.current) return;

    const wasHoldingVoice = isHoldingVoiceRef.current;
    const wasFinishedByGesture = gestureFinishedRef.current;

    clearHoldTimer();
    pointerIsDownRef.current = false;
    isHoldingVoiceRef.current = false;
    gestureFinishedRef.current = false;
    setGestureState('idle');

    if (wasFinishedByGesture) return;

    if (wasHoldingVoice) {
      onHoldEnd();
      return;
    }

    onTap();
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => finishPointerInteraction();

    const handleGlobalPointerCancel = () => {
      if (isHoldingVoiceRef.current && !gestureFinishedRef.current) {
        onVoiceCancel();
      }

      resetPointerState();
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerCancel);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel);
    };
  }, [onHoldEnd, onTap, onVoiceCancel]);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isVoiceLocked) return;

    pointerIsDownRef.current = true;
    isHoldingVoiceRef.current = false;
    gestureFinishedRef.current = false;
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
    setGestureState('idle');

    clearHoldTimer();

    holdTimerRef.current = window.setTimeout(() => {
      if (!pointerIsDownRef.current || gestureFinishedRef.current) return;

      isHoldingVoiceRef.current = true;
      setGestureState('holding');
      void onHoldStart();
    }, 220);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerIsDownRef.current || !isHoldingVoiceRef.current) return;

    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;

    if (deltaX < -78) {
      gestureFinishedRef.current = true;
      setGestureState('cancel');
      onVoiceCancel();
      return;
    }

    if (deltaY < -82) {
      gestureFinishedRef.current = true;
      setGestureState('lock');
      onVoiceLock();
    }
  };

  const showVoiceGesture = state === 'listening' || isVoiceLocked;

  return (
    <div className="flex flex-col items-center" data-no-swipe="true">
      {showVoiceGesture ? (
        <div className="mb-4 flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/24 px-4 py-2 text-xs text-white/72 shadow-[0_18px_55px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <span
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm',
              gestureState === 'lock' || isVoiceLocked ? 'text-sky-200' : 'text-white/60',
            )}
          >
            🔒
          </span>
          <span>{voiceGestureHint || 'Влево — отмена • вверх — замок'}</span>
        </div>
      ) : null}

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          'relative flex h-52 w-52 touch-none select-none items-center justify-center rounded-full border transition-all duration-300 active:scale-[0.985] sm:h-56 sm:w-56',
          getRingClasses(state, isVoiceLocked),
          gestureState === 'cancel' ? 'translate-x-[-14px] border-rose-300/60 bg-rose-400/15' : null,
          gestureState === 'lock' ? 'translate-y-[-12px]' : null,
        )}
        aria-label="AI Core"
      >
        <div className="absolute -inset-8 rounded-full border border-emerald-300/10" />
        <div className="absolute -inset-4 rounded-full border border-cyan-300/10" />
        <div className="absolute inset-4 rounded-full border border-white/10" />
        <div className="absolute inset-9 rounded-full border border-white/8" />

        {state === 'listening' || isVoiceLocked ? (
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

          <div className="mt-2 text-sm text-white/42">
            {getStateHint(state, isVoiceLocked)}
          </div>
        </div>
      </button>

      {isVoiceLocked ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onVoiceCancel}
            className="rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-sm text-rose-100"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onVoiceLockedFinish}
            className="rounded-full border border-emerald-300/25 bg-emerald-300/14 px-5 py-2 text-sm font-medium text-emerald-50"
          >
            Готово
          </button>
        </div>
      ) : null}
    </div>
  );
}

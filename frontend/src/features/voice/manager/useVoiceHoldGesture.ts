import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import type { VoiceInputState } from '@/features/voice/model/voice.types';
import type { GestureMode, GestureRuntime, ShowVoiceThought } from '@/features/voice/ui/companion/voiceCompanion.types';

const SWIPE_CANCEL_PX = 58;
const TAP_GUARD_MS = 260;
const DEFAULT_HOLD_TO_VOICE_MS = 80;
const STUCK_HOLD_MS = 18000;

const createIdleGesture = (): GestureRuntime => ({
  pointerId: null,
  startX: 0,
  startY: 0,
  started: false,
  releaseAfterStart: false,
  cancelled: false,
  mode: 'idle',
});

type UseVoiceHoldGestureParams = {
  voiceState: VoiceInputState;
  startHoldRecording: () => Promise<boolean>;
  stopVoice: () => void;
  openTextOverlay: () => void;
  onTap?: () => void;
  onCancelRecording: (reason: string, mode: GestureMode) => void;
  showThought: ShowVoiceThought;
  tapToTextEnabled?: boolean;
  holdToVoiceMs?: number;
  labels: {
    recognizing: string;
    pullForText?: string;
  };
};

export function useVoiceHoldGesture({
  voiceState,
  startHoldRecording,
  stopVoice,
  openTextOverlay,
  onTap,
  onCancelRecording,
  showThought,
  tapToTextEnabled = true,
  holdToVoiceMs = DEFAULT_HOLD_TO_VOICE_MS,
  labels,
}: UseVoiceHoldGestureParams) {
  const [gestureMode, setGestureMode] = useState<GestureMode>('idle');
  const gestureRef = useRef<GestureRuntime>(createIdleGesture());
  const lastPointerDownAtRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const stuckTimerRef = useRef<number | null>(null);
  const voiceStateRef = useRef(voiceState);

  voiceStateRef.current = voiceState;

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const clearStuckTimer = useCallback(() => {
    if (stuckTimerRef.current !== null) {
      window.clearTimeout(stuckTimerRef.current);
      stuckTimerRef.current = null;
    }
  }, []);

  const resetGesture = useCallback(() => {
    clearHoldTimer();
    clearStuckTimer();
    gestureRef.current = createIdleGesture();
    setGestureMode('idle');
  }, [clearHoldTimer, clearStuckTimer]);

  const cancelManualRecording = useCallback((reason: string) => {
    const gesture = gestureRef.current;
    gesture.cancelled = true;
    onCancelRecording(reason, gesture.mode);
    resetGesture();
  }, [onCancelRecording, resetGesture]);

  const stopManualRecording = useCallback((source: string) => {
    const gesture = gestureRef.current;
    clearHoldTimer();

    if (gesture.pointerId === null && voiceStateRef.current !== 'recording') return;

    if (gesture.cancelled) {
      resetGesture();
      return;
    }

    if (!gesture.started) {
      gesture.releaseAfterStart = true;
      if (tapToTextEnabled) {
        resetGesture();
        openTextOverlay();
        logVoiceDebugEvent('manual_voice_tap_text_overlay_opened', { source });
      } else if (holdToVoiceMs > 0) {
        // A fast tap on the floating companion is only a hint. It must not leave
        // the voice button visually pressed.
        resetGesture();
        if (onTap) onTap();
        else if (labels.pullForText) showThought(labels.pullForText, 'neutral', 1800);
      }
      return;
    }

    if (voiceStateRef.current === 'recording') {
      showThought(labels.recognizing, 'neutral', 1800);
      stopVoice();
      resetGesture();
      logVoiceDebugEvent('manual_voice_released_recording_stopped', { source, voiceState: voiceStateRef.current });
      return;
    }

    gesture.releaseAfterStart = true;
    logVoiceDebugEvent('manual_voice_release_waiting_recorder_start', { source, voiceState: voiceStateRef.current });
  }, [clearHoldTimer, holdToVoiceMs, labels.pullForText, labels.recognizing, onTap, openTextOverlay, resetGesture, showThought, stopVoice, tapToTextEnabled]);

  const scheduleStuckGuard = useCallback(() => {
    clearStuckTimer();
    stuckTimerRef.current = window.setTimeout(() => {
      const gesture = gestureRef.current;
      if (gesture.pointerId === null && voiceStateRef.current !== 'recording') return;
      logVoiceDebugEvent('manual_voice_stuck_guard_reset', { voiceState: voiceStateRef.current, mode: gesture.mode });
      cancelManualRecording('stuck_guard');
    }, STUCK_HOLD_MS);
  }, [cancelManualRecording, clearStuckTimer]);

  const beginRecording = useCallback((pointerId: number | null, source: string) => {
    const gesture = gestureRef.current;
    if (gesture.cancelled || gesture.started) return;

    gesture.started = true;
    void startHoldRecording().then((started) => {
      const currentGesture = gestureRef.current;
      if (!started) {
        logVoiceDebugEvent('manual_voice_recording_not_started', { pointerId, source });
        resetGesture();
        return;
      }

      if (currentGesture.releaseAfterStart) {
        showThought(labels.recognizing, 'neutral', 1800);
        stopVoice();
        resetGesture();
      }

      logVoiceDebugEvent('manual_voice_recording_started', {
        pointerId,
        source,
        releaseAfterStart: currentGesture.releaseAfterStart,
      });
    }).catch(() => {
      resetGesture();
    });
  }, [labels.recognizing, resetGesture, showThought, startHoldRecording, stopVoice]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const now = Date.now();
    if (now - lastPointerDownAtRef.current < TAP_GUARD_MS) {
      logVoiceDebugEvent('manual_voice_pointer_down_ignored_guard');
      return;
    }
    lastPointerDownAtRef.current = now;

    event.preventDefault();
    event.stopPropagation();

    clearHoldTimer();
    resetGesture();
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      releaseAfterStart: false,
      cancelled: false,
      mode: 'holding',
    };
    setGestureMode('holding');
    scheduleStuckGuard();

    if (holdToVoiceMs <= 0) {
      beginRecording(event.pointerId, 'pointer_down');
      return;
    }

    holdTimerRef.current = window.setTimeout(() => beginRecording(event.pointerId, 'hold_timer'), holdToVoiceMs);
  }, [beginRecording, clearHoldTimer, holdToVoiceMs, resetGesture, scheduleStuckGuard]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId || gesture.mode !== 'holding' || gesture.cancelled) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (dx <= -SWIPE_CANCEL_PX && Math.abs(dx) > Math.abs(dy)) {
      event.preventDefault();
      clearHoldTimer();
      cancelManualRecording('swipe_left');
    }
  }, [cancelManualRecording, clearHoldTimer]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    stopManualRecording('pointer_up');
  }, [stopManualRecording]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    cancelManualRecording('pointer_cancel');
  }, [cancelManualRecording]);

  useEffect(() => {
    const finishFromWindow = () => stopManualRecording('window_release');
    const cancelFromWindow = () => cancelManualRecording('window_cancel');
    const cancelOnHidden = () => {
      if (document.visibilityState === 'hidden') cancelFromWindow();
    };

    window.addEventListener('pointerup', finishFromWindow, true);
    window.addEventListener('mouseup', finishFromWindow, true);
    window.addEventListener('touchend', finishFromWindow, true);
    window.addEventListener('pointercancel', cancelFromWindow, true);
    window.addEventListener('touchcancel', cancelFromWindow, true);
    window.addEventListener('blur', cancelFromWindow);
    window.addEventListener('pagehide', cancelFromWindow);
    document.addEventListener('visibilitychange', cancelOnHidden);

    return () => {
      window.removeEventListener('pointerup', finishFromWindow, true);
      window.removeEventListener('mouseup', finishFromWindow, true);
      window.removeEventListener('touchend', finishFromWindow, true);
      window.removeEventListener('pointercancel', cancelFromWindow, true);
      window.removeEventListener('touchcancel', cancelFromWindow, true);
      window.removeEventListener('blur', cancelFromWindow);
      window.removeEventListener('pagehide', cancelFromWindow);
      document.removeEventListener('visibilitychange', cancelOnHidden);
    };
  }, [cancelManualRecording, stopManualRecording]);

  useEffect(() => () => {
    clearHoldTimer();
    clearStuckTimer();
  }, [clearHoldTimer, clearStuckTimer]);

  return {
    gestureMode,
    isPressed: gestureMode === 'holding' || voiceState === 'recording',
    isCancelledBySwipe: gestureRef.current.cancelled,
    resetGesture,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}

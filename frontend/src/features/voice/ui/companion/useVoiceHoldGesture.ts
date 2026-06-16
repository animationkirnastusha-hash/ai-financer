import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import type { VoiceInputState } from '@/features/voice/model/voice.types';
import type { GestureMode, GestureRuntime, ShowVoiceThought } from '@/features/voice/ui/companion/voiceCompanion.types';

const SWIPE_CANCEL_PX = 58;
const TAP_GUARD_MS = 320;
const HOLD_TO_VOICE_MS = 210;

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
  onCancelRecording: (reason: string, mode: GestureMode) => void;
  showThought: ShowVoiceThought;
  tapToTextEnabled?: boolean;
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
  onCancelRecording,
  showThought,
  tapToTextEnabled = true,
  labels,
}: UseVoiceHoldGestureParams) {
  const [gestureMode, setGestureMode] = useState<GestureMode>('idle');
  const gestureRef = useRef<GestureRuntime>(createIdleGesture());
  const lastPointerDownAtRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const resetGesture = useCallback(() => {
    gestureRef.current = createIdleGesture();
    setGestureMode('idle');
  }, []);

  const cancelManualRecording = useCallback((reason: string) => {
    const gesture = gestureRef.current;
    gesture.cancelled = true;
    onCancelRecording(reason, gesture.mode);
    resetGesture();
  }, [onCancelRecording, resetGesture]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastPointerDownAtRef.current < TAP_GUARD_MS) {
      logVoiceDebugEvent('manual_voice_pointer_down_ignored_guard');
      return;
    }
    lastPointerDownAtRef.current = now;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

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

    holdTimerRef.current = window.setTimeout(() => {
      const gesture = gestureRef.current;
      if (gesture.pointerId !== event.pointerId || gesture.cancelled || gesture.started) return;
      gesture.started = true;
      void startHoldRecording().then((started) => {
        const currentGesture = gestureRef.current;
        if (!started) {
          resetGesture();
          logVoiceDebugEvent('manual_voice_hold_recording_started', { pointerId: event.pointerId, started });
          return;
        }

        if (currentGesture.releaseAfterStart) {
          showThought(labels.recognizing, 'neutral', 1800);
          stopVoice();
          resetGesture();
        }

        logVoiceDebugEvent('manual_voice_hold_recording_started', {
          pointerId: event.pointerId,
          started,
          releaseAfterStart: currentGesture.releaseAfterStart,
        });
      });
    }, HOLD_TO_VOICE_MS);
  }, [clearHoldTimer, labels.recognizing, resetGesture, showThought, startHoldRecording, stopVoice]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
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

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    clearHoldTimer();

    if (gesture.cancelled) {
      resetGesture();
      return;
    }

    if (!gesture.started) {
      resetGesture();
      if (tapToTextEnabled) {
        openTextOverlay();
        logVoiceDebugEvent('manual_voice_tap_text_overlay_opened', { pointerId: event.pointerId });
      } else {
        if (labels.pullForText) showThought(labels.pullForText, 'neutral', 1800);
        logVoiceDebugEvent('manual_voice_tap_text_overlay_disabled', { pointerId: event.pointerId });
      }
      return;
    }

    if (voiceState === 'recording') {
      showThought(labels.recognizing, 'neutral', 1800);
      stopVoice();
      resetGesture();
      logVoiceDebugEvent('manual_voice_hold_released_recording_stopped', { pointerId: event.pointerId, voiceState });
      return;
    }

    gesture.releaseAfterStart = true;
    logVoiceDebugEvent('manual_voice_hold_release_waiting_recorder_start', { pointerId: event.pointerId, voiceState });
  }, [clearHoldTimer, labels.pullForText, labels.recognizing, openTextOverlay, resetGesture, showThought, stopVoice, tapToTextEnabled, voiceState]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    clearHoldTimer();
    cancelManualRecording('pointer_cancel');
  }, [cancelManualRecording, clearHoldTimer]);

  useEffect(() => () => {
    clearHoldTimer();
  }, [clearHoldTimer]);

  return {
    gestureMode,
    resetGesture,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  };
}

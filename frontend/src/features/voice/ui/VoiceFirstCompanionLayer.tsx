import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import { useVoiceCommandDispatcher } from '@/features/voice/model/useVoiceCommandDispatcher';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { useVoiceSessionMachine } from '@/features/voice/model/useVoiceSessionMachine';
import { VOICE_BUBBLE_TIMEOUT_MS } from '@/features/voice/model/voiceConstants';
import type { VoiceCompanionMood, VoiceThought, VoiceBubbleTone } from '@/features/voice/model/voiceSession.types';
import { compactVoiceBubble } from '@/features/voice/model/voiceText';
import { VoicePendingConfirmModal } from '@/features/voice/ui/VoicePendingConfirmModal';
import { VoicePermissionIntro } from '@/features/voice/ui/VoicePermissionIntro';
import { VoiceStatusPill } from '@/features/voice/ui/VoiceStatusPill';
import { VoiceThoughtBubble } from '@/features/voice/ui/VoiceThoughtBubble';
import { CompanionButton } from '@/shared/ui/CompanionButton';

type GestureMode = 'idle' | 'holding' | 'locked';

type GestureRuntime = {
  pointerId: number | null;
  startX: number;
  startY: number;
  started: boolean;
  releaseAfterStart: boolean;
  cancelled: boolean;
  mode: GestureMode;
};

const SWIPE_LOCK_PX = 48;
const SWIPE_CANCEL_PX = 58;
const TAP_GUARD_MS = 320;

function CancelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.3 5.9 12 10.6l4.7-4.7 1.4 1.4-4.7 4.7 4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.7 1.4-1.4Z" />
    </svg>
  );
}

export function VoiceFirstCompanionLayer() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);

  const chat = useChatController();

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const companionName = useSettingsStore((state) => state.companionName || 'Фина');
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

  const [thought, setThought] = useState<VoiceThought | null>(null);
  const [isPriming, setIsPriming] = useState(false);
  const [permissionIntroOpen, setPermissionIntroOpen] = useState(false);
  const [permissionIntroDismissed, setPermissionIntroDismissed] = useState(false);
  const [gestureMode, setGestureMode] = useState<GestureMode>('idle');

  const bubbleTimerRef = useRef<number | null>(null);
  const lastThoughtRef = useRef<{ text: string; tone: VoiceBubbleTone; at: number }>({ text: '', tone: 'neutral', at: 0 });
  const lastAssistantMessageKeyRef = useRef('');
  const lastPointerDownAtRef = useRef(0);
  const handleTextRef = useRef<(text: string) => Promise<void> | void>(() => undefined);
  const voiceCancelRef = useRef<() => void>(() => undefined);
  const resetVoiceMachineRef = useRef<() => void>(() => undefined);
  const gestureRef = useRef<GestureRuntime>({
    pointerId: null,
    startX: 0,
    startY: 0,
    started: false,
    releaseAfterStart: false,
    cancelled: false,
    mode: 'idle',
  });

  const wakeName = companionName || 'Фина';

  const showThought = useCallback((text: string, tone: VoiceBubbleTone = 'neutral', timeoutMs = VOICE_BUBBLE_TIMEOUT_MS) => {
    const cleanText = compactVoiceBubble(text);
    if (!cleanText) return;

    const now = Date.now();
    const lastThought = lastThoughtRef.current;
    if (lastThought.text === cleanText && lastThought.tone === tone && now - lastThought.at < 1400) return;
    lastThoughtRef.current = { text: cleanText, tone, at: now };

    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    setThought({ id: `${tone}-${now}`, text: cleanText, tone });

    bubbleTimerRef.current = window.setTimeout(() => {
      setThought(null);
      bubbleTimerRef.current = null;
    }, timeoutMs);
  }, []);

  const dispatchCommand = useVoiceCommandDispatcher({ chat, navigateTo, goBack, showThought });

  const machine = useVoiceSessionMachine({
    companionName: wakeName,
    showThought,
    dispatchCommand,
  });

  const {
    captureMode,
    phase,
    isDispatching,
    cooldownUntil,
    recordSessionMs,
    handleTranscript,
    reset: resetVoiceMachine,
    markHolding,
    markLocked,
    markUploading,
  } = machine;

  const voice = useVoiceInput({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    sessionMs: recordSessionMs,
    permissionWasPrompted: voicePermissionPrompted,
    onText: (text) => handleTextRef.current(text),
  });

  const canUseVoice = voiceEnabled && voiceBetaEnabled && voice.isSupported;
  const hasPending = chat.pendingActions.length > 0;
  const isBusy = chat.isSending || isDispatching || voice.state === 'uploading';
  const microphoneNeedsAction = canUseVoice && (!voicePermissionPrompted || voice.permissionState === 'prompt' || voice.permissionState === 'denied' || voice.permissionState === 'unsupported');
  const voicePermissionReady = canUseVoice && voicePermissionPrompted && voice.permissionState !== 'prompt' && voice.permissionState !== 'denied' && voice.permissionState !== 'unsupported';
  const canStartManualRecording = voicePermissionReady && !hasPending && !chat.isSending && !isDispatching && voice.state === 'idle';

  useEffect(() => {
    void voice.refreshPermissionState?.();
  }, [voice.refreshPermissionState]);

  useEffect(() => {
    if (!canUseVoice) return;

    if (voice.permissionState === 'granted' && !voicePermissionPrompted) {
      setVoicePermissionPrompted(true);
      setPermissionIntroOpen(false);
      setPermissionIntroDismissed(false);
      return;
    }

    if (voice.permissionState === 'prompt' || voice.permissionState === 'denied') {
      if (voicePermissionPrompted) setVoicePermissionPrompted(false);
    }
  }, [canUseVoice, setVoicePermissionPrompted, voice.permissionState, voicePermissionPrompted]);

  useEffect(() => {
    handleTextRef.current = async (text: string) => {
      markUploading();
      await handleTranscript(text);
    };
  }, [handleTranscript, markUploading]);

  useEffect(() => {
    resetVoiceMachineRef.current = resetVoiceMachine;
  }, [resetVoiceMachine]);

  useEffect(() => {
    voiceCancelRef.current = voice.cancel;
  }, [voice.cancel]);

  const resetGesture = useCallback(() => {
    gestureRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      started: false,
      releaseAfterStart: false,
      cancelled: false,
      mode: 'idle',
    };
    setGestureMode('idle');
  }, []);

  const cancelManualRecording = useCallback((reason: string) => {
    const gesture = gestureRef.current;
    gesture.cancelled = true;
    logVoiceDebugEvent('manual_voice_cancelled', { reason, mode: gesture.mode, voiceState: voice.state });
    voice.cancel();
    resetVoiceMachine();
    resetGesture();
    showThought('Отменено.', 'neutral', 1600);
  }, [resetGesture, resetVoiceMachine, showThought, voice]);

  const sendManualRecording = useCallback((reason: string) => {
    const gesture = gestureRef.current;
    logVoiceDebugEvent('manual_voice_send_requested', { reason, mode: gesture.mode, voiceState: voice.state });
    if (voice.state === 'recording') {
      voice.stop();
      showThought('Распознаю...', 'thinking', 2200);
    }
    resetGesture();
  }, [resetGesture, showThought, voice]);

  const primeVoicePermission = useCallback(async () => {
    setIsPriming(true);
    try {
      const ready = await voice.primePermission();
      if (ready) {
        setVoicePermissionPrompted(true);
        setPermissionIntroOpen(false);
        setPermissionIntroDismissed(false);
        showThought('Готово. Зажми Фину и говори.', 'success', 3200);
      } else {
        setVoicePermissionPrompted(false);
        setPermissionIntroOpen(true);
        showThought('Микрофон будет доступен после разрешения.', 'neutral', 3200);
      }
    } catch {
      setVoicePermissionPrompted(false);
      setPermissionIntroOpen(true);
      setPermissionIntroDismissed(false);
      showThought('Нужен доступ к микрофону.', 'warning', 3600);
    } finally {
      setIsPriming(false);
    }
  }, [setVoicePermissionPrompted, showThought, voice.primePermission]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const lockedGesture = gestureRef.current;
    if (lockedGesture.mode === 'locked') {
      event.preventDefault();
      event.stopPropagation();
      sendManualRecording('locked_companion_press');
      return;
    }

    if (!canStartManualRecording) {
      if (!canUseVoice) {
        showThought('Голос недоступен.', 'warning', 2400);
      } else if (!voicePermissionReady) {
        setPermissionIntroOpen(true);
        setPermissionIntroDismissed(false);
        showThought('Сначала разреши микрофон.', 'warning', 2400);
      } else if (hasPending) {
        showThought('Сначала закрой действие.', 'warning', 2400);
      }
      return;
    }

    const now = Date.now();
    if (now - lastPointerDownAtRef.current < TAP_GUARD_MS) {
      logVoiceDebugEvent('manual_voice_pointer_down_ignored_guard');
      return;
    }
    lastPointerDownAtRef.current = now;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

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
    markHolding();
    showThought('Слушаю. Вверх — закрепить, влево — отменить.', 'listening', 4200);
    logVoiceDebugEvent('manual_voice_pointer_down', { pointerId: event.pointerId });

    void voice.start().then((result) => {
      const gesture = gestureRef.current;
      if (gesture.pointerId !== event.pointerId || gesture.cancelled) return;

      if (result !== 'started') {
        logVoiceDebugEvent('manual_voice_start_failed', { result });
        resetGesture();
        resetVoiceMachine();
        if (result === 'permission-ready') showThought('Разреши микрофон и попробуй ещё раз.', 'warning', 2600);
        else showThought('Не удалось начать запись.', 'warning', 2600);
        return;
      }

      gesture.started = true;
      logVoiceDebugEvent('manual_voice_recording_started', { pointerId: event.pointerId, mode: gesture.mode });

      if (gesture.releaseAfterStart && gesture.mode === 'holding') {
        sendManualRecording('release_after_async_start');
      }
    });
  }, [canStartManualRecording, canUseVoice, hasPending, markHolding, resetGesture, resetVoiceMachine, sendManualRecording, showThought, voice.start, voicePermissionReady]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId || gesture.mode !== 'holding' || gesture.cancelled) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (dx <= -SWIPE_CANCEL_PX && Math.abs(dx) > Math.abs(dy)) {
      event.preventDefault();
      cancelManualRecording('swipe_left');
      return;
    }

    if (dy <= -SWIPE_LOCK_PX && Math.abs(dy) > Math.abs(dx) * 0.8) {
      event.preventDefault();
      gesture.mode = 'locked';
      setGestureMode('locked');
      markLocked();
      showThought('Запись закреплена. Нажми Фину, когда закончишь.', 'listening', 3600);
      logVoiceDebugEvent('manual_voice_locked', { pointerId: event.pointerId, dy: Math.round(dy) });
    }
  }, [cancelManualRecording, markLocked, showThought]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (gesture.cancelled) {
      resetGesture();
      return;
    }

    if (gesture.mode === 'locked') {
      gesture.pointerId = null;
      logVoiceDebugEvent('manual_voice_pointer_up_locked', { pointerId: event.pointerId });
      return;
    }

    if (!gesture.started) {
      gesture.releaseAfterStart = true;
      logVoiceDebugEvent('manual_voice_release_before_start', { pointerId: event.pointerId });
      return;
    }

    sendManualRecording('pointer_up');
  }, [resetGesture, sendManualRecording]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;

    if (gesture.mode === 'locked') {
      gesture.pointerId = null;
      logVoiceDebugEvent('manual_voice_pointer_cancel_locked', { pointerId: event.pointerId });
      return;
    }

    cancelManualRecording('pointer_cancel');
  }, [cancelManualRecording]);

  useEffect(() => {
    if (!voice.error) return;

    if (voice.error === 'transcription-not-configured') {
      showThought('Распознавание ещё не настроено.', 'warning', 4200);
      resetGesture();
      resetVoiceMachine();
      return;
    }

    if (voice.error === 'microphone-denied' || voice.error === 'not-allowed' || voice.error === 'service-not-allowed') {
      setVoicePermissionPrompted(false);
      setPermissionIntroOpen(true);
      setPermissionIntroDismissed(false);
      showThought('Нужен доступ к микрофону.', 'warning', 3600);
      resetGesture();
      resetVoiceMachine();
      return;
    }

    if (voice.error === 'no-speech' || voice.error === 'transcription-timeout' || voice.error === 'transcription-error' || voice.error === 'rate-limited') {
      showThought(voice.error === 'rate-limited' ? 'Слишком много запросов. Попробуй позже.' : 'Не расслышала команду.', 'warning', 2600);
      resetGesture();
      resetVoiceMachine();
    }
  }, [resetGesture, resetVoiceMachine, showThought, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    voice.stopSpeaking();

    if (lastMessage.kind === 'preview') {
      showThought('Проверь действие.', 'warning', 3600);
      return;
    }

    if (lastMessage.kind === 'error') {
      showThought(lastMessage.text || 'Нужно уточнение.', 'warning', 5000);
      return;
    }

    showThought(lastMessage.text || 'Готово.', 'success', 2600);
  }, [chat.messages, showThought, voice]);

  useEffect(() => {
    if (chat.pendingActions.length <= 0) return;
    if (voice.state === 'recording' || voice.state === 'uploading') {
      logVoiceDebugEvent('voice_cancelled_pending_action_opened', { pendingActions: chat.pendingActions.length, voiceState: voice.state });
      voice.cancel();
    }
    resetGesture();
    resetVoiceMachine();
  }, [chat.pendingActions.length, resetGesture, resetVoiceMachine, voice]);

  useEffect(() => () => {
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    resetVoiceMachineRef.current();
    voiceCancelRef.current();
  }, []);

  const mood = useMemo<VoiceCompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (voice.state === 'recording' || gestureMode === 'holding' || gestureMode === 'locked') return 'listening';
    if (voice.state === 'uploading' || chat.isSending || isDispatching) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [chat.isSending, chat.pendingActions.length, gestureMode, isDispatching, thought?.tone, voice.state]);

  const needsIntro = microphoneNeedsAction && (!permissionIntroDismissed || permissionIntroOpen);
  const showFloatingCompanion = currentScreen !== 'ai-core';
  const isLocked = gestureMode === 'locked';

  if (!showFloatingCompanion && !needsIntro && chat.pendingActions.length === 0) return null;

  return (
    <>
      {needsIntro ? (
        <VoicePermissionIntro
          wakeName={wakeName}
          isPriming={isPriming}
          permissionState={voice.permissionState}
          onPrime={primeVoicePermission}
          onSkip={() => {
            setPermissionIntroOpen(false);
            setPermissionIntroDismissed(true);
          }}
        />
      ) : null}

      <VoicePendingConfirmModal
        pendingActions={chat.pendingActions}
        onConfirm={chat.confirmAction}
        onCancel={chat.cancelAction}
        onUpdate={chat.updatePendingAction}
      />

      {showFloatingCompanion ? (
        <div className={isLocked ? 'voice-first-companion voice-first-companion--locked' : 'voice-first-companion'} data-no-swipe="true">
          <VoiceThoughtBubble thought={thought} />

          <div className="voice-first-companion__controls">
            <div className="voice-first-companion__voice-panel">
              <VoiceStatusPill
                canUseVoice={canUseVoice}
                isBusy={isBusy}
                voiceState={voice.state}
                captureMode={captureMode}
                phase={phase}
                cooldownUntil={cooldownUntil}
                isLocked={isLocked}
              />
            </div>

            <div
              className="voice-first-companion__press-target"
              role="button"
              aria-label={isLocked ? 'Нажми, чтобы отправить запись' : 'Зажми для голосовой команды'}
              tabIndex={0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onContextMenu={(event) => event.preventDefault()}
            >
              <CompanionButton
                mood={mood}
                size="md"
                label={isLocked ? 'Нажми, чтобы отправить' : 'Зажми для голосовой команды'}
                className="pointer-events-none select-none"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>

        </div>
      ) : null}

      {showFloatingCompanion && isLocked ? (
        <div className="voice-first-lock-actions voice-first-lock-actions--cancel-only voice-first-lock-actions--detached" aria-label="Управление записью" data-no-swipe="true">
          <button type="button" className="voice-first-lock-action voice-first-lock-action--cancel" onClick={() => cancelManualRecording('locked_cancel_button')} aria-label="Отменить запись">
            <CancelIcon />
          </button>
        </div>
      ) : null}
    </>
  );
}

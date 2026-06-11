import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import { useVoiceCommandDispatcher } from '@/features/voice/model/useVoiceCommandDispatcher';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { useVoiceSessionMachine } from '@/features/voice/model/useVoiceSessionMachine';
import { VOICE_BUBBLE_TIMEOUT_MS } from '@/features/voice/model/voiceConstants';
import type { VoiceCompanionMood, VoiceThought, VoiceBubbleTone } from '@/features/voice/model/voiceSession.types';
import { compactVoiceBubble } from '@/features/voice/model/voiceText';
import { VoicePermissionIntro } from '@/features/voice/ui/VoicePermissionIntro';
import { VoiceStatusPill } from '@/features/voice/ui/VoiceStatusPill';
import { VoiceThoughtBubble } from '@/features/voice/ui/VoiceThoughtBubble';
import { useI18n } from '@/shared/lib/i18n';
import { CompanionButton } from '@/shared/ui/CompanionButton';

type GestureMode = 'idle' | 'holding';

type GestureRuntime = {
  pointerId: number | null;
  startX: number;
  startY: number;
  started: boolean;
  releaseAfterStart: boolean;
  cancelled: boolean;
  mode: GestureMode;
};

const SWIPE_CANCEL_PX = 58;
const TAP_GUARD_MS = 320;
const HOLD_TO_VOICE_MS = 210;

export function VoiceFirstCompanionLayer() {
  const { t } = useI18n();
  const modalStack = useAppModalStore((state) => state.stack);
  const openModal = useAppModalStore((state) => state.openModal);
  const hasOpenModal = modalStack.length > 0;
  const hasTextChatOverlay = modalStack.some((modal) => modal.type === 'ai-text-overlay');
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

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
  const holdTimerRef = useRef<number | null>(null);
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

  const dispatchCommand = useVoiceCommandDispatcher({ chat, navigateTo, goBack, openTextChat: () => openAIWithCommand(), showThought });

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
    reset: resetVoiceMachine,
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
      const command = text.trim();
      if (!command) {
        showThought(t('voice.thought.notHeard'), 'warning', 2200);
        resetVoiceMachine();
        return;
      }

      const sessionId = crypto.randomUUID();
      resetVoiceMachine();
      showThought(t('voice.thought.thinking'), 'neutral', 1400);
      await dispatchCommand({
        sessionId,
        finalText: command,
        segments: [{ text: command, role: 'initial', at: Date.now() }],
      });
    };
  }, [dispatchCommand, resetVoiceMachine, showThought, t]);

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
    showThought(t('voice.thought.cancelled'), 'neutral', 1600);
  }, [resetGesture, resetVoiceMachine, showThought, t, voice]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const openTextOverlay = useCallback(() => {
    openModal({ type: 'ai-text-overlay', mode: 'text', autoStartVoice: false, autoCloseOnVoiceResult: false });
  }, [openModal]);

  const explainVoiceUnavailable = useCallback(() => {
    if (!canUseVoice) showThought(t('voice.thought.unavailable'), 'warning', 2400);
    else if (!voicePermissionReady) {
      setPermissionIntroOpen(true);
      setPermissionIntroDismissed(false);
      showThought(t('voice.thought.allowMicFirst'), 'warning', 2400);
    } else if (hasPending) showThought(t('voice.thought.closeActionFirst'), 'warning', 2400);
  }, [canUseVoice, hasPending, showThought, t, voicePermissionReady]);

  const startHoldRecording = useCallback(async () => {
    if (!canStartManualRecording) {
      explainVoiceUnavailable();
      return false;
    }

    resetVoiceMachine();
    showThought(t('voice.thought.listening'), 'listening', 1600);
    const result = await voice.start();

    if (result === 'started') return true;

    if (result === 'permission-ready') {
      try {
        const ready = await voice.primePermission();
        if (ready) {
          setVoicePermissionPrompted(true);
          const secondTry = await voice.start();
          if (secondTry === 'started') return true;
        }
      } catch {
        // Permission errors are handled below.
      }
    }

    explainVoiceUnavailable();
    return false;
  }, [canStartManualRecording, explainVoiceUnavailable, resetVoiceMachine, setVoicePermissionPrompted, showThought, t, voice]);

  const primeVoicePermission = useCallback(async () => {
    setIsPriming(true);
    try {
      const ready = await voice.primePermission();
      if (ready) {
        setVoicePermissionPrompted(true);
        setPermissionIntroOpen(false);
        setPermissionIntroDismissed(false);
        showThought(t('voice.thought.micReady'), 'success', 3200);
      } else {
        setVoicePermissionPrompted(false);
        setPermissionIntroOpen(true);
        showThought(t('voice.thought.micAfterPermission'), 'neutral', 3200);
      }
    } catch {
      setVoicePermissionPrompted(false);
      setPermissionIntroOpen(true);
      setPermissionIntroDismissed(false);
      showThought(t('voice.thought.micNeeded'), 'warning', 3600);
    } finally {
      setIsPriming(false);
    }
  }, [setVoicePermissionPrompted, showThought, t, voice.primePermission]);

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
          showThought(t('voice.thought.recognizing'), 'neutral', 1800);
          voice.stop();
          resetGesture();
        }

        logVoiceDebugEvent('manual_voice_hold_recording_started', { pointerId: event.pointerId, started, releaseAfterStart: currentGesture.releaseAfterStart });
      });
    }, HOLD_TO_VOICE_MS);
  }, [clearHoldTimer, resetGesture, showThought, startHoldRecording, t, voice]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId || gesture.mode !== 'holding' || gesture.cancelled) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (dx <= -SWIPE_CANCEL_PX && Math.abs(dx) > Math.abs(dy)) {
      event.preventDefault();
      clearHoldTimer();
      cancelManualRecording('swipe_left');
      return;
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
      openTextOverlay();
      logVoiceDebugEvent('manual_voice_tap_text_overlay_opened', { pointerId: event.pointerId });
      return;
    }

    if (voice.state === 'recording') {
      showThought(t('voice.thought.recognizing'), 'neutral', 1800);
      voice.stop();
      resetGesture();
      logVoiceDebugEvent('manual_voice_hold_released_recording_stopped', { pointerId: event.pointerId, voiceState: voice.state });
      return;
    }

    gesture.releaseAfterStart = true;
    logVoiceDebugEvent('manual_voice_hold_release_waiting_recorder_start', { pointerId: event.pointerId, voiceState: voice.state });
  }, [clearHoldTimer, openTextOverlay, resetGesture, showThought, t, voice]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    clearHoldTimer();
    cancelManualRecording('pointer_cancel');
  }, [cancelManualRecording, clearHoldTimer]);

  useEffect(() => {
    if (!voice.error) return;

    if (voice.error === 'transcription-not-configured') {
      showThought(t('voice.thought.recognitionUnavailable'), 'warning', 4200);
      resetGesture();
      resetVoiceMachine();
      return;
    }

    if (voice.error === 'microphone-denied' || voice.error === 'not-allowed' || voice.error === 'service-not-allowed') {
      setVoicePermissionPrompted(false);
      setPermissionIntroOpen(true);
      setPermissionIntroDismissed(false);
      showThought(t('voice.thought.micNeeded'), 'warning', 3600);
      resetGesture();
      resetVoiceMachine();
      return;
    }

    if (voice.error === 'no-speech' || voice.error === 'transcription-timeout' || voice.error === 'transcription-error' || voice.error === 'rate-limited') {
      showThought(voice.error === 'rate-limited' ? t('voice.thought.tooManyRequests') : t('voice.thought.notHeard'), 'warning', 2600);
      resetGesture();
      resetVoiceMachine();
    }
  }, [resetGesture, resetVoiceMachine, showThought, t, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    voice.stopSpeaking();

    if (lastMessage.kind === 'preview') {
      showThought(t('voice.thought.reviewAction'), 'warning', 3600);
      return;
    }

    if (lastMessage.kind === 'error') {
      showThought(lastMessage.text || t('voice.thought.needDetails'), 'warning', 5000);
      return;
    }

    showThought(lastMessage.text || t('voice.thought.done'), 'success', 2600);
  }, [chat.messages, showThought, t, voice]);

  useEffect(() => {
    if (chat.pendingActions.length <= 0) return;
    if (voice.state === 'recording' || voice.state === 'uploading') {
      logVoiceDebugEvent('voice_cancelled_pending_action_opened', { pendingActions: chat.pendingActions.length, voiceState: voice.state });
      voice.cancel();
    }
    resetGesture();
    resetVoiceMachine();
  }, [chat.pendingActions.length, resetGesture, resetVoiceMachine, voice]);

  useEffect(() => {
    if (chat.pendingActions.length <= 0 || hasTextChatOverlay) return;
    openModal({ type: 'ai-text-overlay', mode: 'text', autoStartVoice: false, autoCloseOnVoiceResult: false });
  }, [chat.pendingActions.length, hasTextChatOverlay, openModal]);

  useEffect(() => () => {
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    resetVoiceMachineRef.current();
    voiceCancelRef.current();
  }, []);

  const mood = useMemo<VoiceCompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (voice.state === 'recording' || gestureMode === 'holding' || false) return 'listening';
    if (voice.state === 'uploading' || chat.isSending || isDispatching) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [chat.isSending, chat.pendingActions.length, gestureMode, isDispatching, thought?.tone, voice.state]);

  const needsIntro = microphoneNeedsAction && (!permissionIntroDismissed || permissionIntroOpen);
  const showFloatingCompanion = !hasOpenModal;

  if (!showFloatingCompanion && !needsIntro) return null;

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

      {showFloatingCompanion ? (
        <div className="voice-first-companion" data-no-swipe="true">
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
              />
            </div>

            <div
              className="voice-first-companion__press-target"
              role="button"
              aria-label={t('voice.fina.tapTextHoldVoice')}
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
                label={t('voice.fina.tapTextHoldVoice')}
                className="pointer-events-none select-none"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </div>

        </div>
      ) : null}

    </>
  );
}

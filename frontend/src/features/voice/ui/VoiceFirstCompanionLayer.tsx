import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import { useVoiceCommandDispatcher } from '@/features/voice/model/useVoiceCommandDispatcher';
import { useUnifiedVoiceCapture } from '@/features/voice/manager/useUnifiedVoiceCapture';
import { useVoiceSessionMachine } from '@/features/voice/model/useVoiceSessionMachine';
import type { VoiceCompanionMood } from '@/features/voice/model/voiceSession.types';
import { VoiceCompanionSurface } from '@/features/voice/ui/companion/VoiceCompanionSurface';
import { VoicePermissionMiniPrompt } from '@/features/voice/ui/VoicePermissionMiniPrompt';
import { useVoiceCompanionThought } from '@/features/voice/ui/companion/useVoiceCompanionThought';
import { useVoiceHoldGesture } from '@/features/voice/manager/useVoiceHoldGesture';
import { useI18n } from '@/shared/lib/i18n';

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

  const [isPriming, setIsPriming] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  const lastAssistantMessageKeyRef = useRef('');
  const previousHasTextChatOverlayRef = useRef(false);
  const previousPendingActionsCountRef = useRef(0);
  const pendingAutoOpenHydratedRef = useRef(false);
  const suppressPendingOverlayAutoOpenRef = useRef(false);
  const handleTextRef = useRef<(text: string) => Promise<void> | void>(() => undefined);
  const voiceCancelRef = useRef<() => void>(() => undefined);
  const resetVoiceMachineRef = useRef<() => void>(() => undefined);
  const { thought, showThought } = useVoiceCompanionThought();

  const wakeName = companionName || 'Фина';
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

  const voice = useUnifiedVoiceCapture({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    sessionMs: recordSessionMs,
    permissionWasPrompted: voicePermissionPrompted,
    onText: (text) => handleTextRef.current(text),
  });

  const canUseVoice = voiceEnabled && voiceBetaEnabled && voice.isSupported;
  const hasPending = chat.pendingActions.length > 0;
  const isBusy = chat.isSending || isDispatching || voice.state === 'uploading';
  const microphoneUnsupported = voice.permissionState === 'unsupported';
  const canAttemptManualRecording = canUseVoice && !hasPending && !chat.isSending && !isDispatching && voice.state === 'idle';
  const tapToTextEnabled = false;

  useEffect(() => {
    void voice.refreshPermissionState?.();
  }, [voice.refreshPermissionState]);

  useEffect(() => {
    if (!canUseVoice) return;

    if (voice.permissionState === 'granted' && !voicePermissionPrompted) {
      setVoicePermissionPrompted(true);
      return;
    }

    if (voice.permissionState === 'denied' && voicePermissionPrompted) {
      setVoicePermissionPrompted(false);
    }
  }, [canUseVoice, setVoicePermissionPrompted, voice.permissionState, voicePermissionPrompted]);


  useEffect(() => {
    if (voice.permissionState === 'granted') setShowPermissionPrompt(false);
  }, [voice.permissionState]);

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

  const openTextOverlay = useCallback(() => {
    openModal({ type: 'ai-text-overlay', mode: 'text', autoStartVoice: false, autoCloseOnVoiceResult: false });
  }, [openModal]);

  const openPermissionPrompt = useCallback(() => {
    voice.cancel();
    voice.reset?.();
    resetVoiceMachine();
    setIsPriming(false);
    setShowPermissionPrompt(true);
    showThought(t('voice.thought.micNeeded'), 'warning', 2600);
  }, [resetVoiceMachine, showThought, t, voice]);

  const explainVoiceUnavailable = useCallback(() => {
    if (!canUseVoice || microphoneUnsupported) showThought(t('voice.thought.unavailable'), 'warning', 2400);
    else if (voice.permissionState === 'denied') openPermissionPrompt();
    else if (hasPending) showThought(t('voice.thought.closeActionFirst'), 'warning', 2400);
  }, [canUseVoice, hasPending, microphoneUnsupported, openPermissionPrompt, showThought, t, voice.permissionState]);

  const startHoldRecording = useCallback(async () => {
    if (!canAttemptManualRecording) {
      explainVoiceUnavailable();
      return false;
    }

    if (microphoneUnsupported) {
      showThought(t('voice.thought.unavailable'), 'warning', 2400);
      return false;
    }

    resetVoiceMachine();
    const result = await voice.start();

    if (result === 'started') {
      setVoicePermissionPrompted(true);
      showThought(t('voice.thought.listening'), 'listening', 1600);
      return true;
    }

    if (result === 'permission-consumed' || result === 'permission-ready') {
      const nextPermission = await voice.refreshPermissionState?.();
      const allowed = nextPermission === 'granted';
      setVoicePermissionPrompted(allowed);
      if (allowed) {
        showThought(t('voice.thought.micReady'), 'success', 2200);
      } else if (nextPermission === 'denied' || nextPermission === 'unsupported') {
        openPermissionPrompt();
      } else {
        showThought(t('voice.thought.micNeeded'), 'warning', 2400);
      }
      resetVoiceMachine();
      voice.reset?.();
      return false;
    }

    explainVoiceUnavailable();
    return false;
  }, [canAttemptManualRecording, explainVoiceUnavailable, microphoneUnsupported, openPermissionPrompt, resetVoiceMachine, setVoicePermissionPrompted, showThought, t, voice]);

  const handleCompanionTap = useCallback(() => {
    if (!canUseVoice) {
      showThought(t('voice.thought.unavailable'), 'warning', 2400);
      return;
    }

    if (microphoneUnsupported) {
      showThought(t('voice.thought.unavailable'), 'warning', 2400);
      return;
    }

    if (voice.permissionState !== 'granted') {
      openPermissionPrompt();
      return;
    }

    if (hasPending) {
      showThought(t('voice.thought.closeActionFirst'), 'warning', 2400);
      return;
    }

    showThought(t('voice.fina.holdVoiceOnly'), 'neutral', 1900);
  }, [canUseVoice, hasPending, microphoneUnsupported, openPermissionPrompt, showThought, t, voice.permissionState]);

  const primeVoicePermission = useCallback(async () => {
    setIsPriming(true);
    try {
      const ready = await voice.primePermission();
      if (ready) {
        setVoicePermissionPrompted(true);
        setShowPermissionPrompt(false);
        showThought(t('voice.thought.micReady'), 'success', 3200);
      } else {
        setVoicePermissionPrompted(false);
        voice.reset?.();
        resetVoiceMachine();
        showThought(t('voice.thought.micNeeded'), 'warning', 3600);
      }
    } catch {
      setVoicePermissionPrompted(false);
      voice.reset?.();
      resetVoiceMachine();
      showThought(t('voice.thought.micNeeded'), 'warning', 3600);
    } finally {
      setIsPriming(false);
    }
  }, [resetVoiceMachine, setVoicePermissionPrompted, showThought, t, voice]);

  const onCancelRecording = useCallback((reason: string, mode: string) => {
    logVoiceDebugEvent('manual_voice_cancelled', { reason, mode, voiceState: voice.state });
    voice.cancel();
    resetVoiceMachine();
    showThought(t('voice.thought.cancelled'), 'neutral', 1600);
  }, [resetVoiceMachine, showThought, t, voice]);

  const {
    gestureMode,
    resetGesture,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useVoiceHoldGesture({
    voiceState: voice.state,
    startHoldRecording,
    stopVoice: voice.stop,
    openTextOverlay,
    onCancelRecording,
    onTap: handleCompanionTap,
    showThought,
    tapToTextEnabled,
    holdToVoiceMs: 80,
    labels: {
      recognizing: t('voice.thought.recognizing'),
      pullForText: t('voice.thought.pullForText'),
    },
  });

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
      openPermissionPrompt();
      resetGesture();
      resetVoiceMachine();
      return;
    }

    if (voice.error === 'no-speech' || voice.error === 'transcription-timeout' || voice.error === 'transcription-error' || voice.error === 'rate-limited') {
      showThought(voice.error === 'rate-limited' ? t('voice.thought.tooManyRequests') : t('voice.thought.notHeard'), 'warning', 2600);
      resetGesture();
      resetVoiceMachine();
      window.setTimeout(() => {
        voice.reset?.();
      }, 0);
    }
  }, [openPermissionPrompt, resetGesture, resetVoiceMachine, setVoicePermissionPrompted, showThought, t, voice]);

  useEffect(() => {
    if (voice.state !== 'recording' && voice.state !== 'uploading') return;

    const timeoutMs = voice.state === 'recording' ? Math.max(recordSessionMs + 4200, 9800) : 24000;
    const timer = window.setTimeout(() => {
      logVoiceDebugEvent('voice_session_watchdog_reset', { voiceState: voice.state, timeoutMs });
      voice.reset?.();
      resetGesture();
      resetVoiceMachine();
      showThought(t('voice.thought.notHeard'), 'warning', 2600);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [recordSessionMs, resetGesture, resetVoiceMachine, showThought, t, voice]);

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
    const pendingActionsCount = chat.pendingActions.length;
    const previousPendingActionsCount = previousPendingActionsCountRef.current;
    const previousHasTextChatOverlay = previousHasTextChatOverlayRef.current;

    if (!pendingAutoOpenHydratedRef.current) {
      pendingAutoOpenHydratedRef.current = true;
      suppressPendingOverlayAutoOpenRef.current = pendingActionsCount > 0;
    } else if (pendingActionsCount <= 0) {
      suppressPendingOverlayAutoOpenRef.current = false;
    } else if (pendingActionsCount > previousPendingActionsCount) {
      suppressPendingOverlayAutoOpenRef.current = false;
    } else if (previousHasTextChatOverlay && !hasTextChatOverlay) {
      suppressPendingOverlayAutoOpenRef.current = true;
    }

    previousPendingActionsCountRef.current = pendingActionsCount;
    previousHasTextChatOverlayRef.current = hasTextChatOverlay;
  }, [chat.pendingActions.length, hasTextChatOverlay]);

  useEffect(() => {
    if (!pendingAutoOpenHydratedRef.current) return;
    if (chat.pendingActions.length <= 0 || hasTextChatOverlay || suppressPendingOverlayAutoOpenRef.current) return;
    openModal({ type: 'ai-text-overlay', mode: 'text', autoStartVoice: false, autoCloseOnVoiceResult: false });
  }, [chat.pendingActions.length, hasTextChatOverlay, openModal]);

  useEffect(() => () => {
    resetVoiceMachineRef.current();
    voiceCancelRef.current();
  }, []);

  const mood = useMemo<VoiceCompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (voice.state === 'recording' || gestureMode === 'holding') return 'listening';
    if (voice.state === 'uploading' || chat.isSending || isDispatching) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [chat.isSending, chat.pendingActions.length, gestureMode, isDispatching, thought?.tone, voice.state]);

  const needsIntro = false;
  const showFloatingCompanion = !hasOpenModal;

  return (
    <>
      <VoiceCompanionSurface
        needsIntro={needsIntro}
        showFloatingCompanion={showFloatingCompanion}
        wakeName={wakeName}
        isPriming={isPriming}
        permissionState={voice.permissionState}
        onPrimePermission={primeVoicePermission}
        onSkipPermissionIntro={() => undefined}
        thought={thought}
        canUseVoice={canUseVoice}
        isBusy={isBusy}
        voiceState={voice.state}
        captureMode={captureMode}
        phase={phase}
        cooldownUntil={cooldownUntil}
        mood={mood}
        gestureMode={gestureMode}
        ariaLabel={t(tapToTextEnabled ? 'voice.fina.tapTextHoldVoice' : 'voice.fina.holdVoiceOnly')}
        tapToTextEnabled={tapToTextEnabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {showPermissionPrompt && !hasOpenModal ? (
        <VoicePermissionMiniPrompt
          wakeName={wakeName}
          isPriming={isPriming}
          permissionState={voice.permissionState}
          placement="floating"
          onPrime={primeVoicePermission}
          onClose={() => setShowPermissionPrompt(false)}
        />
      ) : null}
    </>
  );
}

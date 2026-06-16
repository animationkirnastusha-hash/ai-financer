import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import { useVoiceCommandDispatcher } from '@/features/voice/model/useVoiceCommandDispatcher';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { useVoiceSessionMachine } from '@/features/voice/model/useVoiceSessionMachine';
import type { VoiceCompanionMood } from '@/features/voice/model/voiceSession.types';
import { VoiceCompanionSurface } from '@/features/voice/ui/companion/VoiceCompanionSurface';
import { useVoiceCompanionThought } from '@/features/voice/ui/companion/useVoiceCompanionThought';
import { useVoiceHoldGesture } from '@/features/voice/ui/companion/useVoiceHoldGesture';
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
  const [permissionIntroOpen, setPermissionIntroOpen] = useState(false);
  const [permissionIntroDismissed, setPermissionIntroDismissed] = useState(false);

  const lastAssistantMessageKeyRef = useRef('');
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

  const voice = useVoiceInput({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    sessionMs: recordSessionMs,
    permissionWasPrompted: voicePermissionPrompted,
    onText: (text) => handleTextRef.current(text),
  });

  const canUseVoice = voiceEnabled && voiceBetaEnabled && voice.isSupported;
  const hasPending = chat.pendingActions.length > 0;
  const isBusy = chat.isSending || isDispatching || voice.state === 'uploading';
  const microphoneBlocked = voice.permissionState === 'denied' || voice.permissionState === 'unsupported';
  const microphoneNeedsAction = canUseVoice && (!voicePermissionPrompted || microphoneBlocked);
  const voicePermissionReady = canUseVoice && voicePermissionPrompted && !microphoneBlocked;
  const canStartManualRecording = voicePermissionReady && !hasPending && !chat.isSending && !isDispatching && voice.state === 'idle';
  const tapToTextEnabled = false;

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

    if (voice.permissionState === 'denied') {
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
      setPermissionIntroOpen(true);
      setPermissionIntroDismissed(false);
    }

    explainVoiceUnavailable();
    return false;
  }, [canStartManualRecording, explainVoiceUnavailable, resetVoiceMachine, showThought, t, voice]);

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
  }, [setVoicePermissionPrompted, showThought, t, voice]);

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
    showThought,
    tapToTextEnabled,
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

  const needsIntro = microphoneNeedsAction && (!permissionIntroDismissed || permissionIntroOpen);
  const showFloatingCompanion = !hasOpenModal;

  return (
    <VoiceCompanionSurface
      needsIntro={needsIntro}
      showFloatingCompanion={showFloatingCompanion}
      wakeName={wakeName}
      isPriming={isPriming}
      permissionState={voice.permissionState}
      onPrimePermission={primeVoicePermission}
      onSkipPermissionIntro={() => {
        setPermissionIntroOpen(false);
        setPermissionIntroDismissed(true);
      }}
      thought={thought}
      canUseVoice={canUseVoice}
      isBusy={isBusy}
      voiceState={voice.state}
      captureMode={captureMode}
      phase={phase}
      cooldownUntil={cooldownUntil}
      mood={mood}
      ariaLabel={t(tapToTextEnabled ? 'voice.fina.tapTextHoldVoice' : 'voice.fina.holdVoiceOnly')}
      tapToTextEnabled={tapToTextEnabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEventHandler } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import {
  logVoiceDebugEvent,
  normalizeVoiceText,
  shouldIgnoreVoiceCommand,
  usePressToTalkVoice,
  useVoiceCommandDispatcher,
  useVoiceThought,
  type VoiceCompanionMood,
  type VoiceSessionPhase,
} from '@/features/voice';
import { VoiceCompanionSurface } from '@/features/voice/ui/companion/VoiceCompanionSurface';
import { VoicePermissionMiniPrompt } from '@/features/voice/ui/VoicePermissionMiniPrompt';
import { useI18n } from '@/shared/lib/i18n';

const FLOATING_VOICE_SESSION_MS = 9000;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripOptionalCompanionName(text: string, companionName: string) {
  const cleanText = normalizeVoiceText(text);
  const cleanName = normalizeVoiceText(companionName || 'Фина');
  if (!cleanName) return cleanText;

  const pattern = new RegExp(`^\\s*${escapeRegExp(cleanName)}[\\s,.:;!—-]+`, 'i');
  return normalizeVoiceText(cleanText.replace(pattern, ''));
}

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
  const [isDispatching, setIsDispatching] = useState(false);

  const lastAssistantMessageKeyRef = useRef('');
  const previousHasTextChatOverlayRef = useRef(false);
  const previousPendingActionsCountRef = useRef(0);
  const pendingAutoOpenHydratedRef = useRef(false);
  const suppressPendingOverlayAutoOpenRef = useRef(false);

  const { thought, showThought } = useVoiceThought();
  const wakeName = companionName || 'Фина';

  const dispatchCommand = useVoiceCommandDispatcher({
    chat,
    navigateTo,
    goBack,
    openTextChat: () => openAIWithCommand(),
    showThought,
  });

  const handleVoiceText = useCallback(async (rawText: string) => {
    const command = stripOptionalCompanionName(rawText, wakeName);
    if (!command || shouldIgnoreVoiceCommand(command)) {
      showThought(t('voice.thought.notHeard'), 'warning', 2200);
      return;
    }

    const sessionId = crypto.randomUUID();
    setIsDispatching(true);
    showThought(t('voice.thought.thinking'), 'neutral', 1400);
    try {
      await dispatchCommand({ sessionId, text: command });
    } finally {
      setIsDispatching(false);
    }
  }, [dispatchCommand, showThought, t, wakeName]);

  const voice = usePressToTalkVoice({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    source: 'floating',
    maxDurationMs: FLOATING_VOICE_SESSION_MS,
    permissionWasPrompted: voicePermissionPrompted,
    onText: handleVoiceText,
  });

  const canUseVoice = voiceEnabled && voiceBetaEnabled && voice.isSupported;
  const hasPending = chat.pendingActions.length > 0;
  const isBusy = chat.isSending || isDispatching || voice.state === 'uploading';
  const microphoneUnsupported = voice.permissionState === 'unsupported';
  const canAttemptVoice = canUseVoice && !hasPending && !chat.isSending && !isDispatching && voice.state !== 'uploading';
  const tapToTextEnabled = false;

  useEffect(() => {
    void voice.refreshPermissionState();
  }, [voice.refreshPermissionState]);

  useEffect(() => {
    if (!canUseVoice) return;
    if (voice.permissionState === 'granted' && !voicePermissionPrompted) setVoicePermissionPrompted(true);
    if (voice.permissionState === 'denied' && voicePermissionPrompted) setVoicePermissionPrompted(false);
  }, [canUseVoice, setVoicePermissionPrompted, voice.permissionState, voicePermissionPrompted]);

  useEffect(() => {
    if (voice.permissionState === 'granted') setShowPermissionPrompt(false);
  }, [voice.permissionState]);

  const openPermissionPrompt = useCallback(() => {
    voice.cancel('permission-help');
    voice.reset();
    setIsPriming(false);
    setShowPermissionPrompt(true);
    showThought(t('voice.thought.micNeeded'), 'warning', 2600);
  }, [showThought, t, voice]);

  const primeVoicePermission = useCallback(async () => {
    setIsPriming(true);
    try {
      const ready = await voice.primePermission();
      setVoicePermissionPrompted(ready);
      if (ready) {
        setShowPermissionPrompt(false);
        showThought(t('voice.thought.micReady'), 'success', 3200);
      } else {
        setShowPermissionPrompt(true);
        showThought(t('voice.thought.micNeeded'), 'warning', 3600);
      }
    } finally {
      setIsPriming(false);
    }
  }, [setVoicePermissionPrompted, showThought, t, voice]);

  const handleCompanionPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    if (!canUseVoice || microphoneUnsupported) {
      showThought(t('voice.thought.unavailable'), 'warning', 2400);
      return;
    }

    if (voice.permissionState === 'denied') {
      openPermissionPrompt();
      return;
    }

    if (hasPending) {
      showThought(t('voice.thought.closeActionFirst'), 'warning', 2400);
      return;
    }

    if (!canAttemptVoice) return;
    showThought(t('voice.thought.listening'), 'listening', 1600);
    voice.handlePointerDown(event);
  }, [canAttemptVoice, canUseVoice, hasPending, microphoneUnsupported, openPermissionPrompt, showThought, t, voice]);

  const handleCompanionPointerMove = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    voice.handlePointerMove(event);
  }, [voice]);

  const handleCompanionPointerUp = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    showThought(t('voice.thought.recognizing'), 'thinking', 1400);
    voice.handlePointerUp(event);
  }, [showThought, t, voice]);

  const handleCompanionPointerCancel = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    voice.handlePointerCancel(event);
    showThought(t('voice.thought.cancelled'), 'neutral', 1600);
  }, [showThought, t, voice]);

  useEffect(() => {
    if (!voice.error) return;

    if (voice.error === 'microphone-denied' || voice.error === 'not-allowed' || voice.error === 'service-not-allowed' || voice.error === 'unsupported') {
      setVoicePermissionPrompted(false);
      openPermissionPrompt();
      return;
    }

    if (voice.error === 'no-speech' || voice.error === 'transcription-timeout' || voice.error === 'transcription-error' || voice.error === 'rate-limited') {
      showThought(voice.error === 'rate-limited' ? t('voice.thought.tooManyRequests') : t('voice.thought.notHeard'), 'warning', 2600);
      window.setTimeout(() => voice.reset(), 0);
    }
  }, [openPermissionPrompt, setVoicePermissionPrompted, showThought, t, voice, voice.error]);

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
      voice.cancel('pending-action-opened');
    }
  }, [chat.pendingActions.length, voice]);

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
    voice.cancel('companion-unmount');
  }, [voice]);

  const phase = useMemo<VoiceSessionPhase>(() => {
    if (isDispatching) return 'dispatching';
    if (voice.state === 'uploading') return 'uploading';
    if (voice.state === 'recording' || voice.isPressed) return 'holding';
    return 'idle';
  }, [isDispatching, voice.isPressed, voice.state]);

  const mood = useMemo<VoiceCompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (voice.state === 'recording' || voice.isPressed) return 'listening';
    if (voice.state === 'uploading' || chat.isSending || isDispatching) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [chat.isSending, chat.pendingActions.length, isDispatching, thought?.tone, voice.isPressed, voice.state]);

  const showFloatingCompanion = !hasOpenModal;

  return (
    <>
      <VoiceCompanionSurface
        needsIntro={false}
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
        captureMode="manual"
        phase={phase}
        cooldownUntil={0}
        mood={mood}
        gestureMode={voice.isPressed ? 'holding' : 'idle'}
        ariaLabel={t(tapToTextEnabled ? 'voice.fina.tapTextHoldVoice' : 'voice.fina.holdVoiceOnly')}
        tapToTextEnabled={tapToTextEnabled}
        onPointerDown={handleCompanionPointerDown}
        onPointerMove={handleCompanionPointerMove}
        onPointerUp={handleCompanionPointerUp}
        onPointerCancel={handleCompanionPointerCancel}
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

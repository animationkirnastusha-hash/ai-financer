import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import { useVoiceCommandDispatcher } from '@/features/voice/model/useVoiceCommandDispatcher';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { useVoiceSessionMachine } from '@/features/voice/model/useVoiceSessionMachine';
import { VOICE_AUTO_LISTENER_RESTART_MS, VOICE_BUBBLE_TIMEOUT_MS } from '@/features/voice/model/voiceConstants';
import type { VoiceCompanionMood, VoiceThought, VoiceBubbleTone } from '@/features/voice/model/voiceSession.types';
import { compactVoiceBubble } from '@/features/voice/model/voiceText';
import { VoicePendingConfirmModal } from '@/features/voice/ui/VoicePendingConfirmModal';
import { VoicePermissionIntro } from '@/features/voice/ui/VoicePermissionIntro';
import { VoiceStatusPill } from '@/features/voice/ui/VoiceStatusPill';
import { VoiceThoughtBubble } from '@/features/voice/ui/VoiceThoughtBubble';
import { CompanionButton } from '@/shared/ui/CompanionButton';

export function VoiceFirstCompanionLayer() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);

  const chat = useChatController();

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const companionName = useSettingsStore((state) => state.companionName || 'Фина');
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

  const [thought, setThought] = useState<VoiceThought | null>(null);
  const [isPriming, setIsPriming] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  const bubbleTimerRef = useRef<number | null>(null);
  const lastThoughtRef = useRef<{ text: string; tone: VoiceBubbleTone; at: number }>({ text: '', tone: 'neutral', at: 0 });
  const lastAssistantMessageKeyRef = useRef('');
  const handleTextRef = useRef<(text: string) => Promise<void> | void>(() => undefined);
  const voiceCancelRef = useRef<() => void>(() => undefined);
  const resetVoiceMachineRef = useRef<() => void>(() => undefined);
  const voiceStartRef = useRef<() => Promise<'started' | 'permission-ready' | 'busy' | 'error'>>(async () => 'busy');

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
  } = machine;

  const voice = useVoiceInput({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    sessionMs: recordSessionMs,
    onText: (text) => handleTextRef.current(text),
  });

  const canUseVoice = voiceEnabled && voiceBetaEnabled && voice.isSupported;
  const isBusy = chat.isSending || isProcessingVoice || isDispatching;

  useEffect(() => {
    handleTextRef.current = handleTranscript;
  }, [handleTranscript]);

  useEffect(() => {
    resetVoiceMachineRef.current = resetVoiceMachine;
  }, [resetVoiceMachine]);

  useEffect(() => {
    voiceCancelRef.current = voice.cancel;
    voiceStartRef.current = voice.start;
  }, [voice.cancel, voice.start]);

  const primeVoicePermission = useCallback(async () => {
    setIsPriming(true);
    try {
      const ready = await voice.primePermission();
      setVoicePermissionPrompted(true);
      if (ready) showThought(`Готово. Скажи «${wakeName}» и команду.`, 'success', 3200);
      else showThought(`Скажи «${wakeName}», когда будешь готов.`, 'neutral', 3200);
    } catch {
      showThought('Нужен доступ к микрофону.', 'warning', 3600);
    } finally {
      setIsPriming(false);
    }
  }, [setVoicePermissionPrompted, showThought, voice, wakeName]);

  useEffect(() => {
    if (!canUseVoice || !voiceAlwaysOnEnabled || !voicePermissionPrompted) return undefined;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return undefined;
    if (chat.pendingActions.length > 0 || chat.isSending || isProcessingVoice || isDispatching) return undefined;
    if (voice.state !== 'idle') return undefined;
    if (String(phase) === 'cooldown' || Date.now() < cooldownUntil) return undefined;

    const delay = captureMode === 'command' ? 80 : VOICE_AUTO_LISTENER_RESTART_MS;
    const timer = window.setTimeout(() => {
      if (voice.state !== 'idle') return;
      if (chat.pendingActions.length > 0 || chat.isSending || isDispatching) return;
      if (String(phase) === 'cooldown' || Date.now() < cooldownUntil) return;

      void voiceStartRef.current().then((result) => {
        if (result === 'started') {
          logVoiceDebugEvent(captureMode === 'command' ? 'command_listener_auto_start' : 'wake_listener_auto_start', {
            phase,
          });
        }
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [canUseVoice, captureMode, chat.isSending, chat.pendingActions.length, cooldownUntil, isDispatching, isProcessingVoice, phase, voice.state, voiceAlwaysOnEnabled, voicePermissionPrompted]);

  useEffect(() => {
    if (!voice.error) return;

    if (voice.error === 'transcription-not-configured') {
      showThought('Распознавание ещё не настроено.', 'warning', 4200);
      return;
    }

    if (voice.error === 'microphone-denied' || voice.error === 'not-allowed' || voice.error === 'service-not-allowed') {
      showThought('Нужен доступ к микрофону.', 'warning', 3600);
      return;
    }

    if (captureMode === 'wake') return;

    if (voice.error === 'no-speech' || voice.error === 'transcription-timeout' || voice.error === 'transcription-error') {
      showThought('Не расслышала команду.', 'warning', 2600);
      resetVoiceMachine();
    }
  }, [captureMode, resetVoiceMachine, showThought, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    voice.stopSpeaking();
    resetVoiceMachine();

    if (lastMessage.kind === 'preview') {
      showThought('Проверь действие.', 'warning', 3600);
      return;
    }

    if (lastMessage.kind === 'error') {
      showThought(lastMessage.text || 'Нужно уточнение.', 'warning', 5000);
      return;
    }

    showThought(lastMessage.text || 'Готово.', 'success', 2600);
  }, [chat.messages, resetVoiceMachine, showThought, voice]);

  useEffect(() => {
    setIsProcessingVoice(isDispatching);
  }, [isDispatching]);

  useEffect(() => () => {
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    resetVoiceMachineRef.current();
    voiceCancelRef.current();
  }, []);

  const mood = useMemo<VoiceCompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (phase === 'command' || voice.state === 'recording' || captureMode === 'command') return 'listening';
    if (phase === 'dispatching' || voice.state === 'uploading' || chat.isSending || isProcessingVoice || isDispatching) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [captureMode, chat.isSending, chat.pendingActions.length, isDispatching, isProcessingVoice, phase, thought?.tone, voice.state]);

  const needsIntro = canUseVoice && !voicePermissionPrompted;
  const showFloatingCompanion = currentScreen !== 'ai-core';

  if (!showFloatingCompanion && !needsIntro && chat.pendingActions.length === 0) return null;

  return (
    <>
      {needsIntro ? (
        <VoicePermissionIntro
          wakeName={wakeName}
          isPriming={isPriming}
          onPrime={primeVoicePermission}
          onSkip={() => setVoicePermissionPrompted(true)}
        />
      ) : null}

      <VoicePendingConfirmModal
        pendingActions={chat.pendingActions}
        onConfirm={chat.confirmAction}
        onCancel={chat.cancelAction}
        onUpdate={chat.updatePendingAction}
      />

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
                voiceAlwaysOnEnabled={voiceAlwaysOnEnabled}
                wakeName={wakeName}
              />
            </div>

            <CompanionButton
              mood={mood}
              size="md"
              label={`${wakeName} слушает голос`}
              className="pointer-events-none select-none"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

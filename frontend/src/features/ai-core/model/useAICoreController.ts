import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AICoreMode,
  AICoreState,
} from '@/features/ai-core/model/aiCore.types';
import { useChatController } from '@/features/chat/model/useChatController';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { telegramHaptic } from '@/shared/lib/telegram';

export function useAICoreController() {
  const chat = useChatController();

  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceRepliesEnabled = useSettingsStore(
    (state) => state.voiceRepliesEnabled,
  );

  const [coreState, setCoreState] = useState<AICoreState>('expanded');
  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<AICoreMode>('text');
  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(true);
  const [isCommandListOpen, setIsCommandListOpen] = useState(false);
  const [isVoiceLocked, setIsVoiceLocked] = useState(false);
  const [voiceGestureHint, setVoiceGestureHint] = useState<string | null>(null);

  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const voiceStartRequestIdRef = useRef(0);
  const voiceWasCancelledRef = useRef(false);

  const handleSingleCommand = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      const navigationIntent = parseNavigationIntent(trimmed);

      if (navigationIntent.type === 'open_screen') {
        telegramHaptic('light');
        navigateTo(navigationIntent.screen);
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        return;
      }

      await chat.sendMessage(trimmed);
    },
    [chat, goBack, navigateTo],
  );

  const handleIntentOrMessage = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();

      if (!trimmed) return;

      setCoreState('thinking');
      await handleSingleCommand(trimmed);
      setInputValue('');
    },
    [handleSingleCommand],
  );

  const voice = useVoiceInput({
    lang: 'ru-RU',
    onText: async (text) => {
      setInputValue(text);
      await handleIntentOrMessage(text);
    },
  });

  useEffect(() => {
    if (voice.state === 'recording') {
      setCoreState('listening');
      setMode('voice');
      return;
    }

    if (voice.state === 'uploading') {
      setCoreState('thinking');
      return;
    }

    if (voice.state === 'speaking') {
      setCoreState('responding');
      return;
    }

    if (chat.isSending) {
      setCoreState('thinking');
      return;
    }

    if (chat.messages.length > 0) {
      const lastMessage = chat.messages[chat.messages.length - 1];

      if (lastMessage?.role === 'assistant') {
        setCoreState('responding');

        const timer = window.setTimeout(() => {
          setCoreState(isCommandPanelOpen ? 'expanded' : 'idle');
        }, 900);

        return () => window.clearTimeout(timer);
      }
    }

    if (voice.state === 'idle' && !chat.isSending) {
      setCoreState(isCommandPanelOpen ? 'expanded' : 'idle');
    }
  }, [chat.isSending, chat.messages, isCommandPanelOpen, voice.state]);

  useEffect(() => {
    if (!voice.error) return;

    setMode('text');
    setIsVoiceLocked(false);
    setVoiceGestureHint(null);
    setIsCommandPanelOpen(true);
    setCoreState('expanded');
  }, [voice.error]);

  const latestAssistantMessage = useMemo(() => {
    return chat.messages
      .filter((message) => message.role === 'assistant')
      .at(-1) ?? null;
  }, [chat.messages]);

  useEffect(() => {
    if (!voiceRepliesEnabled) return;
    if (!latestAssistantMessage) return;
    if (latestAssistantMessage.kind === 'preview') return;
    if (latestAssistantMessage.id === lastSpokenMessageIdRef.current) return;

    lastSpokenMessageIdRef.current = latestAssistantMessage.id;
    voice.speak(latestAssistantMessage.text);
  }, [latestAssistantMessage, voice, voiceRepliesEnabled]);

  const openCommandPanel = useCallback(() => {
    voice.stopSpeaking();
    setMode('text');
    setIsVoiceLocked(false);
    setVoiceGestureHint(null);
    setIsCommandPanelOpen(true);
    setCoreState('expanded');
  }, [voice]);

  const closeCommandPanel = useCallback(() => {
    setInputValue('');
    voice.reset();
    setIsVoiceLocked(false);
    setVoiceGestureHint(null);
    setIsCommandPanelOpen(true);
    setCoreState('expanded');
  }, [voice]);

  const openCommandList = useCallback(() => {
    setIsCommandListOpen(true);
  }, []);

  const closeCommandList = useCallback(() => {
    setIsCommandListOpen(false);
  }, []);

  const runQuickCommand = useCallback(
    async (command: string) => {
      voice.stopSpeaking();
      setMode('text');
      setCoreState('thinking');
      await handleIntentOrMessage(command);
    },
    [handleIntentOrMessage, voice],
  );

  const handleOrbTap = useCallback(() => {
    voice.stopSpeaking();
    openCommandPanel();
  }, [openCommandPanel, voice]);

  const handleOrbHoldStart = useCallback(async () => {
    if (!voiceEnabled || !voiceBetaEnabled) {
      openCommandPanel();
      return;
    }

    const requestId = voiceStartRequestIdRef.current + 1;
    voiceStartRequestIdRef.current = requestId;
    voiceWasCancelledRef.current = false;

    telegramHaptic('medium');
    voice.stopSpeaking();
    setMode('voice');
    setIsVoiceLocked(false);
    setInputValue('');
    setIsCommandPanelOpen(false);
    setCoreState('listening');
    setVoiceGestureHint('Держи и говори • влево — отмена • вверх — замок');

    const startResult = await voice.start();

    if (voiceStartRequestIdRef.current !== requestId) return;

    if (voiceWasCancelledRef.current) {
      voice.cancel();
      return;
    }

    if (startResult === 'permission-granted') {
      telegramHaptic('light');
      setMode('text');
      setIsVoiceLocked(false);
      setIsCommandPanelOpen(true);
      setCoreState('expanded');
      setVoiceGestureHint('Микрофон разрешён. Зажми сферу ещё раз и говори.');
      return;
    }

    if (startResult === 'error') {
      setMode('text');
      setIsVoiceLocked(false);
      setIsCommandPanelOpen(true);
      setCoreState('expanded');
      setVoiceGestureHint(null);
      return;
    }

    setVoiceGestureHint('Держи и говори • влево — отмена • вверх — замок');
  }, [openCommandPanel, voice, voiceBetaEnabled, voiceEnabled]);

  const handleOrbHoldEnd = useCallback(() => {
    if (!voiceEnabled || !voiceBetaEnabled) {
      openCommandPanel();
      return;
    }

    if (isVoiceLocked) return;
    if (voice.state !== 'recording') return;

    telegramHaptic('light');
    setVoiceGestureHint(null);
    setCoreState('thinking');
    voice.stop();
  }, [isVoiceLocked, openCommandPanel, voice, voiceBetaEnabled, voiceEnabled]);

  const handleOrbVoiceCancel = useCallback(() => {
    voiceWasCancelledRef.current = true;
    voiceStartRequestIdRef.current += 1;

    telegramHaptic('heavy');
    setIsVoiceLocked(false);
    setVoiceGestureHint(null);
    setCoreState('expanded');
    setIsCommandPanelOpen(true);
    voice.cancel();
  }, [voice]);

  const handleOrbVoiceLock = useCallback(() => {
    if (voice.state !== 'recording') return;

    telegramHaptic('medium');
    setIsVoiceLocked(true);
    setVoiceGestureHint('Микрофон закреплён. Нажми «Готово», когда закончишь.');
  }, [voice.state]);

  const finishLockedVoice = useCallback(() => {
    if (voice.state !== 'recording') return;

    telegramHaptic('light');
    setIsVoiceLocked(false);
    setVoiceGestureHint(null);
    setCoreState('thinking');
    voice.stop();
  }, [voice]);

  const submit = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    voice.stopSpeaking();
    setCoreState('thinking');
    await handleIntentOrMessage(trimmed);
  }, [handleIntentOrMessage, inputValue, voice]);

  return {
    ...chat,

    coreState,
    mode,
    inputValue,
    setInputValue,
    isCommandPanelOpen,
    isCommandListOpen,
    isVoiceLocked,
    voiceGestureHint,

    openCommandPanel,
    closeCommandPanel,
    openCommandList,
    closeCommandList,
    runQuickCommand,

    handleOrbTap,
    handleOrbHoldStart,
    handleOrbHoldEnd,
    handleOrbVoiceCancel,
    handleOrbVoiceLock,
    finishLockedVoice,
    submit,

    latestAssistantMessage,

    voiceTranscript: voice.transcript,
    voiceEngine: voice.mode,
    isVoiceSupported: voice.isSupported,
    voiceState: voice.state,
    voiceError: voice.error,
    stopVoiceReply: voice.stopSpeaking,
  };
}

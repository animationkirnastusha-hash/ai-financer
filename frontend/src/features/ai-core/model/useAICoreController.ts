import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AICoreMode,
  AICoreState,
} from '@/features/ai-core/model/aiCore.types';
import { useChatController } from '@/features/chat/model/useChatController';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { parseCurrencyIntent } from '@/features/currency/lib/parseCurrencyIntent';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { telegramHaptic } from '@/shared/lib/telegram';

export function useAICoreController() {
  const chat = useChatController();

  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const consumeInitialAICommand = useNavigationStore((state) => state.consumeInitialAICommand);

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceRepliesEnabled = useSettingsStore(
    (state) => state.voiceRepliesEnabled,
  );
  const setMainCurrency = useSettingsStore((state) => state.setMainCurrency);
  const setSecondaryCurrency = useSettingsStore((state) => state.setSecondaryCurrency);
  const setSecondaryCurrencyEnabled = useSettingsStore((state) => state.setSecondaryCurrencyEnabled);

  const [coreState, setCoreState] = useState<AICoreState>('expanded');
  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<AICoreMode>('text');
  const [isCommandPanelOpen, setIsCommandPanelOpen] = useState(true);
  const [isCommandListOpen, setIsCommandListOpen] = useState(false);
  const [isVoiceLocked, setIsVoiceLocked] = useState(false);

  const lastSpokenMessageIdRef = useRef<string | null>(null);
  const voiceActionInFlightRef = useRef(false);

  const handleIntentOrMessage = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      const currencyIntent = parseCurrencyIntent(trimmed);
      if (currencyIntent.type === 'set_main_currency') {
        setMainCurrency(currencyIntent.currency);
        telegramHaptic('light');
        setInputValue('');
        return;
      }
      if (currencyIntent.type === 'set_secondary_currency') {
        setSecondaryCurrency(currencyIntent.currency);
        setSecondaryCurrencyEnabled(true);
        telegramHaptic('light');
        setInputValue('');
        return;
      }

      const navigationIntent = parseNavigationIntent(trimmed);

      if (navigationIntent.type === 'open_screen') {
        telegramHaptic('light');
        navigateTo(navigationIntent.screen);
        setInputValue('');
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        setInputValue('');
        return;
      }

      setCoreState('thinking');
      await chat.sendMessage(trimmed);
      setInputValue('');
    },
    [chat, goBack, navigateTo, setMainCurrency, setSecondaryCurrency, setSecondaryCurrencyEnabled],
  );

  const voice = useVoiceInput({
    lang: 'ru-RU',
    onText: async (text) => {
      setInputValue(text);
      await handleIntentOrMessage(text);
    },
  });

  useEffect(() => {
    const command = consumeInitialAICommand();
    if (!command) return;

    voice.stopSpeaking();
    setMode('text');
    setIsVoiceLocked(false);
    setIsCommandPanelOpen(true);
    setCoreState('expanded');
    setInputValue(command);
  }, [consumeInitialAICommand, voice]);

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

    setIsVoiceLocked(false);
    setMode('text');
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
    setIsCommandPanelOpen(true);
    setCoreState('expanded');
  }, [voice]);

  const closeCommandPanel = useCallback(() => {
    setInputValue('');
    voice.reset();
    setIsVoiceLocked(false);
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

  const handleOrbHoldStart = useCallback(() => {
    if (voiceActionInFlightRef.current || voice.state === 'recording' || voice.state === 'uploading' || chat.isSending) return;

    if (!voiceEnabled || !voiceBetaEnabled) {
      openCommandPanel();
      return;
    }

    voiceActionInFlightRef.current = true;
    telegramHaptic('medium');
    voice.stopSpeaking();
    setMode('voice');
    setIsCommandPanelOpen(false);
    setInputValue('');
    setCoreState('listening');

    void voice.start().then((result) => {
      if (result === 'permission-ready' || result === 'error') {
        setMode('text');
        setIsVoiceLocked(false);
        setIsCommandPanelOpen(true);
        setCoreState('expanded');
      }
    }).finally(() => {
      window.setTimeout(() => {
        voiceActionInFlightRef.current = false;
      }, 280);
    });
  }, [chat.isSending, openCommandPanel, voice, voiceBetaEnabled, voiceEnabled]);

  const handleOrbHoldEnd = useCallback(() => {
    if (!voiceEnabled || !voiceBetaEnabled) {
      openCommandPanel();
      return;
    }

    if (isVoiceLocked || voice.state !== 'recording') return;

    telegramHaptic('light');
    setCoreState('thinking');
    voice.stop();
  }, [isVoiceLocked, openCommandPanel, voice, voiceBetaEnabled, voiceEnabled]);

  const handleOrbHoldCancel = useCallback(() => {
    telegramHaptic('light');
    setIsVoiceLocked(false);
    setMode('text');
    setIsCommandPanelOpen(true);
    setCoreState('expanded');
    voice.cancel();
  }, [voice]);

  const handleOrbHoldLock = useCallback(() => {
    telegramHaptic('medium');
    setIsVoiceLocked(true);
    setMode('voice');
    setIsCommandPanelOpen(false);
    setCoreState('listening');
  }, []);

  const finishLockedVoice = useCallback(() => {
    telegramHaptic('light');
    setIsVoiceLocked(false);
    setCoreState('thinking');
    voice.stop();
  }, [voice]);

  const cancelLockedVoice = useCallback(() => {
    telegramHaptic('light');
    setIsVoiceLocked(false);
    setMode('text');
    setIsCommandPanelOpen(true);
    setCoreState('expanded');
    voice.cancel();
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

    openCommandPanel,
    closeCommandPanel,
    openCommandList,
    closeCommandList,
    runQuickCommand,

    handleOrbTap,
    handleOrbHoldStart,
    handleOrbHoldEnd,
    handleOrbHoldCancel,
    handleOrbHoldLock,
    finishLockedVoice,
    cancelLockedVoice,
    submit,

    latestAssistantMessage,

    voiceTranscript: voice.transcript,
    voiceEngine: voice.mode,
    isVoiceSupported: voice.isSupported,
    voiceState: voice.state,
    voiceError: voice.error,
    isVoiceLocked,
    stopVoiceReply: voice.stopSpeaking,
  };
}

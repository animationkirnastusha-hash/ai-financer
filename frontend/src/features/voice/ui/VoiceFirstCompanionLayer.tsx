import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { telegramHaptic } from '@/shared/lib/telegram';

type CompanionMood = 'idle' | 'listening' | 'thinking' | 'confirm' | 'success' | 'warning';
type BubbleTone = 'neutral' | 'listening' | 'thinking' | 'success' | 'warning';

type Thought = {
  id: string;
  text: string;
  tone: BubbleTone;
};

const SILENCE_SUBMIT_MS = 1050;
const RESUME_DELAY_MS = 520;
const BUBBLE_TIMEOUT_MS = 4200;
const DUPLICATE_GUARD_MS = 1800;

function compactBubble(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。！？])\s+/)
    .slice(0, 2)
    .join(' ')
    .slice(0, 150);
}

export function VoiceFirstCompanionLayer() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  const chat = useChatController();

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceRepliesEnabled = useSettingsStore((state) => state.voiceRepliesEnabled);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

  const [thought, setThought] = useState<Thought | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isPriming, setIsPriming] = useState(false);

  const silenceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const lastStartAtRef = useRef(0);
  const shouldResumeRef = useRef(false);
  const isActiveRef = useRef(false);
  const isProcessingRef = useRef(false);
  const voiceStateRef = useRef('idle');
  const lastHandledRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const showThought = useCallback((text: string, tone: BubbleTone = 'neutral', timeoutMs = BUBBLE_TIMEOUT_MS) => {
    const cleanText = compactBubble(text);
    if (!cleanText) return;

    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
    }

    setThought({ id: crypto.randomUUID(), text: cleanText, tone });

    bubbleTimerRef.current = window.setTimeout(() => {
      setThought(null);
      bubbleTimerRef.current = null;
    }, timeoutMs);
  }, []);

  const handleText = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isProcessingRef.current) return;

    const now = Date.now();
    const lastHandled = lastHandledRef.current;
    if (lastHandled.text === text && now - lastHandled.at < DUPLICATE_GUARD_MS) return;
    lastHandledRef.current = { text, at: now };

    setIsProcessingVoice(true);
    clearSilenceTimer();
    showThought('Думаю...', 'thinking', 2200);

    try {
      const navigationIntent = parseNavigationIntent(text);

      if (navigationIntent.type === 'open_screen') {
        telegramHaptic('light');
        navigateTo(navigationIntent.screen);
        showThought('Открываю.', 'success');
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        showThought('Вернулся назад.', 'success');
        return;
      }

      await chat.sendMessage(text);
    } finally {
      setIsProcessingVoice(false);
    }
  }, [chat, clearSilenceTimer, goBack, navigateTo, showThought]);

  const voice = useVoiceInput({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    onText: handleText,
  });

  const canUseVoiceFirst = voiceEnabled && voiceBetaEnabled && voice.isSupported && voice.mode === 'speech';
  const isActive = canUseVoiceFirst && voiceAlwaysOnEnabled && voicePermissionPrompted;

  const startListening = useCallback(async () => {
    if (!canUseVoiceFirst || isProcessingRef.current) return;
    if (voiceStateRef.current === 'recording' || voiceStateRef.current === 'uploading' || voiceStateRef.current === 'speaking') return;

    const now = Date.now();
    if (now - lastStartAtRef.current < 360) return;
    lastStartAtRef.current = now;

    const result = await voice.start();
    if (result === 'started') {
      shouldResumeRef.current = true;
      showThought('Слушаю.', 'listening', 1200);
    }

    if (result === 'error') {
      shouldResumeRef.current = false;
      showThought('Микрофон недоступен. Можно написать команду текстом.', 'warning');
    }
  }, [canUseVoiceFirst, showThought, voice]);

  const resumeListeningSoon = useCallback((delayMs = RESUME_DELAY_MS) => {
    clearRestartTimer();
    restartTimerRef.current = window.setTimeout(() => {
      if (!isActiveRef.current || !shouldResumeRef.current || isProcessingRef.current) return;
      if (voiceStateRef.current !== 'idle') return;
      void startListening();
    }, delayMs);
  }, [clearRestartTimer, startListening]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (voice.state === 'recording') {
      voice.stop();
    }
  }, [clearSilenceTimer, voice]);

  const enableVoiceFirst = useCallback(async () => {
    setIsPriming(true);
    setVoicePermissionPrompted(true);
    setVoiceAlwaysOnEnabled(true);
    shouldResumeRef.current = true;

    try {
      const result = await voice.start();
      if (result === 'started') {
        showThought('Голос включён. Просто говори финансовые команды.', 'success');
      } else {
        showThought('Разрешение сохранено. Если микрофон не включился, проверь доступ в Telegram.', 'warning');
      }
    } finally {
      setIsPriming(false);
    }
  }, [setVoiceAlwaysOnEnabled, setVoicePermissionPrompted, showThought, voice]);

  const disableVoiceFirst = useCallback(() => {
    shouldResumeRef.current = false;
    setVoiceAlwaysOnEnabled(false);
    clearSilenceTimer();
    clearRestartTimer();
    voice.cancel();
    voice.stopSpeaking();
    showThought('Микрофон выключен.', 'neutral');
  }, [clearRestartTimer, clearSilenceTimer, setVoiceAlwaysOnEnabled, showThought, voice]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    isProcessingRef.current = isProcessingVoice;
  }, [isProcessingVoice]);

  useEffect(() => {
    voiceStateRef.current = voice.state;
  }, [voice.state]);

  useEffect(() => {
    if (!isActive) {
      shouldResumeRef.current = false;
      clearSilenceTimer();
      clearRestartTimer();
      return;
    }

    shouldResumeRef.current = true;

    if (voice.state === 'idle' && !isProcessingVoice) {
      resumeListeningSoon(RESUME_DELAY_MS);
    }

    return clearRestartTimer;
  }, [clearRestartTimer, clearSilenceTimer, isActive, isProcessingVoice, resumeListeningSoon, voice.state]);

  useEffect(() => {
    if (!isActive || voice.state !== 'recording') return;

    const transcript = voice.transcript.trim();
    if (!transcript) return;

    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      stopListening();
    }, SILENCE_SUBMIT_MS);

    return clearSilenceTimer;
  }, [clearSilenceTimer, isActive, stopListening, voice.state, voice.transcript]);

  useEffect(() => {
    if (!voice.error) return;

    if (voice.error === 'no-speech') {
      showThought('Я рядом.', 'neutral', 1200);
      resumeListeningSoon(650);
      return;
    }

    showThought('Голос не прошёл. Можно повторить или написать текстом.', 'warning');
    resumeListeningSoon(900);
  }, [resumeListeningSoon, showThought, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    if (lastMessage.kind === 'preview') {
      showThought('Проверь действие.', 'warning');
      resumeListeningSoon(850);
      return;
    }

    if (lastMessage.kind === 'error') {
      showThought(lastMessage.text || 'Нужно уточнение.', 'warning');
      resumeListeningSoon(850);
      return;
    }

    const text = lastMessage.text || 'Готово.';
    showThought(text, 'success');

    if (voiceRepliesEnabled && lastMessage.text) {
      voice.speak(lastMessage.text, { maxDurationMs: 1800 });
      resumeListeningSoon(1900);
      return;
    }

    resumeListeningSoon(900);
  }, [chat.messages, resumeListeningSoon, showThought, voice, voiceRepliesEnabled]);

  useEffect(() => () => {
    clearSilenceTimer();
    clearRestartTimer();
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
  }, [clearRestartTimer, clearSilenceTimer]);

  const mood = useMemo<CompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (voice.state === 'recording') return 'listening';
    if (voice.state === 'uploading' || chat.isSending || isProcessingVoice) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [chat.isSending, chat.pendingActions.length, isProcessingVoice, thought?.tone, voice.state]);

  const needsIntro = canUseVoiceFirst && !voicePermissionPrompted;
  const showLayer = currentScreen !== 'ai-core';

  if (!showLayer) return null;

  return (
    <>
      {needsIntro ? (
        <div className="voice-first-intro" data-no-swipe="true">
          <div className="voice-first-intro__card">
            <div className="voice-first-intro__title">Голосовое управление</div>
            <p>Можно говорить: “кофе 300”, “создай цель отпуск 120000”, “сделай карту основной”.</p>
            <div className="voice-first-intro__actions">
              <button type="button" onClick={enableVoiceFirst} disabled={isPriming}>{isPriming ? 'Включаю...' : 'Включить голос'}</button>
              <button type="button" onClick={() => setVoicePermissionPrompted(true)}>Позже</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="voice-first-companion" data-no-swipe="true">
        {thought ? (
          <div key={thought.id} className={`voice-first-bubble voice-first-bubble--${thought.tone}`}>
            {thought.text}
          </div>
        ) : null}

        <div className="voice-first-companion__controls">
          <div className="voice-first-companion__voice-panel">
            <div className={isActive ? 'voice-first-status voice-first-status--on' : 'voice-first-status'}>
              {isActive
                ? voice.state === 'recording'
                  ? 'Слушаю'
                  : chat.isSending || isProcessingVoice
                    ? 'Думаю'
                    : 'Голос включён'
                : 'Микрофон выключен'}
            </div>

            {isActive ? (
              <button type="button" className="voice-first-mic-toggle voice-first-mic-toggle--off" onClick={disableVoiceFirst}>
                Выключить микрофон
              </button>
            ) : voicePermissionPrompted ? (
              <button type="button" className="voice-first-mic-toggle" onClick={enableVoiceFirst} disabled={!canUseVoiceFirst || isPriming}>
                {isPriming ? 'Включаю...' : 'Включить микрофон'}
              </button>
            ) : null}
          </div>

          <CompanionButton
            mood={mood}
            size="md"
            label="Открыть AI"
            onClick={() => {
              telegramHaptic('light');
              openAIWithCommand();
            }}
          />
        </div>
      </div>
    </>
  );
}

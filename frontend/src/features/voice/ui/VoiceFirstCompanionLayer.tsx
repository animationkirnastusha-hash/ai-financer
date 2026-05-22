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

const SILENCE_SUBMIT_MS = 950;
const RESUME_DELAY_MS = 520;
const BUBBLE_TIMEOUT_MS = 4200;
const DUPLICATE_WINDOW_MS = 800;
const DEFAULT_ACTIVE_WINDOW_SECONDS = 16;

function compactBubble(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。！？])\s+/)
    .slice(0, 2)
    .join(' ')
    .slice(0, 150);
}

function normalizeForWake(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["'«».,!?;:()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripWakeWord(rawText: string, companionName: string) {
  const source = rawText.trim();
  const name = normalizeForWake(companionName || 'Фина');
  const normalized = normalizeForWake(source);

  if (!name) return { hasWakeWord: false, command: source };

  const aliases = Array.from(new Set([
    companionName,
    name,
    'Фина',
    'Финна',
    'Финанс',
    'помощник',
    'ассистент',
  ].map((value) => value.trim()).filter(Boolean)));

  const matchedAlias = aliases.find((alias) => {
    const aliasNormalized = normalizeForWake(alias);
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(aliasNormalized)}(\\s|$)`, 'i');
    return pattern.test(normalized);
  });

  if (!matchedAlias) return { hasWakeWord: false, command: source };

  const rawPattern = new RegExp(
    `^\\s*(?:эй|окей|ок|слушай)?\\s*${escapeRegExp(matchedAlias)}[\\s,.:;!\\-—]*`,
    'i',
  );

  if (rawPattern.test(source)) {
    return {
      hasWakeWord: true,
      command: source.replace(rawPattern, '').trim(),
    };
  }

  return { hasWakeWord: true, command: source };
}

export function VoiceFirstCompanionLayer() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);

  const chat = useChatController();

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceRepliesEnabled = useSettingsStore((state) => state.voiceRepliesEnabled);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const voiceWakeWordEnabled = useSettingsStore((state) => state.voiceWakeWordEnabled);
  const voiceActiveWindowSeconds = useSettingsStore((state) => state.voiceActiveWindowSeconds);
  const companionName = useSettingsStore((state) => state.companionName);
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setCompanionName = useSettingsStore((state) => state.setCompanionName);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

  const [thought, setThought] = useState<Thought | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isPriming, setIsPriming] = useState(false);
  const [draftName, setDraftName] = useState(companionName || 'Фина');
  const [activeUntil, setActiveUntil] = useState(0);

  const silenceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const lastStartAtRef = useRef(0);
  const shouldResumeRef = useRef(false);
  const isProcessingVoiceRef = useRef(false);
  const isActiveRef = useRef(false);
  const activeUntilRef = useRef(0);
  const lastHandledRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const handleTextRef = useRef<(text: string) => Promise<void> | void>(() => undefined);
  const resumeAttemptsRef = useRef(0);

  const activeWindowMs = Math.max(6000, Math.min(45000, (voiceActiveWindowSeconds || DEFAULT_ACTIVE_WINDOW_SECONDS) * 1000));
  const isCombatActive = !voiceWakeWordEnabled || activeUntil > Date.now();

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

  const armCombatMode = useCallback((durationMs = activeWindowMs) => {
    const until = Date.now() + durationMs;
    activeUntilRef.current = until;
    setActiveUntil(until);
  }, [activeWindowMs]);

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

  const voice = useVoiceInput({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    onText: (text) => handleTextRef.current(text),
  });

  const canUseVoiceFirst = voiceEnabled && voiceBetaEnabled && voice.isSupported && voice.mode === 'speech';
  const isActive = canUseVoiceFirst && voiceAlwaysOnEnabled && voicePermissionPrompted;

  const startListening = useCallback(async () => {
    if (!canUseVoiceFirst || isProcessingVoiceRef.current) return;
    if (voice.state === 'recording' || voice.state === 'uploading' || voice.state === 'speaking') return;

    const now = Date.now();
    if (now - lastStartAtRef.current < 320) return;
    lastStartAtRef.current = now;

    if (voice.state === 'error') voice.reset();

    const result = await voice.start();
    if (result === 'started') {
      shouldResumeRef.current = true;
      resumeAttemptsRef.current = 0;
      if (voiceWakeWordEnabled && activeUntilRef.current <= Date.now()) {
        showThought(`Скажи “${companionName || 'Фина'}”, и я начну слушать задачу.`, 'neutral', 2200);
      } else {
        showThought('Слушаю задачу.', 'listening', 1500);
      }
    }

    if (result === 'error') {
      shouldResumeRef.current = false;
      showThought('Микрофон недоступен. Можно написать команду текстом.', 'warning');
    }
  }, [canUseVoiceFirst, companionName, showThought, voice, voiceWakeWordEnabled]);

  const resumeListeningSoon = useCallback((delayMs = RESUME_DELAY_MS) => {
    clearRestartTimer();

    restartTimerRef.current = window.setTimeout(() => {
      if (!shouldResumeRef.current || !isActiveRef.current) return;

      const shouldWait = isProcessingVoiceRef.current
        || voice.state === 'uploading'
        || voice.state === 'speaking';

      if (shouldWait) {
        resumeAttemptsRef.current += 1;
        const nextDelay = Math.min(1400, 360 + resumeAttemptsRef.current * 180);
        resumeListeningSoon(nextDelay);
        return;
      }

      resumeAttemptsRef.current = 0;
      void startListening();
    }, delayMs);
  }, [clearRestartTimer, startListening, voice.state]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (voice.state === 'recording') voice.stop();
  }, [clearSilenceTimer, voice]);

  const handleText = useCallback(async (rawText: string) => {
    const originalText = rawText.trim();
    if (!originalText || isProcessingVoiceRef.current) return;

    const wake = stripWakeWord(originalText, companionName || 'Фина');
    const now = Date.now();
    const isWithinCombatWindow = !voiceWakeWordEnabled || activeUntilRef.current > now;

    if (voiceWakeWordEnabled && !isWithinCombatWindow) {
      if (!wake.hasWakeWord) {
        resumeListeningSoon(120);
        return;
      }

      armCombatMode();

      if (!wake.command) {
        showThought('Слушаю. Скажи задачу.', 'listening', 2500);
        resumeListeningSoon(220);
        return;
      }
    }

    const text = (wake.hasWakeWord ? wake.command : originalText).trim();
    if (!text) {
      resumeListeningSoon(180);
      return;
    }

    armCombatMode();

    const last = lastHandledRef.current;
    if (last.text === text && now - last.at < DUPLICATE_WINDOW_MS) {
      resumeListeningSoon(180);
      return;
    }
    lastHandledRef.current = { text, at: now };

    isProcessingVoiceRef.current = true;
    setIsProcessingVoice(true);
    clearSilenceTimer();
    showThought('Думаю...', 'thinking', 2000);

    try {
      const navigationIntent = parseNavigationIntent(text);

      if (navigationIntent.type === 'open_screen') {
        telegramHaptic('light');
        navigateTo(navigationIntent.screen);
        showThought('Открываю.', 'success');
        armCombatMode(9000);
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        showThought('Вернулся назад.', 'success');
        armCombatMode(9000);
        return;
      }

      await chat.sendMessage(text);
      armCombatMode();
    } finally {
      isProcessingVoiceRef.current = false;
      setIsProcessingVoice(false);
      resumeListeningSoon(RESUME_DELAY_MS);
    }
  }, [armCombatMode, chat, clearSilenceTimer, companionName, goBack, navigateTo, resumeListeningSoon, showThought, voiceWakeWordEnabled]);

  useEffect(() => {
    handleTextRef.current = handleText;
  }, [handleText]);

  const enableVoiceFirst = useCallback(async () => {
    const nextName = draftName.trim() || 'Фина';
    setCompanionName(nextName);
    setIsPriming(true);
    setVoicePermissionPrompted(true);
    setVoiceAlwaysOnEnabled(true);
    shouldResumeRef.current = true;

    try {
      const result = await voice.start();
      if (result === 'started') {
        showThought(`Голос включён. Скажи “${nextName}”, затем команду.`, 'success', 3600);
      } else {
        showThought('Разрешение сохранено. Если микрофон не включился, проверь доступ в Telegram.', 'warning');
        resumeListeningSoon(700);
      }
    } finally {
      setIsPriming(false);
    }
  }, [draftName, resumeListeningSoon, setCompanionName, setVoiceAlwaysOnEnabled, setVoicePermissionPrompted, showThought, voice]);

  const disableVoiceFirst = useCallback(() => {
    shouldResumeRef.current = false;
    activeUntilRef.current = 0;
    setActiveUntil(0);
    setVoiceAlwaysOnEnabled(false);
    clearSilenceTimer();
    clearRestartTimer();
    voice.cancel();
    voice.stopSpeaking();
    showThought('Микрофон выключен.', 'neutral');
  }, [clearRestartTimer, clearSilenceTimer, setVoiceAlwaysOnEnabled, showThought, voice]);

  useEffect(() => {
    isProcessingVoiceRef.current = isProcessingVoice;
  }, [isProcessingVoice]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    activeUntilRef.current = activeUntil;
  }, [activeUntil]);

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
      resumeListeningSoon(240);
      return;
    }

    showThought('Голос не прошёл. Можно повторить или написать текстом.', 'warning');
    resumeListeningSoon(1000);
  }, [resumeListeningSoon, showThought, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    if (lastMessage.kind === 'preview') {
      armCombatMode(18000);
      showThought('Проверь действие. Я ещё слушаю.', 'warning');
      resumeListeningSoon(900);
      return;
    }

    if (lastMessage.kind === 'error') {
      armCombatMode(18000);
      showThought(lastMessage.text || 'Нужно уточнение. Ответь коротко.', 'warning');
      resumeListeningSoon(900);
      return;
    }

    armCombatMode(11000);
    showThought(lastMessage.text || 'Готово.', 'success');

    if (voiceRepliesEnabled && lastMessage.text) {
      voice.speak(lastMessage.text, { maxDurationMs: 2600 });
      resumeListeningSoon(2800);
      return;
    }

    resumeListeningSoon(750);
  }, [armCombatMode, chat.messages, resumeListeningSoon, showThought, voice, voiceRepliesEnabled]);

  useEffect(() => () => {
    clearSilenceTimer();
    clearRestartTimer();
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
  }, [clearRestartTimer, clearSilenceTimer]);

  const mood = useMemo<CompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (voice.state === 'recording' && isCombatActive) return 'listening';
    if (voice.state === 'uploading' || voice.state === 'speaking' || chat.isSending || isProcessingVoice) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [chat.isSending, chat.pendingActions.length, isCombatActive, isProcessingVoice, thought?.tone, voice.state]);

  const needsIntro = canUseVoiceFirst && !voicePermissionPrompted;
  const showLayer = currentScreen !== 'ai-core';
  const displayName = companionName || 'Фина';

  if (!showLayer) return null;

  return (
    <>
      {needsIntro ? (
        <div className="voice-first-intro" data-no-swipe="true">
          <div className="voice-first-intro__card">
            <div className="voice-first-intro__title">Голосовое управление</div>
            <p>
              Микрофон может быть включён, но боевой режим начнётся только после имени помощника.
              По умолчанию: “Фина”.
            </p>

            <label className="voice-first-intro__field">
              <span>Имя помощника</span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Фина"
                maxLength={24}
              />
            </label>

            <div className="voice-first-intro__hint">
              Пример: “{draftName.trim() || 'Фина'}, кофе 300” или “{draftName.trim() || 'Фина'}, создай цель отпуск 120000”.
            </div>

            <div className="voice-first-intro__actions">
              <button type="button" onClick={enableVoiceFirst} disabled={isPriming}>{isPriming ? 'Включаю...' : 'Включить голос'}</button>
              <button
                type="button"
                onClick={() => {
                  setCompanionName(draftName.trim() || 'Фина');
                  setVoicePermissionPrompted(true);
                }}
              >
                Позже
              </button>
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
                  ? isCombatActive
                    ? 'Слушаю задачу'
                    : `Жду “${displayName}”`
                  : chat.isSending || isProcessingVoice || voice.state === 'speaking'
                    ? 'Думаю'
                    : voiceWakeWordEnabled
                      ? `Скажи “${displayName}”`
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
            label="Открыть помощника"
            onClick={() => {
              telegramHaptic('light');
              navigateTo('companion');
            }}
          />
        </div>
      </div>
    </>
  );
}

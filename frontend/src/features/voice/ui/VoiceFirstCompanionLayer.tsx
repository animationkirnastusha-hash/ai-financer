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

const SILENCE_SUBMIT_MS = 880;
const RESUME_DELAY_MS = 420;
const WATCHDOG_INTERVAL_MS = 1350;
const BUBBLE_TIMEOUT_MS = 2800;
const DUPLICATE_WINDOW_MS = 850;
const DEFAULT_ACTIVE_WINDOW_SECONDS = 7;
const FIXED_COMPANION_NAME = 'Фина';

function compactBubble(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。！？])\s+/)
    .slice(0, 2)
    .join(' ')
    .slice(0, 118);
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


function cleanVoiceText(text: string) {
  return text
    .replace(/[\u00A0\t\r\n]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?]){2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDecision(text: string) {
  return normalizeForWake(text);
}

function isVoiceConfirm(text: string) {
  const value = normalizeDecision(text);
  return ['да', 'ага', 'угу', 'подтверди', 'подтверждаю', 'выполняй', 'сделай', 'ок', 'окей', 'yes', 'confirm'].includes(value);
}

function isVoiceCancel(text: string) {
  const value = normalizeDecision(text);
  return ['нет', 'не надо', 'отмена', 'отмени', 'отменить', 'cancel', 'no'].includes(value);
}

function pendingHasClarification(pending: unknown) {
  if (!pending || typeof pending !== 'object') return false;
  const parsed = (pending as { parsed?: unknown }).parsed;
  return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as { clarification?: unknown }).clarification);
}

function stripWakeWord(rawText: string) {
  const source = rawText.trim();
  const name = normalizeForWake(FIXED_COMPANION_NAME);
  const normalized = normalizeForWake(source);

  if (!name) return { hasWakeWord: false, command: source };

  const aliases = Array.from(new Set([
    FIXED_COMPANION_NAME,
    name,
    'Фина',
    'Финна',
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
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

  const [thought, setThought] = useState<Thought | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isPriming, setIsPriming] = useState(false);
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
  const startListeningRef = useRef<() => Promise<void> | void>(() => undefined);
  const lastWatchdogKickRef = useRef(0);
  const lastAssistantMessageKeyRef = useRef('');
  const lastWakeAcceptedAtRef = useRef(0);
  const lastThoughtRef = useRef<{ text: string; tone: BubbleTone; at: number }>({ text: '', tone: 'neutral', at: 0 });

  const activeWindowMs = Math.max(2000, Math.min(120000, (voiceActiveWindowSeconds || DEFAULT_ACTIVE_WINDOW_SECONDS) * 1000));
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

    const now = Date.now();
    const lastThought = lastThoughtRef.current;
    if (lastThought.text === cleanText && lastThought.tone === tone && now - lastThought.at < 1400) return;
    lastThoughtRef.current = { text: cleanText, tone, at: now };

    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
    }

    setThought({ id: `${tone}-${now}`, text: cleanText, tone });

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

  const resumeListeningSoon = useCallback((delayMs = RESUME_DELAY_MS) => {
    clearRestartTimer();

    restartTimerRef.current = window.setTimeout(() => {
      if (!shouldResumeRef.current || !isActiveRef.current) return;
      void startListeningRef.current?.();
    }, delayMs);
  }, [clearRestartTimer]);

  const startListening = useCallback(async () => {
    if (!canUseVoiceFirst) return;

    if (isProcessingVoiceRef.current || voice.state === 'uploading' || voice.state === 'speaking') {
      if (shouldResumeRef.current && isActiveRef.current) resumeListeningSoon(260);
      return;
    }

    if (voice.state === 'recording') return;

    const now = Date.now();
    if (now - lastStartAtRef.current < 260) {
      if (shouldResumeRef.current && isActiveRef.current) resumeListeningSoon(260);
      return;
    }
    lastStartAtRef.current = now;

    if (voice.state === 'error') voice.reset();

    const result = await voice.start();
    if (result === 'started') {
      shouldResumeRef.current = true;
      const hasCombatWindow = activeUntilRef.current > Date.now() || Date.now() - lastWakeAcceptedAtRef.current < activeWindowMs;

      if (hasCombatWindow) {
        showThought('Слушаю задачу.', 'listening', 900);
      }
      return;
    }

    if (result === 'permission-ready') {
      shouldResumeRef.current = true;
      resumeListeningSoon(520);
      return;
    }

    if (result === 'error') {
      shouldResumeRef.current = false;
      showThought('Микрофон недоступен. Можно написать команду текстом.', 'warning');
    }
  }, [canUseVoiceFirst, resumeListeningSoon, showThought, voice, voiceWakeWordEnabled]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (voice.state === 'recording') voice.stop();
  }, [clearSilenceTimer, voice]);

  const handleText = useCallback(async (rawText: string) => {
    const originalText = cleanVoiceText(rawText);
    if (!originalText || isProcessingVoiceRef.current) return;

    const wake = stripWakeWord(originalText);
    const now = Date.now();
    const isWithinCombatWindow = activeUntilRef.current > now;

    if (!isWithinCombatWindow) {
      if (!wake.hasWakeWord) {
        resumeListeningSoon(480);
        return;
      }

      lastWakeAcceptedAtRef.current = now;
      armCombatMode();

      if (!wake.command) {
        armCombatMode(Math.max(activeWindowMs, 10000));
        showThought('Я слушаю. Скажи задачу без имени.', 'listening', 2200);
        resumeListeningSoon(260);
        return;
      }
    }

    if (wake.hasWakeWord) lastWakeAcceptedAtRef.current = now;

    const text = cleanVoiceText(wake.hasWakeWord ? wake.command : originalText);
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

    setIsProcessingVoice(true);
    clearSilenceTimer();
    showThought('Думаю...', 'thinking', 1500);

    try {
      const navigationIntent = parseNavigationIntent(text);

      if (navigationIntent.type === 'open_screen') {
        telegramHaptic('light');
        navigateTo(navigationIntent.screen);
        showThought('Открываю.', 'success');
        armCombatMode(activeWindowMs);
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        showThought('Вернулся назад.', 'success');
        armCombatMode(activeWindowMs);
        return;
      }

      const latestPending = chat.pendingActions[0];
      if (latestPending?.id && isVoiceCancel(text)) {
        await chat.cancelAction(latestPending.id);
        showThought('Отменил действие.', 'success', 1800);
        armCombatMode(activeWindowMs);
        return;
      }

      if (latestPending?.id && !pendingHasClarification(latestPending) && isVoiceConfirm(text)) {
        await chat.confirmAction(latestPending.id);
        showThought('Подтвердил.', 'success', 1800);
        armCombatMode(activeWindowMs);
        return;
      }

      await chat.sendMessage(text);
      armCombatMode();
    } finally {
      setIsProcessingVoice(false);
      resumeListeningSoon(RESUME_DELAY_MS);
    }
  }, [activeWindowMs, armCombatMode, chat, clearSilenceTimer, goBack, navigateTo, resumeListeningSoon, showThought, voiceWakeWordEnabled]);

  useEffect(() => {
    handleTextRef.current = handleText;
  }, [handleText]);

  const enableVoiceFirst = useCallback(async () => {
    setIsPriming(true);
    setVoicePermissionPrompted(true);
    setVoiceAlwaysOnEnabled(true);
    shouldResumeRef.current = true;

    try {
      const result = await voice.start();
      if (result === 'started') {
        showThought('Голос включён. Скажи “Фина”, затем команду.', 'success', 3600);
      } else {
        showThought('Разрешение сохранено. Если микрофон не включился, проверь доступ в Telegram.', 'warning');
        resumeListeningSoon(700);
      }
    } finally {
      setIsPriming(false);
    }
  }, [resumeListeningSoon, setVoiceAlwaysOnEnabled, setVoicePermissionPrompted, showThought, voice]);

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

    const silentErrors = ['no-speech', 'aborted', 'speech-restart', 'audio-capture'];
    if (silentErrors.includes(voice.error)) {
      resumeListeningSoon(520);
      return;
    }

    if (voice.error === 'not-allowed' || voice.error === 'service-not-allowed') {
      showThought('Нужен доступ к микрофону.', 'warning');
      return;
    }

    resumeListeningSoon(1200);
  }, [resumeListeningSoon, showThought, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    if (lastMessage.kind === 'preview') {
      armCombatMode(Math.max(activeWindowMs, 12000));
      voice.stopSpeaking();
      showThought('Проверь действие. Ответь: “подтверди”, “отмени” или скажи, что изменить: сумму, счёт, категорию, дату.', 'warning', 5200);
      resumeListeningSoon(420);
      return;
    }

    if (lastMessage.kind === 'error') {
      armCombatMode(Math.max(activeWindowMs, 12000));
      voice.stopSpeaking();
      showThought(lastMessage.text || 'Нужно уточнение. Ответь коротко или скажи “отмени”.', 'warning', 5000);
      resumeListeningSoon(420);
      return;
    }

    armCombatMode(activeWindowMs);
    showThought(lastMessage.text || 'Готово. Ещё несколько секунд можно говорить без “Фина”.', 'success', 2200);

    if (voiceRepliesEnabled && lastMessage.text && chat.pendingActions.length === 0) {
      voice.speak(lastMessage.text, { maxDurationMs: 900 });
      resumeListeningSoon(1050);
      return;
    }

    resumeListeningSoon(360);
  }, [activeWindowMs, armCombatMode, chat.messages, chat.pendingActions.length, resumeListeningSoon, showThought, voice, voiceRepliesEnabled]);


  useEffect(() => {
    if (!isActive) return undefined;

    const tick = window.setInterval(() => {
      if (!shouldResumeRef.current || !isActiveRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isProcessingVoiceRef.current || chat.isSending) return;
      if (voice.state === 'recording' || voice.state === 'uploading' || voice.state === 'speaking') return;

      const now = Date.now();
      if (now - lastWatchdogKickRef.current < WATCHDOG_INTERVAL_MS - 80) return;
      lastWatchdogKickRef.current = now;
      void startListeningRef.current?.();
    }, WATCHDOG_INTERVAL_MS);

    return () => window.clearInterval(tick);
  }, [chat.isSending, isActive, voice.state]);

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
  const displayName = FIXED_COMPANION_NAME;

  if (!showLayer) return null;

  return (
    <>
      {needsIntro ? (
        <div className="voice-first-intro" data-no-swipe="true">
          <div className="voice-first-intro__card voice-first-intro__card--polished">
            <div className="voice-first-intro__avatar" aria-hidden="true">
              <CompanionButton mood="idle" size="md" label="Фина" />
            </div>
            <div className="voice-first-intro__eyebrow">Знакомься</div>
            <div className="voice-first-intro__title">Это Фина</div>
            <p>
              Она слушает финансовые команды голосом, готовит действие и просит подтверждение,
              если операция влияет на деньги.
            </p>

            <div className="voice-first-intro__steps">
              <div><b>1</b><span>Скажи “Фина”</span></div>
              <div><b>2</b><span>Назови задачу обычным языком</span></div>
              <div><b>3</b><span>Подтверди, отмени или уточни</span></div>
            </div>

            <div className="voice-first-intro__hint">
              Говори обычным языком: запись траты, доход, перевод, цель, вопрос по расходам. Фина подготовит действие и покажет подтверждение.
            </div>

            <div className="voice-first-intro__actions">
              <button type="button" onClick={enableVoiceFirst} disabled={isPriming}>{isPriming ? 'Включаю...' : 'Познакомиться с Финой'}</button>
              <button type="button" onClick={() => setVoicePermissionPrompted(true)}>Позже</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="voice-first-companion" data-no-swipe="true">
        {thought ? (
          <div className={`voice-first-bubble voice-first-bubble--${thought.tone}`}>
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

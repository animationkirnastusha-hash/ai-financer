import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { PendingActionCard } from '@/features/pending-actions/ui/PendingActionCard';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { telegramHaptic } from '@/shared/lib/telegram';

type CompanionMood = 'idle' | 'listening' | 'thinking' | 'confirm' | 'success' | 'warning';
type BubbleTone = 'neutral' | 'listening' | 'thinking' | 'success' | 'warning';
type VoicePhase = 'off' | 'passive' | 'armed' | 'processing' | 'confirm';

type Thought = {
  id: string;
  text: string;
  tone: BubbleTone;
};

const FIXED_COMPANION_NAME = 'Фина';
const PASSIVE_RESTART_MS = 1050;
const AFTER_COMMAND_RESTART_MS = 1250;
const WATCHDOG_MS = 3200;
const WAKE_SUBMIT_MS = 760;
const ACTIVE_SUBMIT_MS = 980;
const BUBBLE_TIMEOUT_MS = 2800;
const DUPLICATE_WINDOW_MS = 1200;
const DEFAULT_ACTIVE_WINDOW_SECONDS = 7;

function compactBubble(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?。！？])\s+/)
    .slice(0, 2)
    .join(' ')
    .slice(0, 120);
}

function normalizeVoiceText(text: string) {
  return text
    .replace(/[\u00A0\t\r\n]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?]){2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForWake(text: string) {
  return normalizeVoiceText(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["'«».,!?;:()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isVoiceConfirm(text: string) {
  const value = normalizeForWake(text);
  return ['да', 'ага', 'угу', 'подтверди', 'подтверждаю', 'выполняй', 'сделай', 'ок', 'окей', 'yes', 'confirm'].includes(value);
}

function isVoiceCancel(text: string) {
  const value = normalizeForWake(text);
  return ['нет', 'не надо', 'отмена', 'отмени', 'отменить', 'cancel', 'no'].includes(value);
}

function stripWakeWord(rawText: string) {
  const source = normalizeVoiceText(rawText);
  const normalized = normalizeForWake(source);
  const aliases = ['фина', 'финна'];

  const matchedAlias = aliases.find((alias) => {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(alias)}(\\s|$)`, 'i');
    return pattern.test(normalized);
  });

  if (!matchedAlias) return { hasWakeWord: false, command: source };

  const rawAliases = ['Фина', 'Финна', 'фина', 'финна'];
  const rawAlias = rawAliases.find((alias) => new RegExp(`(^|\\s)${escapeRegExp(alias)}(\\s|$)`, 'i').test(source)) || matchedAlias;
  const rawPattern = new RegExp(
    `^\\s*(?:эй|окей|ок|слушай)?\\s*${escapeRegExp(rawAlias)}[\\s,.:;!\\-—]*`,
    'i',
  );

  if (rawPattern.test(source)) {
    return {
      hasWakeWord: true,
      command: normalizeVoiceText(source.replace(rawPattern, '')),
    };
  }

  return { hasWakeWord: true, command: source };
}

function isWakeOnly(text: string) {
  const value = normalizeForWake(text);
  return value === 'фина' || value === 'финна';
}

function isClarificationPending(item: any) {
  const parsed = item?.parsed && typeof item.parsed === 'object' ? item.parsed : item?.payload;
  return Boolean(parsed && typeof parsed === 'object' && parsed.clarification);
}

export function VoiceFirstCompanionLayer() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const goBack = useNavigationStore((state) => state.goBack);
  const chat = useChatController();

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
  const voiceActiveWindowSeconds = useSettingsStore((state) => state.voiceActiveWindowSeconds);
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

  const [thought, setThought] = useState<Thought | null>(null);
  const [isPriming, setIsPriming] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('off');
  const [activeUntil, setActiveUntil] = useState(0);

  const thoughtTimerRef = useRef<number | null>(null);
  const submitTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const activeUntilRef = useRef(0);
  const voicePhaseRef = useRef<VoicePhase>('off');
  const shouldRunRef = useRef(false);
  const mountedRef = useRef(true);
  const handleTextRef = useRef<(text: string) => Promise<void> | void>(() => undefined);
  const lastHandledRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const lastAssistantMessageKeyRef = useRef('');
  const lastThoughtRef = useRef<{ text: string; tone: BubbleTone; at: number }>({ text: '', tone: 'neutral', at: 0 });

  const activeWindowMs = Math.max(3000, Math.min(120000, (voiceActiveWindowSeconds || DEFAULT_ACTIVE_WINDOW_SECONDS) * 1000));

  const voice = useVoiceInput({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    onText: (text) => handleTextRef.current(text),
  });

  const canUseVoiceFirst = voiceEnabled && voiceBetaEnabled && voice.isSupported && voice.mode === 'speech';
  const isActive = canUseVoiceFirst && voiceAlwaysOnEnabled && voicePermissionPrompted;
  const confirmationPendingActions = chat.pendingActions.filter((item) => !isClarificationPending(item));

  const clearSubmitTimer = useCallback(() => {
    if (submitTimerRef.current !== null) {
      window.clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const clearWatchdogTimer = useCallback(() => {
    if (watchdogTimerRef.current !== null) {
      window.clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const setPhase = useCallback((next: VoicePhase) => {
    voicePhaseRef.current = next;
    setVoicePhase(next);
  }, []);

  const showThought = useCallback((text: string, tone: BubbleTone = 'neutral', timeoutMs = BUBBLE_TIMEOUT_MS) => {
    const cleanText = compactBubble(text);
    if (!cleanText) return;

    const now = Date.now();
    const last = lastThoughtRef.current;
    if (last.text === cleanText && last.tone === tone && now - last.at < 1600) return;
    lastThoughtRef.current = { text: cleanText, tone, at: now };

    if (thoughtTimerRef.current !== null) window.clearTimeout(thoughtTimerRef.current);
    setThought({ id: `${tone}-${now}`, text: cleanText, tone });
    thoughtTimerRef.current = window.setTimeout(() => {
      setThought(null);
      thoughtTimerRef.current = null;
    }, timeoutMs);
  }, []);

  const hardStopSpeech = useCallback(() => {
    clearSubmitTimer();
    voice.cancel();
  }, [clearSubmitTimer, voice]);

  const scheduleListen = useCallback((delayMs = PASSIVE_RESTART_MS) => {
    clearRestartTimer();
    if (!shouldRunRef.current) return;

    restartTimerRef.current = window.setTimeout(async () => {
      restartTimerRef.current = null;
      if (!mountedRef.current || !shouldRunRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (voicePhaseRef.current === 'processing') return scheduleListen(900);
      if (voice.state === 'recording' || voice.state === 'uploading' || voice.state === 'speaking') return;

      const result = await voice.start();
      if (result === 'started') return;
      if (result === 'permission-ready') return scheduleListen(900);
      if (result === 'error') {
        setPhase('off');
        showThought('Микрофон недоступен. Проверь доступ в Telegram.', 'warning', 4200);
      }
    }, delayMs);
  }, [clearRestartTimer, setPhase, showThought, voice]);

  const armActiveWindow = useCallback((durationMs = activeWindowMs) => {
    const until = Date.now() + durationMs;
    activeUntilRef.current = until;
    setActiveUntil(until);
    setPhase('armed');
  }, [activeWindowMs, setPhase]);

  const closeActiveWindow = useCallback(() => {
    activeUntilRef.current = 0;
    setActiveUntil(0);
    setPhase(shouldRunRef.current ? 'passive' : 'off');
  }, [setPhase]);

  const finishProcessing = useCallback((delayMs = AFTER_COMMAND_RESTART_MS) => {
    closeActiveWindow();
    hardStopSpeech();
    scheduleListen(delayMs);
  }, [closeActiveWindow, hardStopSpeech, scheduleListen]);

  const processCommand = useCallback(async (text: string) => {
    const command = normalizeVoiceText(text);
    if (!command) {
      finishProcessing(500);
      return;
    }

    const now = Date.now();
    const last = lastHandledRef.current;
    if (last.text === command && now - last.at < DUPLICATE_WINDOW_MS) {
      finishProcessing(500);
      return;
    }
    lastHandledRef.current = { text: command, at: now };

    setPhase('processing');
    showThought('Думаю...', 'thinking', 1600);

    try {
      const latestPending = confirmationPendingActions[0];
      if (latestPending && isVoiceConfirm(command)) {
        await chat.confirmAction(latestPending.id);
        showThought('Подтвердил.', 'success', 1600);
        return;
      }

      if (latestPending && isVoiceCancel(command)) {
        await chat.cancelAction(latestPending.id);
        showThought('Отменил.', 'neutral', 1600);
        return;
      }

      const navigationIntent = parseNavigationIntent(command);
      if (navigationIntent.type === 'open_screen') {
        telegramHaptic('light');
        navigateTo(navigationIntent.screen);
        showThought('Открываю.', 'success', 1400);
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        showThought('Вернулся назад.', 'success', 1400);
        return;
      }

      await chat.sendMessage(command);
    } finally {
      finishProcessing(AFTER_COMMAND_RESTART_MS);
    }
  }, [chat, confirmationPendingActions, finishProcessing, goBack, navigateTo, setPhase, showThought]);

  const handleText = useCallback(async (rawText: string) => {
    const originalText = normalizeVoiceText(rawText);
    if (!originalText || voicePhaseRef.current === 'processing') {
      scheduleListen(600);
      return;
    }

    const now = Date.now();
    const withinActiveWindow = activeUntilRef.current > now;
    const wake = stripWakeWord(originalText);

    if (!withinActiveWindow && !wake.hasWakeWord) {
      // Passive mode: random speech is ignored completely.
      scheduleListen(650);
      return;
    }

    if (!withinActiveWindow && wake.hasWakeWord) {
      if (!wake.command || isWakeOnly(wake.command)) {
        armActiveWindow(Math.max(activeWindowMs, 10000));
        showThought('Слушаю. Скажи задачу.', 'listening', 2200);
        scheduleListen(360);
        return;
      }

      await processCommand(wake.command);
      return;
    }

    const command = normalizeVoiceText(wake.hasWakeWord ? wake.command : originalText);
    if (!command || isWakeOnly(command)) {
      armActiveWindow(Math.max(activeWindowMs, 10000));
      scheduleListen(360);
      return;
    }

    await processCommand(command);
  }, [activeWindowMs, armActiveWindow, processCommand, scheduleListen, showThought]);

  useEffect(() => {
    handleTextRef.current = handleText;
  }, [handleText]);

  const enableVoiceFirst = useCallback(async () => {
    setIsPriming(true);
    setVoicePermissionPrompted(true);
    setVoiceAlwaysOnEnabled(true);
    shouldRunRef.current = true;
    setPhase('passive');

    try {
      const result = await voice.start();
      if (result === 'started') {
        showThought('Голос включён. Скажи “Фина”.', 'success', 3200);
      } else {
        showThought('Разрешение сохранено. Проверь доступ к микрофону в Telegram.', 'warning', 4200);
        scheduleListen(900);
      }
    } finally {
      setIsPriming(false);
    }
  }, [scheduleListen, setPhase, setVoiceAlwaysOnEnabled, setVoicePermissionPrompted, showThought, voice]);

  const disableVoiceFirst = useCallback(() => {
    shouldRunRef.current = false;
    clearSubmitTimer();
    clearRestartTimer();
    clearWatchdogTimer();
    activeUntilRef.current = 0;
    setActiveUntil(0);
    setPhase('off');
    setVoiceAlwaysOnEnabled(false);
    voice.cancel();
    voice.stopSpeaking();
    showThought('Микрофон выключен.', 'neutral', 1600);
  }, [clearRestartTimer, clearSubmitTimer, clearWatchdogTimer, setPhase, setVoiceAlwaysOnEnabled, showThought, voice]);

  useEffect(() => {
    shouldRunRef.current = isActive;
    if (!isActive) {
      clearSubmitTimer();
      clearRestartTimer();
      clearWatchdogTimer();
      closeActiveWindow();
      voice.cancel();
      return;
    }

    if (voicePhaseRef.current === 'off') setPhase('passive');
    if (voice.state === 'idle') scheduleListen(400);
  }, [clearRestartTimer, clearSubmitTimer, clearWatchdogTimer, closeActiveWindow, isActive, scheduleListen, setPhase, voice]);

  useEffect(() => {
    if (!isActive || voice.state !== 'recording') return;

    const text = normalizeVoiceText(voice.transcript);
    if (!text) return;

    const wake = stripWakeWord(text);
    const withinActiveWindow = activeUntilRef.current > Date.now();

    if (!withinActiveWindow && !wake.hasWakeWord) return;

    clearSubmitTimer();
    submitTimerRef.current = window.setTimeout(() => {
      voice.stop();
    }, withinActiveWindow ? ACTIVE_SUBMIT_MS : WAKE_SUBMIT_MS);

    return clearSubmitTimer;
  }, [clearSubmitTimer, isActive, voice, voice.state, voice.transcript]);

  useEffect(() => {
    if (!isActive) return;
    if (!voice.error) return;

    const silentErrors = ['no-speech', 'aborted', 'speech-restart', 'audio-capture', 'network'];
    if (silentErrors.includes(voice.error)) {
      scheduleListen(900);
      return;
    }

    if (voice.error === 'not-allowed' || voice.error === 'service-not-allowed' || voice.error === 'microphone-denied') {
      showThought('Нужен доступ к микрофону.', 'warning', 4200);
      return;
    }

    scheduleListen(1600);
  }, [isActive, scheduleListen, showThought, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    if (lastMessage.kind === 'preview') {
      closeActiveWindow();
      showThought('Проверь действие в модалке.', 'warning', 3000);
      scheduleListen(900);
      return;
    }

    if (lastMessage.kind === 'error') {
      closeActiveWindow();
      showThought(lastMessage.text || 'Нужно уточнение.', 'warning', 4200);
      scheduleListen(900);
      return;
    }

    closeActiveWindow();
    showThought(lastMessage.text || 'Готово.', 'success', 1700);
    scheduleListen(900);
  }, [chat.messages, closeActiveWindow, scheduleListen, showThought]);

  useEffect(() => {
    if (!isActive) return undefined;

    clearWatchdogTimer();
    watchdogTimerRef.current = window.setInterval(() => {
      if (!shouldRunRef.current || !mountedRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (voicePhaseRef.current === 'processing') return;
      if (voice.state === 'recording' || voice.state === 'uploading' || voice.state === 'speaking') return;
      scheduleListen(100);
    }, WATCHDOG_MS);

    return clearWatchdogTimer;
  }, [clearWatchdogTimer, isActive, scheduleListen, voice.state]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        hardStopSpeech();
        return;
      }
      if (shouldRunRef.current) {
        hardStopSpeech();
        scheduleListen(700);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [hardStopSpeech, scheduleListen]);

  useEffect(() => () => {
    mountedRef.current = false;
    clearSubmitTimer();
    clearRestartTimer();
    clearWatchdogTimer();
    if (thoughtTimerRef.current !== null) window.clearTimeout(thoughtTimerRef.current);
  }, [clearRestartTimer, clearSubmitTimer, clearWatchdogTimer]);

  const mood = useMemo<CompanionMood>(() => {
    if (confirmationPendingActions.length > 0) return 'confirm';
    if (voicePhase === 'processing' || voice.state === 'uploading' || chat.isSending) return 'thinking';
    if (voice.state === 'recording' && (voicePhase === 'armed' || activeUntil > Date.now())) return 'listening';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [activeUntil, chat.isSending, confirmationPendingActions.length, thought?.tone, voice.state, voicePhase]);

  const needsIntro = canUseVoiceFirst && !voicePermissionPrompted;
  const showFloatingCompanion = currentScreen !== 'ai-core';
  const displayName = FIXED_COMPANION_NAME;

  if (!showFloatingCompanion && !needsIntro && confirmationPendingActions.length === 0) return null;

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
            <p>Она реагирует на имя, слушает задачу и показывает подтверждение, если действие требует проверки.</p>

            <div className="voice-first-intro__steps">
              <div><b>1</b><span>Скажи “Фина”</span></div>
              <div><b>2</b><span>Назови задачу обычным языком</span></div>
              <div><b>3</b><span>Подтверди, отмени или уточни</span></div>
            </div>

            <div className="voice-first-intro__hint">Без имени Фина не отправляет речь в обработку и не реагирует на случайные разговоры.</div>

            <div className="voice-first-intro__actions">
              <button type="button" onClick={enableVoiceFirst} disabled={isPriming}>{isPriming ? 'Включаю...' : 'Познакомиться с Финой'}</button>
              <button type="button" onClick={() => setVoicePermissionPrompted(true)}>Позже</button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmationPendingActions.length > 0 ? (
        <div className="app-modal-backdrop app-pending-confirm-backdrop" data-no-swipe="true">
          <div className="app-modal-sheet app-pending-confirm-sheet" data-no-swipe="true">
            <div className="app-modal-handle" />
            <div className="app-modal-body">
              <div className="app-pending-confirm-head">
                <div>
                  <div className="app-eyebrow">Проверка</div>
                  <h2>Фина ждёт подтверждения</h2>
                  <p>Можно подтвердить, отменить или изменить детали перед выполнением.</p>
                </div>
              </div>
              <div className="grid gap-3">
                {confirmationPendingActions.slice(0, 1).map((item) => (
                  <PendingActionCard
                    key={item.id}
                    item={item}
                    onConfirm={chat.confirmAction}
                    onCancel={chat.cancelAction}
                    onUpdate={chat.updatePendingAction}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showFloatingCompanion ? (
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
                  ? voicePhase === 'processing' || chat.isSending
                    ? 'Думаю'
                    : voice.state === 'recording'
                      ? voicePhase === 'armed'
                        ? 'Слушаю задачу'
                        : `Жду “${displayName}”`
                      : `Скажи “${displayName}”`
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
      ) : null}
    </>
  );
}

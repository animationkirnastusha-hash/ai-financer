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

type Thought = {
  id: string;
  text: string;
  tone: BubbleTone;
};

const SILENCE_SUBMIT_MS = 980;
const RESUME_DELAY_MS = 850;
const WATCHDOG_INTERVAL_MS = 2200;
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

function isWakeOnlyCommand(text: string) {
  const value = normalizeDecision(text);
  return value === normalizeForWake(FIXED_COMPANION_NAME) || value === 'финна';
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

  const canUseVoiceFirst = voiceEnabled && voiceBetaEnabled && voice.isSupported;
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
  }, [canUseVoiceFirst, resumeListeningSoon, showThought, voice]);

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
    if (!text || isWakeOnlyCommand(text)) {
      resumeListeningSoon(240);
      return;
    }

    // After wake + command we process one command and then return to passive wake mode.
    // This prevents random speech after the action from being sent to AI.
    activeUntilRef.current = 0;
    setActiveUntil(0);

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
        activeUntilRef.current = 0;
        setActiveUntil(0);
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        showThought('Вернулся назад.', 'success');
        activeUntilRef.current = 0;
        setActiveUntil(0);
        return;
      }

      const latestPending = chat.pendingActions[0];
      if (latestPending?.id && isVoiceCancel(text)) {
        await chat.cancelAction(latestPending.id);
        showThought('Отменил действие.', 'success', 1800);
        activeUntilRef.current = 0;
        setActiveUntil(0);
        return;
      }

      if (latestPending?.id && !pendingHasClarification(latestPending) && isVoiceConfirm(text)) {
        await chat.confirmAction(latestPending.id);
        showThought('Подтвердил.', 'success', 1800);
        activeUntilRef.current = 0;
        setActiveUntil(0);
        return;
      }

      await chat.sendMessage(text);
      activeUntilRef.current = 0;
      setActiveUntil(0);
    } finally {
      setIsProcessingVoice(false);
      resumeListeningSoon(RESUME_DELAY_MS);
    }
  }, [activeWindowMs, armCombatMode, chat, clearSilenceTimer, goBack, navigateTo, resumeListeningSoon, showThought]);

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
    if (!isActive || voice.state !== 'recording' || voice.mode !== 'speech') return;

    const transcript = voice.transcript.trim();
    if (!transcript) return;

    const wake = stripWakeWord(transcript);
    const shouldSubmit = activeUntilRef.current > Date.now() || wake.hasWakeWord;
    if (!shouldSubmit) return;

    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      stopListening();
    }, SILENCE_SUBMIT_MS);

    return clearSilenceTimer;
  }, [clearSilenceTimer, isActive, stopListening, voice.mode, voice.state, voice.transcript]);

  useEffect(() => {
    if (!voice.error) return;

    if (voice.error === 'transcription-not-configured') {
      shouldResumeRef.current = false;
      setVoiceAlwaysOnEnabled(false);
      showThought('Серверное распознавание ещё не настроено. Добавь ключ в backend .env или напиши команду текстом.', 'warning', 5600);
      return;
    }

    if (voice.error === 'transcription-error') {
      shouldResumeRef.current = false;
      showThought('Распознавание нестабильно. Повтори позже или напиши текстом.', 'warning', 4200);
      return;
    }

    const silentErrors = ['no-speech', 'aborted', 'speech-restart', 'audio-capture'];
    if (voice.mode === 'speech' && silentErrors.includes(voice.error)) {
      resumeListeningSoon(520);
      return;
    }

    if (voice.error === 'not-allowed' || voice.error === 'service-not-allowed' || voice.error === 'microphone-denied') {
      shouldResumeRef.current = false;
      showThought('Нужен доступ к микрофону.', 'warning');
      return;
    }

    if (voice.mode === 'speech') {
      resumeListeningSoon(1200);
    }
  }, [resumeListeningSoon, setVoiceAlwaysOnEnabled, showThought, voice.error, voice.mode]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    if (lastMessage.kind === 'preview') {
      activeUntilRef.current = 0;
      setActiveUntil(0);
      voice.stopSpeaking();
      showThought('Проверь действие в модалке.', 'warning', 3600);
      resumeListeningSoon(700);
      return;
    }

    if (lastMessage.kind === 'error') {
      activeUntilRef.current = 0;
      setActiveUntil(0);
      voice.stopSpeaking();
      showThought(lastMessage.text || 'Нужно уточнение. Скажи “Фина” и ответ.', 'warning', 5000);
      resumeListeningSoon(700);
      return;
    }

    activeUntilRef.current = 0;
    setActiveUntil(0);
    showThought(lastMessage.text || 'Готово.', 'success', 1800);

    voice.stopSpeaking();
    resumeListeningSoon(900);
  }, [chat.messages, chat.pendingActions.length, resumeListeningSoon, showThought, voice]);


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
  const showFloatingCompanion = currentScreen !== 'ai-core';
  const displayName = FIXED_COMPANION_NAME;

  if (!showFloatingCompanion && !needsIntro && chat.pendingActions.length === 0) return null;

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

      {chat.pendingActions.length > 0 ? (
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
                {chat.pendingActions.slice(0, 1).map((item) => (
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
                ? voice.state === 'recording'
                  ? isCombatActive
                    ? 'Слушаю задачу'
                    : `Жду “${displayName}”`
                  : chat.isSending || isProcessingVoice || voice.state === 'speaking'
                    ? 'Думаю'
                    : voice.mode === 'recorder'
                      ? `Сервер ждёт “${displayName}”`
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
      ) : null}
    </>
  );
}

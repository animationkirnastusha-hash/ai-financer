import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import { useVoiceInput } from '@/features/voice/model/useVoiceInput';
import { normalizeVoiceTranscriptForStt } from '@/features/voice/model/voiceSttLexicon';
import { PendingActionCard } from '@/features/pending-actions/ui/PendingActionCard';
import { CompanionButton } from '@/shared/ui/CompanionButton';
import { telegramHaptic } from '@/shared/lib/telegram';

// Голосовой слой здесь не парсит финансы. Он только:
// 1) ищет имя помощника как wake word;
// 2) собирает одну голосовую сессию из STT-сегментов;
// 3) помечает технические correction-сегменты;
// 4) отправляет итоговый текст в общий AI endpoint.

type CompanionMood = 'idle' | 'listening' | 'thinking' | 'confirm' | 'success' | 'warning';
type BubbleTone = 'neutral' | 'listening' | 'thinking' | 'success' | 'warning';
type CaptureMode = 'wake' | 'command';
type VoiceSegmentRole = 'initial' | 'continuation' | 'correction';

type Thought = {
  id: string;
  text: string;
  tone: BubbleTone;
};

type VoiceSessionSegment = {
  text: string;
  role: VoiceSegmentRole;
  at: number;
};

const BUBBLE_TIMEOUT_MS = 2800;
const DUPLICATE_WINDOW_MS = 1200;
const WAKE_SESSION_MS = 3800;
const COMMAND_SESSION_MS = 8500;
const AUTO_LISTENER_RESTART_MS = 220;
const COMMAND_CAPTURE_TIMEOUT_MS = 13_000;
const VOICE_COMMIT_WINDOW_MS = 1650;
const MIN_COMMAND_TEXT_LENGTH = 3;

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

function cleanVoiceText(text: string) {
  return normalizeVoiceTranscriptForStt(text)
    .replace(/[\u00A0\t\r\n]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?]){2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }

  return rows[a.length][b.length];
}

function buildWakeAliases(companionName: string) {
  const baseName = normalizeForWake(companionName || 'Фина').split(' ')[0] || 'фина';
  const aliases = new Set(['фина', 'финна', 'fina', 'фину', 'фине', 'фины', 'финой', 'фино', 'фена', baseName]);

  if (baseName.endsWith('а')) {
    aliases.add(`${baseName.slice(0, -1)}у`);
    aliases.add(`${baseName.slice(0, -1)}е`);
    aliases.add(`${baseName.slice(0, -1)}ы`);
  }

  return [...aliases].filter(Boolean);
}

function stripWakeWord(rawText: string, companionName: string) {
  const source = rawText.trim();
  const normalized = normalizeForWake(source);
  const words = normalized.split(' ').filter(Boolean);
  const aliases = buildWakeAliases(companionName);

  const exactIndex = words.findIndex((word) => aliases.includes(word));
  const fuzzyIndex = exactIndex >= 0
    ? exactIndex
    : words.findIndex((word) => {
        if (word.length < 3 || word.length > 8) return false;
        return aliases.some((alias) => alias.length >= 3 && alias.length <= 8 && levenshteinDistance(word, alias) <= 1);
      });

  const wakeIndex = exactIndex >= 0 ? exactIndex : fuzzyIndex;
  if (wakeIndex < 0) return { hasWakeWord: false, command: source };

  const sourceWords = source.split(/\s+/).filter(Boolean);
  const command = sourceWords.slice(wakeIndex + 1).join(' ').replace(/^[,.:;!\-—\s]+/, '').trim();

  return { hasWakeWord: true, command };
}

function looksLikeCorrection(text: string) {
  const normalized = normalizeForWake(text);
  return /(^|\s)(нет|не|стой|стоп|подожди|погоди|лучше|замени|исправь|передумал|передумала|не так|а нет|отмена)(\s|$)/.test(normalized);
}

function shouldIgnoreCommandText(text: string) {
  const normalized = normalizeForWake(text);
  if (!normalized) return true;
  if (normalized.length < MIN_COMMAND_TEXT_LENGTH) return true;
  return ['фина', 'финна', 'fina', 'а', 'и', 'ну', 'ээ', 'эм'].includes(normalized);
}

function buildVoiceSessionFinalText(segments: VoiceSessionSegment[]) {
  return segments.map((segment) => segment.text).join(' ').replace(/\s+/g, ' ').trim();
}

function getScreenVoiceLabel(screen: string) {
  const labels: Record<string, string> = {
    dashboard: 'главную',
    accounts: 'счета',
    transactions: 'операции',
    analytics: 'аналитику',
    goals: 'цели',
    settings: 'настройки',
    'taxonomy-settings': 'категории',
    companion: 'компаньона',
    premium: 'премиум',
    referral: 'рефералы',
    admin: 'админку',
    'ai-core': 'чат',
  };

  return labels[screen] ?? 'страницу';
}

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

  const [thought, setThought] = useState<Thought | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isPriming, setIsPriming] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('wake');

  const bubbleTimerRef = useRef<number | null>(null);
  const commandCaptureTimerRef = useRef<number | null>(null);
  const voiceCommitTimerRef = useRef<number | null>(null);
  const lastHandledRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const handleTextRef = useRef<(text: string) => Promise<void> | void>(() => undefined);
  const lastAssistantMessageKeyRef = useRef('');
  const lastThoughtRef = useRef<{ text: string; tone: BubbleTone; at: number }>({ text: '', tone: 'neutral', at: 0 });
  const isProcessingVoiceRef = useRef(false);
  const captureModeRef = useRef<CaptureMode>('wake');
  const voiceStateRef = useRef<string>('idle');
  const voiceCancelRef = useRef<() => void>(() => undefined);
  const voiceSessionIdRef = useRef<string>('');
  const voiceSegmentsRef = useRef<VoiceSessionSegment[]>([]);
  const finalizeVoiceSessionRef = useRef<() => void>(() => undefined);

  const showThought = useCallback((text: string, tone: BubbleTone = 'neutral', timeoutMs = BUBBLE_TIMEOUT_MS) => {
    const cleanText = compactBubble(text);
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

  const voice = useVoiceInput({
    lang: appLanguage === 'en' ? 'en-US' : 'ru-RU',
    sessionMs: captureMode === 'command' ? COMMAND_SESSION_MS : WAKE_SESSION_MS,
    onText: (text) => handleTextRef.current(text),
  });

  const canUseVoice = voiceEnabled && voiceBetaEnabled && voice.isSupported;

  const setMode = useCallback((mode: CaptureMode) => {
    captureModeRef.current = mode;
    setCaptureMode(mode);
  }, []);

  const clearCommandCaptureTimer = useCallback(() => {
    if (commandCaptureTimerRef.current !== null) {
      window.clearTimeout(commandCaptureTimerRef.current);
      commandCaptureTimerRef.current = null;
    }
  }, []);

  const clearVoiceCommitTimer = useCallback(() => {
    if (voiceCommitTimerRef.current !== null) {
      window.clearTimeout(voiceCommitTimerRef.current);
      voiceCommitTimerRef.current = null;
    }
  }, []);

  const resetVoiceSession = useCallback(() => {
    clearVoiceCommitTimer();
    clearCommandCaptureTimer();
    voiceSessionIdRef.current = '';
    voiceSegmentsRef.current = [];
    setMode('wake');
  }, [clearCommandCaptureTimer, clearVoiceCommitTimer, setMode]);

  const scheduleVoiceCommit = useCallback(() => {
    clearVoiceCommitTimer();

    voiceCommitTimerRef.current = window.setTimeout(() => {
      const state = voiceStateRef.current;
      if (state !== 'idle') {
        scheduleVoiceCommit();
        return;
      }
      finalizeVoiceSessionRef.current();
    }, VOICE_COMMIT_WINDOW_MS);
  }, [clearVoiceCommitTimer]);

  const armCommandCapture = useCallback(() => {
    clearCommandCaptureTimer();
    setMode('command');
    showThought('Слушаю команду.', 'listening', 3600);
    commandCaptureTimerRef.current = window.setTimeout(() => {
      if (captureModeRef.current !== 'command') return;
      logVoiceDebugEvent('command_capture_timeout', { segmentCount: voiceSegmentsRef.current.length });
      if (voiceSegmentsRef.current.length > 0) {
        finalizeVoiceSessionRef.current();
        return;
      }
      resetVoiceSession();
      showThought(`Скажи «${companionName || 'Фина'}» и команду ещё раз.`, 'warning', 3200);
    }, COMMAND_CAPTURE_TIMEOUT_MS);
  }, [clearCommandCaptureTimer, companionName, resetVoiceSession, setMode, showThought]);

  const ensureVoiceSession = useCallback(() => {
    if (!voiceSessionIdRef.current) voiceSessionIdRef.current = crypto.randomUUID();
    return voiceSessionIdRef.current;
  }, []);

  const appendVoiceSegment = useCallback((rawText: string) => {
    const text = cleanVoiceText(rawText);
    if (shouldIgnoreCommandText(text)) return false;

    ensureVoiceSession();
    const hasPrevious = voiceSegmentsRef.current.length > 0;
    const role: VoiceSegmentRole = !hasPrevious ? 'initial' : looksLikeCorrection(text) ? 'correction' : 'continuation';
    const segment: VoiceSessionSegment = { text, role, at: Date.now() };

    voiceSegmentsRef.current = [...voiceSegmentsRef.current, segment].slice(-8);
    logVoiceDebugEvent('voice_session_segment_added', {
      role,
      textLength: text.length,
      segmentCount: voiceSegmentsRef.current.length,
      correctionCount: voiceSegmentsRef.current.filter((item) => item.role === 'correction').length,
    });

    if (role === 'correction') showThought('Поняла правку.', 'listening', 2200);
    else showThought('Слушаю дальше.', 'listening', 1800);

    armCommandCapture();
    scheduleVoiceCommit();
    return true;
  }, [armCommandCapture, ensureVoiceSession, scheduleVoiceCommit, showThought]);

  const dispatchFinalCommand = useCallback(async (finalText: string, segments: VoiceSessionSegment[]) => {
    const text = cleanVoiceText(finalText);
    if (!text || shouldIgnoreCommandText(text)) return;

    const now = Date.now();
    const last = lastHandledRef.current;
    if (last.text === text && now - last.at < DUPLICATE_WINDOW_MS) return;
    lastHandledRef.current = { text, at: now };

    const sessionId = voiceSessionIdRef.current || crypto.randomUUID();
    resetVoiceSession();
    setIsProcessingVoice(true);
    showThought('Выполняю...', 'thinking', 2400);

    try {
      const hasCorrections = segments.some((segment) => segment.role === 'correction');
      const navigationIntent = hasCorrections ? { type: 'none' as const } : parseNavigationIntent(text);

      if (navigationIntent.type === 'open_screen') {
        telegramHaptic('light');
        logVoiceDebugEvent('voice_session_dispatched', { kind: 'navigation', target: navigationIntent.screen, textLength: text.length, segmentCount: segments.length });
        navigateTo(navigationIntent.screen);
        showThought(`Открываю ${getScreenVoiceLabel(navigationIntent.screen)}.`, 'success', 2400);
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        logVoiceDebugEvent('voice_session_dispatched', { kind: 'navigation', target: 'back', textLength: text.length, segmentCount: segments.length });
        goBack();
        showThought('Вернулся назад.', 'success', 2200);
        return;
      }

      logVoiceDebugEvent('voice_session_dispatched', {
        kind: 'ai',
        textLength: text.length,
        segmentCount: segments.length,
        correctionCount: segments.filter((segment) => segment.role === 'correction').length,
      });

      await chat.sendMessage({
        text,
        source: segments.length > 1 || hasCorrections ? 'voice_session' : 'voice',
        voiceSession: {
          id: sessionId,
          finalText: text,
          segments,
          correctionCount: segments.filter((segment) => segment.role === 'correction').length,
        },
      }, { supersedeInFlight: true });
    } finally {
      setIsProcessingVoice(false);
    }
  }, [chat, goBack, navigateTo, resetVoiceSession, showThought]);

  const finalizeVoiceSession = useCallback(() => {
    const segments = voiceSegmentsRef.current;
    const finalText = buildVoiceSessionFinalText(segments);

    if (!segments.length || !finalText) {
      resetVoiceSession();
      return;
    }

    logVoiceDebugEvent('voice_session_finalized', {
      textLength: finalText.length,
      segmentCount: segments.length,
      correctionCount: segments.filter((segment) => segment.role === 'correction').length,
    });

    void dispatchFinalCommand(finalText, segments);
  }, [dispatchFinalCommand, resetVoiceSession]);

  useEffect(() => {
    finalizeVoiceSessionRef.current = finalizeVoiceSession;
  }, [finalizeVoiceSession]);

  const handleText = useCallback(async (rawText: string) => {
    const originalText = cleanVoiceText(rawText);
    if (!originalText || isProcessingVoiceRef.current) return;

    const mode = captureModeRef.current;

    if (mode === 'command') {
      const wake = stripWakeWord(originalText, companionName);
      const command = cleanVoiceText(wake.hasWakeWord ? wake.command : originalText);
      logVoiceDebugEvent('command_capture_text_received', {
        textLength: command.length,
        hadWakeWord: wake.hasWakeWord,
        hasText: Boolean(command),
      });

      if (!command) return;
      appendVoiceSegment(command);
      return;
    }

    const wake = stripWakeWord(originalText, companionName);
    if (!wake.hasWakeWord) {
      logVoiceDebugEvent('wake_word_not_detected', {
        textLength: originalText.length,
        hasText: Boolean(originalText),
        visualOnly: true,
      });
      return;
    }

    const command = cleanVoiceText(wake.command);
    logVoiceDebugEvent('wake_word_detected', {
      textLength: originalText.length,
      hasText: Boolean(originalText),
      commandLength: command.length,
    });

    if (!command) {
      ensureVoiceSession();
      armCommandCapture();
      return;
    }

    appendVoiceSegment(command);
  }, [appendVoiceSegment, armCommandCapture, companionName, ensureVoiceSession]);

  useEffect(() => {
    handleTextRef.current = handleText;
  }, [handleText]);

  const primeVoicePermission = useCallback(async () => {
    setIsPriming(true);
    try {
      const ready = await voice.primePermission();
      setVoicePermissionPrompted(true);
      if (ready) showThought(`Готово. Скажи «${companionName || 'Фина'}» и команду.`, 'success', 3200);
      else showThought(`Скажи «${companionName || 'Фина'}», когда будешь готов.`, 'neutral', 3200);
    } catch {
      showThought('Нужен доступ к микрофону.', 'warning', 3600);
    } finally {
      setIsPriming(false);
    }
  }, [companionName, setVoicePermissionPrompted, showThought, voice]);

  useEffect(() => {
    isProcessingVoiceRef.current = isProcessingVoice;
  }, [isProcessingVoice]);

  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);

  useEffect(() => {
    voiceStateRef.current = voice.state;
  }, [voice.state]);

  useEffect(() => {
    if (!canUseVoice || !voiceAlwaysOnEnabled || !voicePermissionPrompted) return undefined;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return undefined;
    if (chat.pendingActions.length > 0 || chat.isSending || isProcessingVoice) return undefined;
    if (voice.state !== 'idle') return undefined;

    const timer = window.setTimeout(() => {
      if (voice.state !== 'idle' || isProcessingVoiceRef.current) return;
      void voice.start().then((result) => {
        if (result === 'started') {
          logVoiceDebugEvent(captureModeRef.current === 'command' ? 'command_listener_auto_start' : 'wake_listener_auto_start');
        }
      });
    }, captureModeRef.current === 'command' ? 80 : AUTO_LISTENER_RESTART_MS);

    return () => window.clearTimeout(timer);
  }, [canUseVoice, chat.isSending, chat.pendingActions.length, isProcessingVoice, voice, voice.state, voiceAlwaysOnEnabled, voicePermissionPrompted, captureMode]);

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

    if (captureModeRef.current === 'wake') return;

    if (voice.error === 'no-speech' || voice.error === 'transcription-timeout' || voice.error === 'transcription-error') {
      if (voiceSegmentsRef.current.length > 0) {
        scheduleVoiceCommit();
        return;
      }
      showThought('Не расслышала команду.', 'warning', 2600);
      resetVoiceSession();
    }
  }, [resetVoiceSession, scheduleVoiceCommit, showThought, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    voice.stopSpeaking();
    resetVoiceSession();

    if (lastMessage.kind === 'preview') {
      showThought('Проверь действие.', 'warning', 3600);
      return;
    }

    if (lastMessage.kind === 'error') {
      showThought(lastMessage.text || 'Нужно уточнение.', 'warning', 5000);
      return;
    }

    showThought(lastMessage.text || 'Готово.', 'success', 2600);
  }, [chat.messages, resetVoiceSession, showThought, voice]);

  useEffect(() => {
    voiceCancelRef.current = voice.cancel;
  }, [voice.cancel]);

  useEffect(() => () => {
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    resetVoiceSession();
    voiceCancelRef.current();
  }, [resetVoiceSession]);

  const mood = useMemo<CompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (voice.state === 'recording' || captureMode === 'command') return 'listening';
    if (voice.state === 'uploading' || chat.isSending || isProcessingVoice) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [captureMode, chat.isSending, chat.pendingActions.length, isProcessingVoice, thought?.tone, voice.state]);

  const needsIntro = canUseVoice && !voicePermissionPrompted;
  const showFloatingCompanion = currentScreen !== 'ai-core';
  const wakeName = companionName || 'Фина';

  if (!showFloatingCompanion && !needsIntro && chat.pendingActions.length === 0) return null;

  return (
    <>
      {needsIntro ? (
        <div className="voice-first-intro" data-no-swipe="true">
          <div className="voice-first-intro__card voice-first-intro__card--polished">
            <div className="voice-first-intro__avatar" aria-hidden="true">
              <CompanionButton mood="idle" size="md" label={wakeName} />
            </div>
            <div className="voice-first-intro__eyebrow">Голосовой помощник</div>
            <div className="voice-first-intro__title">Это {wakeName}</div>
            <p>Разреши микрофон один раз. Дальше говори имя помощника и команду обычными словами.</p>

            <div className="voice-first-intro__steps">
              <div><b>1</b><span>Разреши микрофон</span></div>
              <div><b>2</b><span>Скажи «{wakeName}»</span></div>
              <div><b>3</b><span>Продиктуй команду</span></div>
            </div>

            <div className="voice-first-intro__hint">
              Например: “{wakeName}, кофе 300” или “{wakeName}, положи 10 тысяч на карту Т-Банк”.
            </div>

            <div className="voice-first-intro__actions">
              <button type="button" onClick={primeVoicePermission} disabled={isPriming}>{isPriming ? 'Запрашиваю...' : 'Разрешить микрофон'}</button>
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
                  <h2>Подтверди действие</h2>
                  <p>Фина выполнит его после подтверждения.</p>
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
              <div className={canUseVoice ? 'voice-first-status voice-first-status--on' : 'voice-first-status'}>
                {canUseVoice
                  ? chat.isSending || isProcessingVoice
                    ? 'Выполняю'
                    : voice.state === 'uploading'
                      ? captureMode === 'command' ? 'Распознаю команду' : 'Проверяю имя'
                      : captureMode === 'command'
                        ? voiceSegmentsRef.current.length > 0 ? 'Жду правку' : 'Слушаю команду'
                        : voiceAlwaysOnEnabled
                          ? `Жду «${wakeName}»`
                          : 'Голос выключен'
                  : 'Голос выключен'}
              </div>
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { logVoiceDebugEvent, type VoiceCue } from '@/features/voice/api/voice.api';
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

const BUBBLE_TIMEOUT_MS = 2800;
const DUPLICATE_WINDOW_MS = 1000;
const DEFAULT_VOICE_SESSION_MS = 9000;
const AUTO_LISTENER_RESTART_MS = 650;
const WAKE_COMMAND_WINDOW_MS = 12500;
const TTS_MIN_GAP_MS = 1800;

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
  return text
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

function stripWakeWord(rawText: string) {
  const source = rawText.trim();
  const normalized = normalizeForWake(source);
  const words = normalized.split(' ').filter(Boolean);
  const aliases = ['фина', 'финна', 'fina', 'фину', 'фине', 'фины', 'финой', 'фино', 'фена'];

  const exactIndex = words.findIndex((word) => aliases.includes(word));
  const fuzzyIndex = exactIndex >= 0
    ? exactIndex
    : words.findIndex((word) => {
        if (word.length < 3 || word.length > 7) return false;
        return levenshteinDistance(word, 'фина') <= 1 || levenshteinDistance(word, 'финна') <= 1;
      });

  const wakeIndex = exactIndex >= 0 ? exactIndex : fuzzyIndex;
  if (wakeIndex < 0) return { hasWakeWord: false, command: source };

  const sourceWords = source.split(/\s+/).filter(Boolean);
  const command = sourceWords.slice(wakeIndex + 1).join(' ').replace(/^[,.:;!\-—\s]+/, '').trim();

  return {
    hasWakeWord: true,
    command,
  };
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
  const voiceRepliesEnabled = useSettingsStore((state) => state.voiceRepliesEnabled);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);

  const [thought, setThought] = useState<Thought | null>(null);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isPriming, setIsPriming] = useState(false);

  const bubbleTimerRef = useRef<number | null>(null);
  const lastHandledRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const handleTextRef = useRef<(text: string) => Promise<void> | void>(() => undefined);
  const lastAssistantMessageKeyRef = useRef('');
  const lastThoughtRef = useRef<{ text: string; tone: BubbleTone; at: number }>({ text: '', tone: 'neutral', at: 0 });
  const isProcessingVoiceRef = useRef(false);
  const voiceCancelRef = useRef<() => void>(() => undefined);
  const wakeCommandUntilRef = useRef(0);
  const lastTtsCueRef = useRef<{ cue: VoiceCue | null; at: number }>({ cue: null, at: 0 });

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
    sessionMs: DEFAULT_VOICE_SESSION_MS,
    onText: (text) => handleTextRef.current(text),
  });

  const canUseVoice = voiceEnabled && voiceBetaEnabled && voice.isSupported;

  const speakThought = useCallback((text: string, tone: BubbleTone = 'neutral', cue?: VoiceCue, timeoutMs = BUBBLE_TIMEOUT_MS) => {
    showThought(text, tone, timeoutMs);
    if (!voiceRepliesEnabled || !cue) return;

    const now = Date.now();
    const lastCue = lastTtsCueRef.current;
    if (lastCue.cue === cue && now - lastCue.at < TTS_MIN_GAP_MS) {
      logVoiceDebugEvent('tts_cue_skipped_duplicate', { cue, textLength: text.length });
      return;
    }

    lastTtsCueRef.current = { cue, at: now };
    voice.speak(text, { cue, maxDurationMs: Math.min(2600, timeoutMs + 350) });
  }, [showThought, voice, voiceRepliesEnabled]);

  const handleText = useCallback(async (rawText: string) => {
    const originalText = cleanVoiceText(rawText);
    if (!originalText || isProcessingVoiceRef.current) return;

    const now = Date.now();
    const wake = stripWakeWord(originalText);
    const acceptsFollowUpCommand = !wake.hasWakeWord && wakeCommandUntilRef.current > now;

    if (!wake.hasWakeWord && !acceptsFollowUpCommand) {
      logVoiceDebugEvent('wake_word_not_detected', {
        textLength: originalText.length,
        hasText: Boolean(originalText),
      });
      return;
    }

    if (wake.hasWakeWord) {
      logVoiceDebugEvent('wake_word_detected', {
        textLength: originalText.length,
        hasText: Boolean(originalText),
        commandLength: wake.command.length,
      });
    } else {
      logVoiceDebugEvent('wake_followup_command_detected', {
        textLength: originalText.length,
        hasText: Boolean(originalText),
        windowLeftMs: Math.max(0, wakeCommandUntilRef.current - now),
      });
    }

    const text = cleanVoiceText(wake.hasWakeWord ? wake.command : originalText);
    if (!text) {
      wakeCommandUntilRef.current = Date.now() + WAKE_COMMAND_WINDOW_MS;
      speakThought('Я здесь.', 'listening', 'here', 2200);
      return;
    }

    wakeCommandUntilRef.current = Date.now() + 2500;

    const last = lastHandledRef.current;
    if (last.text === text && now - last.at < DUPLICATE_WINDOW_MS) return;
    lastHandledRef.current = { text, at: now };

    setIsProcessingVoice(true);
    showThought('Думаю...', 'thinking', 1800);

    try {
      const navigationIntent = parseNavigationIntent(text);

      if (navigationIntent.type === 'open_screen') {
        telegramHaptic('light');
        navigateTo(navigationIntent.screen);
        speakThought(`Открываю ${getScreenVoiceLabel(navigationIntent.screen)}.`, 'success', 'done');
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        speakThought('Вернулся назад.', 'success', 'done');
        return;
      }

      await chat.sendMessage(text);
    } finally {
      setIsProcessingVoice(false);
    }
  }, [chat, goBack, navigateTo, showThought, speakThought, telegramHaptic]);

  useEffect(() => {
    handleTextRef.current = handleText;
  }, [handleText]);

  const primeVoicePermission = useCallback(async () => {
    setIsPriming(true);
    try {
      const ready = await voice.primePermission();
      setVoicePermissionPrompted(true);
      if (ready) speakThought('Готово. Скажи «Фина», затем команду.', 'success', 'done', 3600);
      else showThought('Скажи «Фина», когда будешь готов.', 'neutral', 3200);
    } catch {
      speakThought('Нужен доступ к микрофону.', 'warning', 'not-heard', 3600);
    } finally {
      setIsPriming(false);
    }
  }, [setVoicePermissionPrompted, showThought, speakThought, voice]);

  useEffect(() => {
    isProcessingVoiceRef.current = isProcessingVoice;
  }, [isProcessingVoice]);

  useEffect(() => {
    if (!canUseVoice || !voiceAlwaysOnEnabled || !voicePermissionPrompted) return undefined;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return undefined;
    if (chat.pendingActions.length > 0 || chat.isSending || isProcessingVoice) return undefined;
    if (voice.state !== 'idle') return undefined;

    const timer = window.setTimeout(() => {
      if (voice.state !== 'idle' || isProcessingVoiceRef.current) return;
      void voice.start().then((result) => {
        if (result === 'started') logVoiceDebugEvent('wake_listener_auto_start');
      });
    }, AUTO_LISTENER_RESTART_MS);

    return () => window.clearTimeout(timer);
  }, [canUseVoice, chat.isSending, chat.pendingActions.length, isProcessingVoice, voice, voice.state, voiceAlwaysOnEnabled, voicePermissionPrompted]);

  useEffect(() => {
    if (!voice.error) return;

    if (voice.error === 'transcription-not-configured') {
      showThought('Распознавание ещё не настроено.', 'warning', 4200);
      return;
    }

    if (voice.error === 'microphone-denied' || voice.error === 'not-allowed' || voice.error === 'service-not-allowed') {
      speakThought('Нужен доступ к микрофону.', 'warning', 'not-heard', 3600);
      return;
    }

    if (voiceAlwaysOnEnabled && (voice.error === 'no-speech' || voice.error === 'transcription-timeout' || voice.error === 'transcription-error')) {
      return;
    }

    if (voice.error === 'no-speech') {
      speakThought('Не расслышала.', 'warning', 'not-heard', 2400);
      return;
    }

    if (voice.error === 'transcription-timeout') {
      speakThought('Не расслышала.', 'warning', 'not-heard', 2600);
      return;
    }

    if (voice.error === 'transcription-error') {
      speakThought('Не расслышала.', 'warning', 'not-heard', 2600);
    }
  }, [showThought, speakThought, voice.error, voiceAlwaysOnEnabled]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    if (lastMessage.kind === 'preview') {
      voice.stopSpeaking();
      speakThought('Проверь действие.', 'warning', 'confirm', 3600);
      return;
    }

    if (lastMessage.kind === 'error') {
      voice.stopSpeaking();
      showThought(lastMessage.text || 'Нужно уточнение.', 'warning', 5000);
      return;
    }

    voice.stopSpeaking();
    showThought(lastMessage.text || 'Готово.', 'success', 2200);
  }, [chat.messages, showThought, speakThought, voice]);

  useEffect(() => {
    voiceCancelRef.current = voice.cancel;
  }, [voice.cancel]);

  useEffect(() => () => {
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    voiceCancelRef.current();
  }, []);

  const mood = useMemo<CompanionMood>(() => {
    if (chat.pendingActions.length > 0) return 'confirm';
    if (voice.state === 'recording') return 'listening';
    if (voice.state === 'uploading' || voice.state === 'speaking' || chat.isSending || isProcessingVoice) return 'thinking';
    if (thought?.tone === 'warning') return 'warning';
    if (thought?.tone === 'success') return 'success';
    return 'idle';
  }, [chat.isSending, chat.pendingActions.length, isProcessingVoice, thought?.tone, voice.state]);

  const needsIntro = canUseVoice && !voicePermissionPrompted;
  const showFloatingCompanion = currentScreen !== 'ai-core';

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
              Разреши микрофон один раз. Дальше просто скажи «Фина» и команду — нажимать на персонажа не нужно.
            </p>

            <div className="voice-first-intro__steps">
              <div><b>1</b><span>Разреши микрофон</span></div>
              <div><b>2</b><span>Скажи «Фина»</span></div>
              <div><b>3</b><span>Продиктуй команду</span></div>
            </div>

            <div className="voice-first-intro__hint">
              Примеры: “Фина, кофе 300”, “Фина, создай цель отпуск 120000”, “Фина, сделай наличку основной”.
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
                  <h2>Фина ждёт подтверждения</h2>
                  <p>Проверь действие перед выполнением.</p>
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
                  ? voice.state === 'recording'
                    ? 'Слушаю'
                    : voice.state === 'uploading'
                      ? 'Распознаю'
                      : chat.isSending || isProcessingVoice
                        ? 'Думаю'
                        : voiceAlwaysOnEnabled
                          ? 'Жду «Фина»'
                          : 'Голос выключен'
                  : 'Голос выключен'}
              </div>
            </div>

            <CompanionButton
              mood={mood}
              size="md"
              label="Фина слушает голос"
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

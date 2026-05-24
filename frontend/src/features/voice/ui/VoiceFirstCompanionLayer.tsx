import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatController } from '@/features/chat/model/useChatController';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
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
const DEFAULT_VOICE_SESSION_MS = 5500;
const AUTO_LISTEN_RESTART_MS = 420;

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

function stripWakeWord(rawText: string) {
  const source = rawText.trim();
  const normalized = normalizeForWake(source);
  const aliases = ['Фина', 'Финна', 'Fina', 'фина', 'фину', 'фине', 'фины']
    .map((value) => value.trim())
    .filter(Boolean);

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
  const voicePermissionPrompted = useSettingsStore((state) => state.voicePermissionPrompted);
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
  const autoListenTimerRef = useRef<number | null>(null);
  const autoListenInFlightRef = useRef(false);

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

  const handleText = useCallback(async (rawText: string) => {
    const originalText = cleanVoiceText(rawText);
    if (!originalText || isProcessingVoiceRef.current) return;

    const wake = stripWakeWord(originalText);
    if (!wake.hasWakeWord) {
      logVoiceDebugEvent('wake_word_not_detected', { textLength: originalText.length });
      return;
    }

    const text = cleanVoiceText(wake.command);
    if (!text) {
      showThought('Слушаю задачу после имени.', 'listening', 2200);
      return;
    }

    const now = Date.now();
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
        showThought('Открываю.', 'success');
        return;
      }

      if (navigationIntent.type === 'go_back') {
        telegramHaptic('light');
        goBack();
        showThought('Вернулся назад.', 'success');
        return;
      }

      // Подтверждения, отмены и уточнения идут через существующие модалки.
      // Голос здесь — только ввод новой команды, без отдельного параллельного confirm-flow.
      await chat.sendMessage(text);
    } finally {
      setIsProcessingVoice(false);
    }
  }, [chat, goBack, navigateTo, showThought]);

  useEffect(() => {
    handleTextRef.current = handleText;
  }, [handleText]);

  const primeVoicePermission = useCallback(async () => {
    setIsPriming(true);
    try {
      const ready = await voice.primePermission();
      setVoicePermissionPrompted(true);
      if (ready) showThought('Готово. Скажи: Фина, и команду.', 'success', 3600);
      else showThought('Скажи “Фина” и команду, когда микрофон будет готов.', 'neutral', 3200);
    } catch {
      showThought('Нужен доступ к микрофону.', 'warning', 3600);
    } finally {
      setIsPriming(false);
    }
  }, [setVoicePermissionPrompted, showThought, voice]);

  const startVoiceSession = useCallback(async () => {
    if (!canUseVoice) {
      showThought('Голос сейчас выключен. Проверь настройки.', 'warning');
      return;
    }

    if (!voicePermissionPrompted) {
      await primeVoicePermission();
      return;
    }

    if (chat.pendingActions.length > 0) {
      showThought('Сначала проверь действие в модалке.', 'warning', 2600);
      return;
    }

    if (isProcessingVoiceRef.current || chat.isSending || voice.state === 'uploading' || voice.state === 'speaking') {
      showThought('Думаю...', 'thinking', 1200);
      return;
    }

    if (voice.state === 'recording') {
      voice.stop();
      showThought('Отправляю.', 'thinking', 1400);
      return;
    }

    telegramHaptic('light');
    const result = await voice.start();
    if (result === 'started') {
      showThought('Слушаю имя Фина.', 'listening', DEFAULT_VOICE_SESSION_MS);
      return;
    }

    if (result === 'busy') {
      showThought('Секунду.', 'thinking', 1200);
      return;
    }

    if (result === 'permission-ready') {
      showThought('Доступ к микрофону готов. Скажи: Фина, и команду.', 'neutral', 3200);
      return;
    }

    showThought('Микрофон недоступен.', 'warning', 3000);
  }, [canUseVoice, chat.isSending, chat.pendingActions.length, primeVoicePermission, showThought, telegramHaptic, voice, voicePermissionPrompted]);

  useEffect(() => {
    isProcessingVoiceRef.current = isProcessingVoice;
  }, [isProcessingVoice]);

  useEffect(() => {
    if (autoListenTimerRef.current !== null) {
      window.clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }

    const shouldAutoListen =
      canUseVoice &&
      voicePermissionPrompted &&
      chat.pendingActions.length === 0 &&
      !chat.isSending &&
      !isProcessingVoice &&
      voice.state === 'idle' &&
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible';

    if (!shouldAutoListen) return undefined;

    autoListenTimerRef.current = window.setTimeout(() => {
      if (autoListenInFlightRef.current) return;
      autoListenInFlightRef.current = true;

      logVoiceDebugEvent('wake_listener_auto_start');
      void voice.start()
        .then((result) => {
          logVoiceDebugEvent('wake_listener_auto_start_result', { result });
        })
        .finally(() => {
          autoListenInFlightRef.current = false;
        });
    }, AUTO_LISTEN_RESTART_MS);

    return () => {
      if (autoListenTimerRef.current !== null) {
        window.clearTimeout(autoListenTimerRef.current);
        autoListenTimerRef.current = null;
      }
    };
  }, [canUseVoice, chat.isSending, chat.pendingActions.length, isProcessingVoice, voice, voice.state, voicePermissionPrompted]);

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

    if (voice.error === 'no-speech' || voice.error === 'transcription-timeout' || voice.error === 'transcription-error') {
      return;
    }
  }, [showThought, voice.error]);

  useEffect(() => {
    const lastMessage = chat.messages.filter((message) => message.role === 'assistant').at(-1);
    if (!lastMessage) return;

    const messageKey = `${lastMessage.id}:${lastMessage.kind}:${lastMessage.text}`;
    if (lastAssistantMessageKeyRef.current === messageKey) return;
    lastAssistantMessageKeyRef.current = messageKey;

    if (lastMessage.kind === 'preview') {
      voice.stopSpeaking();
      showThought('Проверь действие в модалке.', 'warning', 3600);
      return;
    }

    if (lastMessage.kind === 'error') {
      voice.stopSpeaking();
      showThought(lastMessage.text || 'Нужно уточнение.', 'warning', 5000);
      return;
    }

    voice.stopSpeaking();
    showThought(lastMessage.text || 'Готово.', 'success', 1800);
  }, [chat.messages, showThought, voice]);

  useEffect(() => {
    voiceCancelRef.current = voice.cancel;
  }, [voice.cancel]);

  useEffect(() => () => {
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    if (autoListenTimerRef.current !== null) window.clearTimeout(autoListenTimerRef.current);
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
              После разрешения микрофона Фина ждёт своё имя. Скажи “Фина” и финансовую команду обычным языком.
            </p>

            <div className="voice-first-intro__steps">
              <div><b>1</b><span>Разреши микрофон</span></div>
              <div><b>2</b><span>Скажи “Фина”</span></div>
              <div><b>3</b><span>Добавь команду</span></div>
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
                        : 'Жду “Фина”'
                  : 'Голос выключен'}
              </div>
            </div>

            <CompanionButton
              mood={mood}
              size="md"
              label="Фина"
              onClick={startVoiceSession}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

import { useCallback, useRef } from 'react';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import type { useChatController } from '@/features/chat/model/useChatController';
import type { AppScreen } from '@/features/navigation/model/navigation.store';
import { telegramHaptic } from '@/shared/lib/telegram';
import { logVoiceDebugEvent } from './voiceApi';
import { normalizeVoiceText, shouldIgnoreVoiceCommand } from './voiceText';
import type { VoiceBubbleTone } from './voiceCapture.types';

type ChatController = ReturnType<typeof useChatController>;

type UseVoiceCommandDispatcherParams = {
  chat: ChatController;
  navigateTo: (screen: AppScreen) => void;
  goBack: () => void;
  openTextChat: () => void;
  showThought: (text: string, tone?: VoiceBubbleTone, timeoutMs?: number) => void;
};

const VOICE_DUPLICATE_WINDOW_MS = 3200;

function getScreenVoiceLabel(screen: string) {
  const labels: Record<string, string> = {
    dashboard: 'главную',
    accounts: 'счета',
    transactions: 'операции',
    analytics: 'аналитику',
    goals: 'цели',
    settings: 'настройки',
    sections: 'категории',
    companion: 'компаньона',
    referral: 'рефералы',
    admin: 'админку',
    payments: 'платежи',
    'goals-limits': 'цели и лимиты',
  };
  return labels[screen] ?? 'страницу';
}

export function useVoiceCommandDispatcher({ chat, navigateTo, goBack, openTextChat, showThought }: UseVoiceCommandDispatcherParams) {
  const lastHandledRef = useRef<{ text: string; at: number; sessionId: string }>({ text: '', at: 0, sessionId: '' });

  return useCallback(async (params: { sessionId: string; text: string }) => {
    const text = normalizeVoiceText(params.text);
    if (!text || shouldIgnoreVoiceCommand(text)) return;

    const now = Date.now();
    const last = lastHandledRef.current;
    if (last.text === text && now - last.at < VOICE_DUPLICATE_WINDOW_MS) {
      logVoiceDebugEvent('voice_duplicate_ignored', { textLength: text.length, ageMs: now - last.at, sessionId: params.sessionId });
      showThought('Похоже, это уже выполнено.', 'neutral', 2200);
      return;
    }

    if (chat.isSending || chat.confirmationActions.length > 0) {
      logVoiceDebugEvent('voice_ignored_busy_chat', {
        textLength: text.length,
        isSending: chat.isSending,
        pendingActions: chat.pendingActions.length,
        confirmationActions: chat.confirmationActions.length,
      });
      if (chat.confirmationActions.length > 0) showThought('Сначала подтверди или отмени действие.', 'warning', 2600);
      return;
    }

    lastHandledRef.current = { text, at: now, sessionId: params.sessionId };
    const navigationIntent = parseNavigationIntent(text);

    if (navigationIntent.type === 'open_text_chat') {
      telegramHaptic('light');
      logVoiceDebugEvent('voice_dispatched', { kind: 'navigation', target: 'text_chat_overlay', textLength: text.length });
      openTextChat();
      showThought('Открываю текстовый ввод.', 'success', 2400);
      return;
    }

    if (navigationIntent.type === 'open_screen') {
      telegramHaptic('light');
      logVoiceDebugEvent('voice_dispatched', { kind: 'navigation', target: navigationIntent.screen, textLength: text.length });
      navigateTo(navigationIntent.screen);
      showThought(`Открываю ${getScreenVoiceLabel(navigationIntent.screen)}.`, 'success', 2400);
      return;
    }

    if (navigationIntent.type === 'go_back') {
      telegramHaptic('light');
      logVoiceDebugEvent('voice_dispatched', { kind: 'navigation', target: 'back', textLength: text.length });
      goBack();
      showThought('Вернулся назад.', 'success', 2200);
      return;
    }

    logVoiceDebugEvent('voice_dispatched', { kind: 'ai', textLength: text.length });
    await chat.sendMessage({
      text,
      source: 'voice',
      voiceSession: {
        id: params.sessionId,
        finalText: text,
        segments: [{ text, role: 'initial', at: Date.now() }],
        correctionCount: 0,
      },
    }, { supersedeInFlight: true });
  }, [chat, goBack, navigateTo, openTextChat, showThought]);
}

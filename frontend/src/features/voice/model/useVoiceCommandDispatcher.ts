import { useCallback, useRef } from 'react';
import { parseNavigationIntent } from '@/features/navigation/lib/parseNavigationIntent';
import { logVoiceDebugEvent } from '@/features/voice/api/voice.api';
import { VOICE_DUPLICATE_WINDOW_MS } from '@/features/voice/model/voiceConstants';
import type { VoiceBubbleTone, VoiceSessionSegment } from '@/features/voice/model/voiceSession.types';
import { normalizeVoiceText, shouldIgnoreVoiceCommand } from '@/features/voice/model/voiceText';
import { telegramHaptic } from '@/shared/lib/telegram';
import type { useChatController } from '@/features/chat/model/useChatController';
import type { AppScreen } from '@/features/navigation/model/navigation.store';

type ChatController = ReturnType<typeof useChatController>;

type UseVoiceCommandDispatcherParams = {
  chat: ChatController;
  navigateTo: (screen: AppScreen) => void;
  goBack: () => void;
  openTextChat: () => void;
  showThought: (text: string, tone?: VoiceBubbleTone, timeoutMs?: number) => void;
};

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
  };

  return labels[screen] ?? 'страницу';
}

export function useVoiceCommandDispatcher({ chat, navigateTo, goBack, openTextChat, showThought }: UseVoiceCommandDispatcherParams) {
  const lastHandledRef = useRef<{ text: string; at: number; sessionId: string }>({ text: '', at: 0, sessionId: '' });

  return useCallback(async (params: { sessionId: string; finalText: string; segments: VoiceSessionSegment[] }) => {
    const text = normalizeVoiceText(params.finalText);
    if (!text || shouldIgnoreVoiceCommand(text)) return;

    const now = Date.now();
    const last = lastHandledRef.current;
    if (last.text === text && now - last.at < VOICE_DUPLICATE_WINDOW_MS) {
      logVoiceDebugEvent('voice_session_duplicate_ignored', {
        textLength: text.length,
        ageMs: now - last.at,
        previousSessionId: last.sessionId,
        sessionId: params.sessionId,
      });
      showThought('Похоже, это уже выполнено.', 'neutral', 2200);
      return;
    }

    if (chat.isSending || chat.confirmationActions.length > 0) {
      logVoiceDebugEvent('voice_session_ignored_busy_chat', {
        textLength: text.length,
        isSending: chat.isSending,
        pendingActions: chat.pendingActions.length,
        confirmationActions: chat.confirmationActions.length,
        clarificationActions: chat.clarificationActions.length,
      });
      if (chat.confirmationActions.length > 0) showThought('Сначала подтверди или отмени действие.', 'warning', 2600);
      return;
    }

    lastHandledRef.current = { text, at: now, sessionId: params.sessionId };

    const hasCorrections = params.segments.some((segment) => segment.role === 'correction');
    const navigationIntent = hasCorrections ? { type: 'none' as const } : parseNavigationIntent(text);

    if (navigationIntent.type === 'open_text_chat') {
      telegramHaptic('light');
      logVoiceDebugEvent('voice_session_dispatched', {
        kind: 'navigation',
        target: 'text_chat_overlay',
        textLength: text.length,
        segmentCount: params.segments.length,
      });
      openTextChat();
      showThought('Открываю текстовый ввод.', 'success', 2400);
      return;
    }

    if (navigationIntent.type === 'open_screen') {
      telegramHaptic('light');
      logVoiceDebugEvent('voice_session_dispatched', {
        kind: 'navigation',
        target: navigationIntent.screen,
        textLength: text.length,
        segmentCount: params.segments.length,
      });
      navigateTo(navigationIntent.screen);
      showThought(`Открываю ${getScreenVoiceLabel(navigationIntent.screen)}.`, 'success', 2400);
      return;
    }

    if (navigationIntent.type === 'go_back') {
      telegramHaptic('light');
      logVoiceDebugEvent('voice_session_dispatched', {
        kind: 'navigation',
        target: 'back',
        textLength: text.length,
        segmentCount: params.segments.length,
      });
      goBack();
      showThought('Вернулся назад.', 'success', 2200);
      return;
    }

    logVoiceDebugEvent('voice_session_dispatched', {
      kind: 'ai',
      textLength: text.length,
      segmentCount: params.segments.length,
      correctionCount: params.segments.filter((segment) => segment.role === 'correction').length,
    });

    await chat.sendMessage({
      text,
      source: params.segments.length > 1 || hasCorrections ? 'voice_session' : 'voice',
      voiceSession: {
        id: params.sessionId,
        finalText: text,
        segments: params.segments,
        correctionCount: params.segments.filter((segment) => segment.role === 'correction').length,
      },
    }, { supersedeInFlight: true });
  }, [chat, goBack, navigateTo, openTextChat, showThought]);
}

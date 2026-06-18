import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AuthService } from '../auth/service';
import { AIService } from '../ai/service';
import { aiIdempotencyService } from '../ai/ai-idempotency.service';
import { aiResponseNormalizer } from '../ai/ai-response-normalizer.service';
import { subscriptionService } from '../subscription/service';
import { voiceService } from '../../services/voice.service';
import { telegramBotClient } from './telegram-client';
import type { AIResult } from '../ai/types';
import type { TelegramBotCallbackQuery, TelegramBotMessage, TelegramBotUpdate, TelegramBotUser } from './types';

const authService = new AuthService();
const aiService = new AIService();

const CALLBACK_PREFIX = 'fina:';
const CALLBACK_CONFIRM = `${CALLBACK_PREFIX}confirm:`;
const CALLBACK_CANCEL = `${CALLBACK_PREFIX}cancel:`;
const MAX_CALLBACK_ACTION_ID_LENGTH = 48;

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactText(value: unknown, limit: number) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trim()}…` : text;
}

function getMiniAppUrl() {
  return (
    process.env.TELEGRAM_MINI_APP_URL?.trim()
    || process.env.TELEGRAM_WEB_APP_URL?.trim()
    || env.frontendUrl
    || ''
  );
}

function isLoginCommand(text: string) {
  const value = text.trim().toLowerCase();
  return value === '/login' || value === 'код' || value === 'войти' || value.startsWith('/start login');
}

function isStartCommand(text: string) {
  const value = text.trim().toLowerCase();
  return value === '/start' || (value.startsWith('/start ') && !value.startsWith('/start login'));
}

function isHelpCommand(text: string) {
  const value = text.trim().toLowerCase();
  return value === '/help' || value === 'помощь';
}

function isBotCommand(text: string) {
  return text.trim().startsWith('/');
}

function getChatId(message?: TelegramBotMessage | null) {
  return message?.chat?.id ?? null;
}

function getCallbackChatId(callback?: TelegramBotCallbackQuery | null) {
  return callback?.message?.chat?.id ?? null;
}

function buildOpenAppMarkup() {
  const miniAppUrl = getMiniAppUrl();
  if (!miniAppUrl) return undefined;
  return {
    inline_keyboard: [[
      { text: 'Открыть Фину', web_app: { url: miniAppUrl } },
    ]],
  };
}

function buildConfirmMarkup(pendingActionId: string) {
  const safeId = pendingActionId.slice(0, MAX_CALLBACK_ACTION_ID_LENGTH);
  return {
    inline_keyboard: [[
      { text: 'Подтвердить', callback_data: `${CALLBACK_CONFIRM}${safeId}` },
      { text: 'Отменить', callback_data: `${CALLBACK_CANCEL}${safeId}` },
    ]],
  };
}

function buildResultText(result: AIResult) {
  const message = compactText(result.message || '', 900);

  if (result.executed) {
    return `Готово. ${escapeHtml(message || 'Записала.')}`;
  }

  if (result.requiresConfirmation) {
    return `Проверь действие. ${escapeHtml(message || 'Нужно подтверждение.')}`;
  }

  if (result.intent === 'clarification') {
    return escapeHtml(message || 'Уточни, пожалуйста, детали.');
  }

  if (!result.success) {
    return escapeHtml(message || 'Не получилось выполнить запрос.');
  }

  return escapeHtml(message || 'Готово.');
}

function getUserFacingError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '');
    if (code === 'FORBIDDEN') return 'Похоже, лимит для этой функции закончился. Проверь лимиты в магазине или напиши команду текстом.';
    if (code === 'BAD_REQUEST') return 'Не получилось разобрать запрос. Напиши его чуть короче.';
    if (code === 'UNAUTHORIZED') return 'Не получилось связать сообщение с пользователем. Открой Фину из Telegram и попробуй снова.';
  }

  if (error instanceof Error) {
    if (error.name === 'VoiceTranscriptionNotConfiguredError') return 'Голосовые сообщения сейчас недоступны. Напиши команду текстом.';
    if (error.name === 'VoiceAudioTooLargeError') return 'Голосовое слишком длинное. Запиши короче или напиши текстом.';
    if (error.name === 'VoiceAudioUnsupportedError') return 'Не получилось прочитать формат голосового. Напиши команду текстом.';
    if (error.name === 'VoiceProviderRequestError') return 'Не получилось распознать голосовое. Напиши команду текстом или попробуй позже.';
  }

  return 'Не получилось выполнить запрос. Попробуй ещё раз или напиши команду короче.';
}

function telegramUserToAuthUser(from: TelegramBotUser) {
  return {
    id: Number(from.id),
    first_name: from.first_name || 'Telegram user',
    last_name: from.last_name,
    username: from.username,
  };
}

async function ensureUser(from?: TelegramBotUser | null) {
  if (!from?.id || from.is_bot) return null;
  return authService.findOrCreateUser(telegramUserToAuthUser(from));
}

async function withIdempotency<T>(userId: string, key: string, payload: unknown, run: () => Promise<T>): Promise<{ result: T; cached: boolean }> {
  const trimmedKey = key.trim().slice(0, 128);
  if (!trimmedKey) return { result: await run(), cached: false };

  const requestHash = aiIdempotencyService.hashPayload(payload);
  const existing = await aiIdempotencyService.get(userId, 'telegram_bot_message', trimmedKey, requestHash);

  if (existing?.response && !existing.conflict) {
    return { result: existing.response as T, cached: true };
  }

  const result = await run();
  await aiIdempotencyService.save(userId, 'telegram_bot_message', trimmedKey, requestHash, result);
  return { result, cached: false };
}

async function sendLoginCode(chatId: number | string, from: TelegramBotUser) {
  const record = authService.createFallbackLoginCode(telegramUserToAuthUser(from));
  const ttlMs = Number(process.env.AUTH_FALLBACK_CODE_TTL_MS || 10 * 60 * 1000);
  const minutes = Math.max(1, Math.round(ttlMs / 60_000));

  await telegramBotClient.sendMessage(
    chatId,
    `Код входа: <b>${escapeHtml(record.code)}</b>\n\nОн действует ${minutes} минут. Не отправляй его другим людям.`,
  );

  return { handled: true, action: 'login_code_sent' };
}

async function sendStart(chatId: number | string) {
  await telegramBotClient.sendMessage(
    chatId,
    'Я могу принять расход или доход прямо здесь. Напиши обычной фразой, например: «Потратил на продукты» или «Получил зарплату».',
    buildOpenAppMarkup(),
  );

  return { handled: true, action: 'start_sent' };
}

function readAudioPayload(message: TelegramBotMessage) {
  if (message.voice?.file_id) {
    return {
      fileId: message.voice.file_id,
      mimeType: message.voice.mime_type || 'audio/ogg',
      originalName: `telegram-voice-${message.voice.file_unique_id || message.voice.file_id}.ogg`,
    };
  }

  if (message.audio?.file_id) {
    return {
      fileId: message.audio.file_id,
      mimeType: message.audio.mime_type || 'audio/mpeg',
      originalName: message.audio.file_name || `telegram-audio-${message.audio.file_unique_id || message.audio.file_id}.mp3`,
    };
  }

  return null;
}

async function transcribeTelegramAudio(message: TelegramBotMessage) {
  const audio = readAudioPayload(message);
  if (!audio) return null;

  const file = await telegramBotClient.getFile(audio.fileId);
  const buffer = await telegramBotClient.downloadFile(file.file_path || '');

  return voiceService.transcribe({
    buffer,
    mimeType: audio.mimeType,
    originalName: file.file_path?.split('/').pop() || audio.originalName,
    language: 'ru',
  });
}

async function runAiCommand(userId: string, command: string, source: 'text' | 'voice', idempotencyKey: string) {
  const payload = { command, source };
  const voiceUsageBefore = source === 'voice' ? await subscriptionService.assertVoiceCommandAllowed(userId) : null;

  const { result, cached } = await withIdempotency(userId, idempotencyKey, payload, async () => {
    const raw = await aiService.handleCommand(userId, command, source === 'voice'
      ? { execute: true, source: 'voice' }
      : { execute: true, source: 'text' });
    return aiResponseNormalizer.normalize(raw);
  });

  if (source === 'voice' && !cached && result.success && (result.executed || result.requiresConfirmation)) {
    await subscriptionService.recordUsage(userId, 'voiceCommands', {
      source: 'telegram_bot',
      intent: result.intent,
      executed: result.executed,
      requiresConfirmation: result.requiresConfirmation,
      voiceUsageBefore,
    });
  }

  return result;
}

async function handleFinancialMessage(message: TelegramBotMessage) {
  const chatId = getChatId(message);
  const from = message.from;
  if (!chatId || !from?.id || from.is_bot) return { handled: false, reason: 'NO_USER_OR_CHAT' };

  const user = await ensureUser(from);
  if (!user) return { handled: false, reason: 'USER_NOT_FOUND' };

  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const messageId = Number.isFinite(Number(message.message_id)) ? Number(message.message_id) : Date.now();

  if (text) {
    if (isLoginCommand(text)) return sendLoginCode(chatId, from);
    if (isStartCommand(text) || isHelpCommand(text)) return sendStart(chatId);

    if (isBotCommand(text)) {
      await telegramBotClient.sendMessage(chatId, 'Напиши расход или доход обычной фразой. Команды с косой чертой здесь не нужны.', buildOpenAppMarkup());
      return { handled: true, action: 'unknown_command_sent' };
    }

    try {
      const result = await runAiCommand(user.id, text, 'text', `text:${chatId}:${messageId}`);
      await telegramBotClient.sendMessage(
        chatId,
        buildResultText(result),
        result.requiresConfirmation && result.meta?.pendingActionId ? buildConfirmMarkup(result.meta.pendingActionId) : undefined,
      );
      return { handled: true, action: 'ai_text_handled', resultIntent: result.intent, executed: result.executed };
    } catch (error) {
      console.warn('[telegram-bot] text command failed', error instanceof Error ? error.message : error);
      await telegramBotClient.sendMessage(chatId, escapeHtml(getUserFacingError(error)), buildOpenAppMarkup());
      return { handled: true, action: 'ai_text_failed' };
    }
  }

  const audio = readAudioPayload(message);
  if (audio) {
    try {
      const transcript = await transcribeTelegramAudio(message);
      const command = transcript?.text?.trim() || '';

      if (!command) {
        await telegramBotClient.sendMessage(chatId, 'Не расслышала голосовое. Напиши команду текстом или попробуй записать ещё раз.');
        return { handled: true, action: 'voice_empty' };
      }

      const result = await runAiCommand(user.id, command, 'voice', `voice:${chatId}:${messageId}`);
      await telegramBotClient.sendMessage(
        chatId,
        buildResultText(result),
        result.requiresConfirmation && result.meta?.pendingActionId ? buildConfirmMarkup(result.meta.pendingActionId) : undefined,
      );
      return { handled: true, action: 'ai_voice_handled', resultIntent: result.intent, executed: result.executed };
    } catch (error) {
      console.warn('[telegram-bot] voice command failed', error instanceof Error ? error.message : error);
      await telegramBotClient.sendMessage(chatId, escapeHtml(getUserFacingError(error)), buildOpenAppMarkup());
      return { handled: true, action: 'ai_voice_failed' };
    }
  }

  await telegramBotClient.sendMessage(chatId, 'Сейчас я понимаю текстовые и голосовые сообщения. Напиши расход или доход обычной фразой.', buildOpenAppMarkup());
  return { handled: true, action: 'unsupported_message_sent' };
}

async function handleCallback(callback: TelegramBotCallbackQuery) {
  const chatId = getCallbackChatId(callback);
  const from = callback.from;
  const data = String(callback.data || '');

  if (!callback.id || !chatId || !from?.id || from.is_bot) return { handled: false, reason: 'NO_CALLBACK_CONTEXT' };

  const user = await ensureUser(from);
  if (!user) return { handled: false, reason: 'USER_NOT_FOUND' };

  let result: AIResult | null = null;

  if (data.startsWith(CALLBACK_CONFIRM)) {
    const pendingActionId = data.slice(CALLBACK_CONFIRM.length).trim();
    if (pendingActionId) {
      result = aiResponseNormalizer.normalize(await aiService.confirmCommand(user.id, pendingActionId));
      await telegramBotClient.answerCallbackQuery(callback.id, 'Подтверждено');
    }
  }

  if (data.startsWith(CALLBACK_CANCEL)) {
    const pendingActionId = data.slice(CALLBACK_CANCEL.length).trim();
    if (pendingActionId) {
      result = aiResponseNormalizer.normalize(await aiService.cancelCommand(user.id, pendingActionId));
      await telegramBotClient.answerCallbackQuery(callback.id, 'Отменено');
    }
  }

  if (!result) {
    await telegramBotClient.answerCallbackQuery(callback.id, 'Действие недоступно');
    return { handled: true, action: 'callback_ignored' };
  }

  await telegramBotClient.sendMessage(chatId, buildResultText(result));
  return { handled: true, action: 'callback_handled', resultIntent: result.intent, executed: result.executed };
}

export class TelegramBotService {
  async handleUpdate(update: TelegramBotUpdate) {
    if (update.callback_query) return handleCallback(update.callback_query);
    if (update.message) return handleFinancialMessage(update.message);
    if (update.edited_message) return { handled: false, reason: 'EDITED_MESSAGE_IGNORED' };
    return { handled: false, reason: 'UNSUPPORTED_UPDATE' };
  }

  async getLinkedUserCount() {
    return prisma.user.count();
  }
}

export const telegramBotService = new TelegramBotService();

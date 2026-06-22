import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { AuthService } from '../auth/service';
import { AIService } from '../ai/service';
import { aiIdempotencyService } from '../ai/ai-idempotency.service';
import { aiResponseNormalizer } from '../ai/ai-response-normalizer.service';
import { subscriptionService } from '../subscription/service';
import { voiceService } from '../../services/voice.service';
import { normalizeUserLocale, type UserLocale } from '../users/lib/user-locale';
import { botT, DEFAULT_BOT_LOCALE, getBotLanguageLabels } from './bot-locale';
import { telegramBotClient } from './telegram-client';
import type { AIResult } from '../ai/types';
import type { TelegramBotCallbackQuery, TelegramBotMessage, TelegramBotUpdate, TelegramBotUser } from './types';

const authService = new AuthService();
const aiService = new AIService();

const CALLBACK_PREFIX = 'fina:';
const CALLBACK_CONFIRM = `${CALLBACK_PREFIX}confirm:`;
const CALLBACK_CANCEL = `${CALLBACK_PREFIX}cancel:`;
const CALLBACK_LANGUAGE = `${CALLBACK_PREFIX}lang:`;
const CALLBACK_MENU = `${CALLBACK_PREFIX}menu:`;
const MAX_CALLBACK_ACTION_ID_LENGTH = 48;

type BotMenuPage = 'home' | 'plans' | 'features' | 'support' | 'terms';

const BOT_MENU_PAGES = new Set<BotMenuPage>(['home', 'plans', 'features', 'support', 'terms']);

function getStoredLocale(user: unknown): UserLocale | null {
  return normalizeUserLocale((user as { locale?: unknown } | null | undefined)?.locale);
}

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

function readCommand(text: string) {
  const value = text.trim();
  const [rawCommand = '', ...rest] = value.split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@[^\s]+$/, '');
  const payload = rest.join(' ').trim().toLowerCase();

  return { command, payload, value: value.toLowerCase() };
}

function isLoginCommand(text: string) {
  const { command, payload, value } = readCommand(text);
  return command === '/login' || value === 'код' || value === 'войти' || (command === '/start' && payload === 'login');
}

function isLanguageCommand(text: string) {
  const { command, value } = readCommand(text);
  return command === '/language' || command === '/settings' || value === 'language' || value === 'язык';
}

function isStartCommand(text: string) {
  const { command, payload } = readCommand(text);
  return command === '/start' && payload !== 'login';
}

function isHelpCommand(text: string) {
  const { command, value } = readCommand(text);
  return command === '/help' || value === 'help' || value === 'помощь';
}

function isTermsCommand(text: string) {
  const { command, value } = readCommand(text);
  return (
    command === '/terms'
    || command === '/agreement'
    || value === 'terms'
    || value === 'agreement'
    || value === 'условия'
    || value === 'соглашение'
    || value === 'пользовательское соглашение'
  );
}

function isSupportCommand(text: string) {
  const { command, value } = readCommand(text);
  return command === '/support' || value === 'support' || value === 'поддержка';
}

function isPlansCommand(text: string) {
  const { command, value } = readCommand(text);
  return (
    command === '/plans'
    || command === '/tariffs'
    || command === '/store'
    || value === 'тарифы'
    || value === 'магазин'
    || value === 'цены'
  );
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

function buildOpenAppMarkup(locale: UserLocale) {
  const miniAppUrl = getMiniAppUrl();
  if (!miniAppUrl) return undefined;
  return {
    inline_keyboard: [[
      { text: botT(locale, 'openApp'), web_app: { url: miniAppUrl } },
    ]],
  };
}

function getOptionalUrl(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

function normalizeMenuPage(value: unknown): BotMenuPage {
  const page = String(value || '').trim().toLowerCase() as BotMenuPage;
  return BOT_MENU_PAGES.has(page) ? page : 'home';
}

function buildMenuText(page: BotMenuPage, locale: UserLocale) {
  if (page === 'plans') {
    return [
      botT(locale, 'storefrontTitle'),
      '',
      botT(locale, 'storefrontIntro'),
      '',
      `• ${botT(locale, 'storefrontPremiumTitle')} — ${botT(locale, 'storefrontPremiumPrice')}`,
      botT(locale, 'storefrontPremiumDescription'),
      '',
      `• ${botT(locale, 'storefrontBusinessTitle')} — ${botT(locale, 'storefrontBusinessPrice')}`,
      botT(locale, 'storefrontBusinessDescription'),
      '',
      botT(locale, 'storefrontOneTimeTitle'),
      `• ${botT(locale, 'storefrontVoicePack')}`,
      `• ${botT(locale, 'storefrontReceiptPack')}`,
      '',
      botT(locale, 'storefrontOrderHint'),
    ].join('\n');
  }

  if (page === 'features') {
    return [
      botT(locale, 'featuresTitle'),
      '',
      `• ${botT(locale, 'featuresFinance')}`,
      `• ${botT(locale, 'featuresGoals')}`,
      `• ${botT(locale, 'featuresAnalytics')}`,
      `• ${botT(locale, 'featuresVoice')}`,
    ].join('\n');
  }

  if (page === 'support') {
    return [
      botT(locale, 'supportTitle'),
      '',
      botT(locale, 'supportText'),
    ].join('\n');
  }

  if (page === 'terms') {
    return [
      botT(locale, 'termsTitle'),
      '',
      botT(locale, 'termsIntro'),
      '',
      `1. ${botT(locale, 'termsUse')}`,
      `2. ${botT(locale, 'termsResponsibility')}`,
      `3. ${botT(locale, 'termsData')}`,
      `4. ${botT(locale, 'termsPayments')}`,
      `5. ${botT(locale, 'termsSafety')}`,
      '',
      botT(locale, 'termsAccept'),
    ].join('\n');
  }

  return [
    botT(locale, 'homeTitle'),
    '',
    botT(locale, 'homeIntro'),
    '',
    `• ${botT(locale, 'homePremiumLine')}`,
    `• ${botT(locale, 'homeBusinessLine')}`,
    '',
    botT(locale, 'homeHint'),
    botT(locale, 'homeAgreementHint'),
  ].join('\n');
}

function buildMenuMarkup(page: BotMenuPage, locale: UserLocale) {
  const miniAppUrl = getMiniAppUrl();
  const supportUrl = getOptionalUrl('TELEGRAM_SUPPORT_URL', 'SUPPORT_URL');
  const agreementUrl = getOptionalUrl('USER_AGREEMENT_URL', 'TERMS_URL', 'PRIVACY_POLICY_URL');
  const rows: Array<Array<{ text: string; callback_data?: string; web_app?: { url: string }; url?: string }>> = [];

  if (miniAppUrl) {
    rows.push([{ text: botT(locale, 'openApp'), web_app: { url: miniAppUrl } }]);
  }

  if (page === 'home') {
    rows.push([
      { text: botT(locale, 'menuPlans'), callback_data: `${CALLBACK_MENU}plans` },
      { text: botT(locale, 'menuFeatures'), callback_data: `${CALLBACK_MENU}features` },
    ]);
    rows.push([
      supportUrl
        ? { text: botT(locale, 'menuSupport'), url: supportUrl }
        : { text: botT(locale, 'menuSupport'), callback_data: `${CALLBACK_MENU}support` },
      agreementUrl
        ? { text: botT(locale, 'menuTerms'), url: agreementUrl }
        : { text: botT(locale, 'menuTerms'), callback_data: `${CALLBACK_MENU}terms` },
    ]);
  } else {
    rows.push([{ text: botT(locale, 'menuBack'), callback_data: `${CALLBACK_MENU}home` }]);
    if (page !== 'terms') {
      rows.push([
        agreementUrl
          ? { text: botT(locale, 'menuTerms'), url: agreementUrl }
          : { text: botT(locale, 'menuTerms'), callback_data: `${CALLBACK_MENU}terms` },
      ]);
    }
  }

  return rows.length ? { inline_keyboard: rows } : undefined;
}

function buildStorefrontMarkup(locale: UserLocale) {
  return buildMenuMarkup('home', locale);
}

function buildStorefrontText(locale: UserLocale) {
  return buildMenuText('home', locale);
}

function buildLanguageMarkup() {
  return {
    inline_keyboard: [[
      { text: getBotLanguageLabels().en, callback_data: `${CALLBACK_LANGUAGE}en` },
      { text: getBotLanguageLabels().ru, callback_data: `${CALLBACK_LANGUAGE}ru` },
    ]],
  };
}

function buildConfirmMarkup(pendingActionId: string, locale: UserLocale) {
  const safeId = pendingActionId.slice(0, MAX_CALLBACK_ACTION_ID_LENGTH);
  return {
    inline_keyboard: [[
      { text: botT(locale, 'confirm'), callback_data: `${CALLBACK_CONFIRM}${safeId}` },
      { text: botT(locale, 'cancel'), callback_data: `${CALLBACK_CANCEL}${safeId}` },
    ]],
  };
}

function buildResultText(result: AIResult, locale: UserLocale) {
  const message = compactText(result.message || '', 900);

  if (result.executed) {
    return `${botT(locale, 'done')} ${escapeHtml(message || botT(locale, 'written'))}`;
  }

  if (result.requiresConfirmation) {
    return `${botT(locale, 'checkAction')} ${escapeHtml(message || botT(locale, 'needConfirm'))}`;
  }

  if (result.intent === 'clarification') {
    return escapeHtml(message || botT(locale, 'clarify'));
  }

  if (!result.success) {
    return escapeHtml(message || botT(locale, 'failed'));
  }

  return escapeHtml(message || botT(locale, 'done'));
}

function getUserFacingError(error: unknown, locale: UserLocale) {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '');
    if (code === 'FORBIDDEN') return botT(locale, 'limitEnded');
    if (code === 'BAD_REQUEST') return botT(locale, 'badRequest');
    if (code === 'UNAUTHORIZED') return botT(locale, 'unauthorized');
  }

  if (error instanceof Error) {
    if (error.name === 'VoiceTranscriptionNotConfiguredError') return botT(locale, 'voiceUnavailable');
    if (error.name === 'VoiceAudioTooLargeError') return botT(locale, 'voiceTooLarge');
    if (error.name === 'VoiceAudioUnsupportedError') return botT(locale, 'voiceUnsupported');
    if (error.name === 'VoiceProviderRequestError') return botT(locale, 'voiceProvider');
  }

  return botT(locale, 'failed');
}

function telegramUserToAuthUser(from: TelegramBotUser) {
  return {
    id: Number(from.id),
    first_name: from.first_name || 'Telegram user',
    last_name: from.last_name,
    username: from.username,
    language_code: from.language_code,
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

async function sendLanguageChoice(chatId: number | string) {
  await telegramBotClient.sendMessage(
    chatId,
    `${escapeHtml(botT(DEFAULT_BOT_LOCALE, 'chooseLanguageTitle'))}\n\n${escapeHtml(botT(DEFAULT_BOT_LOCALE, 'chooseLanguageCaption'))}`,
    buildLanguageMarkup(),
  );

  return { handled: true, action: 'language_choice_sent' };
}

async function sendLoginCode(chatId: number | string, from: TelegramBotUser, locale: UserLocale) {
  const record = authService.createFallbackLoginCode(telegramUserToAuthUser(from));
  const ttlMs = Number(process.env.AUTH_FALLBACK_CODE_TTL_MS || 10 * 60 * 1000);
  const minutes = Math.max(1, Math.round(ttlMs / 60_000));

  await telegramBotClient.sendMessage(chatId, botT(locale, 'loginCode', { code: escapeHtml(record.code), minutes }));

  return { handled: true, action: 'login_code_sent' };
}

async function sendMenuPage(chatId: number | string, page: BotMenuPage, locale: UserLocale) {
  await telegramBotClient.sendMessage(
    chatId,
    escapeHtml(buildMenuText(page, locale)),
    buildMenuMarkup(page, locale),
  );

  return { handled: true, action: `${page}_menu_sent` };
}

async function sendStart(chatId: number | string, locale: UserLocale) {
  await telegramBotClient.sendMessage(
    chatId,
    escapeHtml(buildStorefrontText(locale)),
    buildStorefrontMarkup(locale),
  );

  return { handled: true, action: 'storefront_sent' };
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

async function transcribeTelegramAudio(message: TelegramBotMessage, locale: UserLocale) {
  const audio = readAudioPayload(message);
  if (!audio) return null;

  const file = await telegramBotClient.getFile(audio.fileId);
  const buffer = await telegramBotClient.downloadFile(file.file_path || '');

  return voiceService.transcribe({
    buffer,
    mimeType: audio.mimeType,
    originalName: file.file_path?.split('/').pop() || audio.originalName,
    language: locale,
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

  const storedLocale = getStoredLocale(user);
  const locale = storedLocale ?? normalizeUserLocale(from.language_code) ?? DEFAULT_BOT_LOCALE;
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const messageId = Number.isFinite(Number(message.message_id)) ? Number(message.message_id) : Date.now();

  if (text) {
    if (isStartCommand(text) || isHelpCommand(text)) {
      if (!storedLocale && normalizeUserLocale(from.language_code)) {
        await authService.updateUserLocale(user.id, locale);
      }
      return sendStart(chatId, locale);
    }
    if (isPlansCommand(text)) {
      if (!storedLocale && normalizeUserLocale(from.language_code)) {
        await authService.updateUserLocale(user.id, locale);
      }
      return sendMenuPage(chatId, 'plans', locale);
    }
    if (isTermsCommand(text)) {
      if (!storedLocale && normalizeUserLocale(from.language_code)) {
        await authService.updateUserLocale(user.id, locale);
      }
      return sendMenuPage(chatId, 'terms', locale);
    }
    if (isSupportCommand(text)) {
      if (!storedLocale && normalizeUserLocale(from.language_code)) {
        await authService.updateUserLocale(user.id, locale);
      }
      return sendMenuPage(chatId, 'support', locale);
    }
    if (isLanguageCommand(text)) return sendLanguageChoice(chatId);
    if (isLoginCommand(text)) return sendLoginCode(chatId, from, locale);
    if (!storedLocale) return sendLanguageChoice(chatId);

    if (isBotCommand(text)) {
      await telegramBotClient.sendMessage(chatId, escapeHtml(botT(locale, 'unknownCommand')), buildOpenAppMarkup(locale));
      return { handled: true, action: 'unknown_command_sent' };
    }

    try {
      const result = await runAiCommand(user.id, text, 'text', `text:${chatId}:${messageId}`);
      await telegramBotClient.sendMessage(
        chatId,
        buildResultText(result, locale),
        result.requiresConfirmation && result.meta?.pendingActionId ? buildConfirmMarkup(result.meta.pendingActionId, locale) : undefined,
      );
      return { handled: true, action: 'ai_text_handled', resultIntent: result.intent, executed: result.executed };
    } catch (error) {
      console.warn('[telegram-bot] text command failed', error instanceof Error ? error.message : error);
      await telegramBotClient.sendMessage(chatId, escapeHtml(getUserFacingError(error, locale)), buildOpenAppMarkup(locale));
      return { handled: true, action: 'ai_text_failed' };
    }
  }

  const audio = readAudioPayload(message);
  if (audio) {
    if (!storedLocale) return sendLanguageChoice(chatId);

    try {
      const transcript = await transcribeTelegramAudio(message, locale);
      const command = transcript?.text?.trim() || '';

      if (!command) {
        await telegramBotClient.sendMessage(chatId, escapeHtml(botT(locale, 'voiceEmpty')));
        return { handled: true, action: 'voice_empty' };
      }

      const result = await runAiCommand(user.id, command, 'voice', `voice:${chatId}:${messageId}`);
      await telegramBotClient.sendMessage(
        chatId,
        buildResultText(result, locale),
        result.requiresConfirmation && result.meta?.pendingActionId ? buildConfirmMarkup(result.meta.pendingActionId, locale) : undefined,
      );
      return { handled: true, action: 'ai_voice_handled', resultIntent: result.intent, executed: result.executed };
    } catch (error) {
      console.warn('[telegram-bot] voice command failed', error instanceof Error ? error.message : error);
      await telegramBotClient.sendMessage(chatId, escapeHtml(getUserFacingError(error, locale)), buildOpenAppMarkup(locale));
      return { handled: true, action: 'ai_voice_failed' };
    }
  }

  if (!storedLocale) return sendLanguageChoice(chatId);

  await telegramBotClient.sendMessage(chatId, escapeHtml(botT(locale, 'unsupportedMessage')), buildOpenAppMarkup(locale));
  return { handled: true, action: 'unsupported_message_sent' };
}

async function handleCallback(callback: TelegramBotCallbackQuery) {
  const chatId = getCallbackChatId(callback);
  const from = callback.from;
  const data = String(callback.data || '');

  if (!callback.id || !chatId || !from?.id || from.is_bot) return { handled: false, reason: 'NO_CALLBACK_CONTEXT' };

  const user = await ensureUser(from);
  if (!user) return { handled: false, reason: 'USER_NOT_FOUND' };

  if (data.startsWith(CALLBACK_LANGUAGE)) {
    const locale = normalizeUserLocale(data.slice(CALLBACK_LANGUAGE.length)) ?? DEFAULT_BOT_LOCALE;
    const updatedUser = await authService.updateUserLocale(user.id, locale);
    const nextLocale = getStoredLocale(updatedUser) ?? locale;

    await telegramBotClient.answerCallbackQuery(callback.id, botT(nextLocale, 'languageSaved'));
    await sendStart(chatId, nextLocale);

    return { handled: true, action: 'language_saved', locale: nextLocale };
  }

  const locale = getStoredLocale(user) ?? DEFAULT_BOT_LOCALE;

  if (data.startsWith(CALLBACK_MENU)) {
    const page = normalizeMenuPage(data.slice(CALLBACK_MENU.length));
    await telegramBotClient.answerCallbackQuery(callback.id);

    if (callback.message?.message_id) {
      await telegramBotClient.editMessageText(
        chatId,
        callback.message.message_id,
        escapeHtml(buildMenuText(page, locale)),
        buildMenuMarkup(page, locale),
      );
    } else {
      await telegramBotClient.sendMessage(chatId, escapeHtml(buildMenuText(page, locale)), buildMenuMarkup(page, locale));
    }

    return { handled: true, action: `${page}_menu_opened` };
  }
  let result: AIResult | null = null;

  if (data.startsWith(CALLBACK_CONFIRM)) {
    const pendingActionId = data.slice(CALLBACK_CONFIRM.length).trim();
    if (pendingActionId) {
      result = aiResponseNormalizer.normalize(await aiService.confirmCommand(user.id, pendingActionId));
      await telegramBotClient.answerCallbackQuery(callback.id, botT(locale, 'confirmed'));
    }
  }

  if (data.startsWith(CALLBACK_CANCEL)) {
    const pendingActionId = data.slice(CALLBACK_CANCEL.length).trim();
    if (pendingActionId) {
      result = aiResponseNormalizer.normalize(await aiService.cancelCommand(user.id, pendingActionId));
      await telegramBotClient.answerCallbackQuery(callback.id, botT(locale, 'cancelled'));
    }
  }

  if (!result) {
    await telegramBotClient.answerCallbackQuery(callback.id, botT(locale, 'unavailable'));
    return { handled: true, action: 'callback_ignored' };
  }

  await telegramBotClient.sendMessage(chatId, buildResultText(result, locale));
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

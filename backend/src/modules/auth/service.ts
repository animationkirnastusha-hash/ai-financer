import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import type { TelegramInitDataUser } from '../../shared/utils/telegramAuth';
import { createPublicUserId } from '../users/lib/public-user-id';
import { normalizeUserLocale, readUserLocale, writeUserLocale, type UserLocale } from '../users/lib/user-locale';

type SerializableUser = {
  id: string;
  telegramId: bigint;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  tier?: string;
  isAdmin?: boolean;
  locale?: string | null;
};

type FallbackLoginCodeRecord = {
  code: string;
  telegramUser: TelegramInitDataUser;
  expiresAt: number;
  attempts: number;
  createdAt: number;
};

type TelegramBotUpdate = {
  message?: {
    message_id?: number;
    text?: string;
    chat?: {
      id?: number | string;
    };
    from?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
};

const fallbackCodes = new Map<string, FallbackLoginCodeRecord>();
const fallbackLastCreatedByTelegramId = new Map<number, number>();

const FALLBACK_CODE_TTL_MS = Number(process.env.AUTH_FALLBACK_CODE_TTL_MS || 10 * 60 * 1000);
const FALLBACK_CODE_COOLDOWN_MS = Number(process.env.AUTH_FALLBACK_CODE_COOLDOWN_MS || 20 * 1000);
const FALLBACK_CODE_MAX_ATTEMPTS = Number(process.env.AUTH_FALLBACK_CODE_MAX_ATTEMPTS || 5);

function nowMs() {
  return Date.now();
}

function cleanupFallbackCodes() {
  const current = nowMs();

  for (const [code, record] of fallbackCodes.entries()) {
    if (record.expiresAt <= current || record.attempts >= FALLBACK_CODE_MAX_ATTEMPTS) {
      fallbackCodes.delete(code);
    }
  }
}

function createNumericCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function normalizeCode(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{
    text: string;
    url?: string;
    web_app?: { url: string };
  }>>;
};

function getMiniAppUrl() {
  return (
    process.env.TELEGRAM_MINI_APP_URL?.trim()
    || process.env.TELEGRAM_WEB_APP_URL?.trim()
    || process.env.FRONTEND_URL?.trim()
    || ''
  );
}

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: TelegramReplyMarkup) {
  if (!env.telegramBotToken) {
    return { ok: false, reason: 'TELEGRAM_BOT_TOKEN_MISSING' };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    return { ok: false, reason: payload || `HTTP_${response.status}` };
  }

  return { ok: true };
}

export class AuthService {
  async findOrCreateUser(telegramUser: TelegramInitDataUser) {
    const telegramId = BigInt(telegramUser.id);
    const telegramIdString = telegramUser.id.toString();
    const firstName = telegramUser.first_name || 'Telegram user';
    const isEnvAdmin = env.adminTelegramIds.includes(telegramIdString);

    const user = await prisma.user.upsert({
      where: {
        telegramId,
      },
      update: {
        username: telegramUser.username ?? null,
        firstName,
        lastName: telegramUser.last_name ?? null,
        photoUrl: telegramUser.photo_url ?? null,
        ...(isEnvAdmin ? { isAdmin: true } : {}),
      },
      create: {
        telegramId,
        username: telegramUser.username ?? null,
        firstName,
        lastName: telegramUser.last_name ?? null,
        photoUrl: telegramUser.photo_url ?? null,
        isAdmin: isEnvAdmin,
      },
    });

    return this.hydrateUserLocale(user);
  }

  async hydrateUserLocale<T extends { id: string }>(user: T): Promise<T & { locale: UserLocale | null }> {
    const locale = await readUserLocale(user.id);
    return { ...user, locale };
  }

  async updateUserLocale(userId: string, rawLocale: unknown) {
    const locale = normalizeUserLocale(rawLocale);
    if (!locale) return null;

    await writeUserLocale(userId, locale);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user ? this.hydrateUserLocale(user) : null;
  }

  generateToken(userId: string) {
    const signOptions: SignOptions = {
      expiresIn: (process.env.AUTH_ACCESS_TOKEN_TTL || '12h') as SignOptions['expiresIn'],
      issuer: process.env.AUTH_JWT_ISSUER || 'ai-financer-api',
      audience: process.env.AUTH_JWT_AUDIENCE || 'ai-financer-web',
    };

    return jwt.sign(
      {
        userId,
        sub: userId,
        jti: crypto.randomUUID(),
      },
      env.jwtSecret,
      signOptions,
    );
  }

  serializeUser(user: SerializableUser) {
    const telegramId = user.telegramId.toString();
    const isAdmin = Boolean(user.isAdmin) || env.adminTelegramIds.includes(telegramId);
    const locale = normalizeUserLocale(user.locale);

    return {
      id: user.id,
      publicId: createPublicUserId(user),
      telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      tier: user.tier,
      isAdmin,
      locale,
    };
  }

  getFallbackInfo() {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '').trim() || '';
    const botUrl = process.env.TELEGRAM_BOT_URL?.trim() || (botUsername ? `https://t.me/${botUsername}` : '');

    return {
      enabled: Boolean(env.telegramBotToken),
      botUsername: botUsername ? `@${botUsername}` : null,
      botUrl: botUrl || null,
      ttlSeconds: Math.max(60, Math.round(FALLBACK_CODE_TTL_MS / 1000)),
    };
  }

  createFallbackLoginCode(telegramUser: TelegramInitDataUser) {
    cleanupFallbackCodes();

    const current = nowMs();
    const lastCreatedAt = fallbackLastCreatedByTelegramId.get(telegramUser.id) || 0;

    if (current - lastCreatedAt < FALLBACK_CODE_COOLDOWN_MS) {
      const active = [...fallbackCodes.values()].find(
        (record) => record.telegramUser.id === telegramUser.id && record.expiresAt > current,
      );

      if (active) {
        return active;
      }
    }

    let code = createNumericCode();
    while (fallbackCodes.has(code)) {
      code = createNumericCode();
    }

    const record: FallbackLoginCodeRecord = {
      code,
      telegramUser,
      expiresAt: current + FALLBACK_CODE_TTL_MS,
      attempts: 0,
      createdAt: current,
    };

    fallbackCodes.set(code, record);
    fallbackLastCreatedByTelegramId.set(telegramUser.id, current);

    return record;
  }

  async verifyFallbackLoginCode(rawCode: unknown) {
    cleanupFallbackCodes();

    const code = normalizeCode(rawCode);
    if (code.length !== 6) {
      return null;
    }

    const record = fallbackCodes.get(code);
    if (!record) {
      return null;
    }

    record.attempts += 1;

    if (record.expiresAt <= nowMs() || record.attempts > FALLBACK_CODE_MAX_ATTEMPTS) {
      fallbackCodes.delete(code);
      return null;
    }

    fallbackCodes.delete(code);

    return this.findOrCreateUser(record.telegramUser);
  }

  async handleFallbackTelegramUpdate(update: TelegramBotUpdate) {
    const message = update.message;
    const from = message?.from;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() || '';

    if (!from?.id || !chatId) {
      return { handled: false, reason: 'NO_TELEGRAM_USER' };
    }

    const lower = text.toLowerCase();
    const wantsLoginCode = lower === '/login' || lower.startsWith('/start login') || lower === 'код' || lower === 'войти';
    const wantsStart = lower === '/start' || (lower.startsWith('/start ') && !lower.startsWith('/start login'));

    if (!wantsLoginCode) {
      const miniAppUrl = getMiniAppUrl();

      await sendTelegramMessage(
        chatId,
        wantsStart
          ? 'Welcome to Fina. Open the Mini App to manage accounts, expenses, goals and reports. Send /login if you need a one-time login code.'
          : 'Open Fina from Telegram to manage money in the Mini App. Send /login if you need a one-time login code.',
        miniAppUrl
          ? {
              inline_keyboard: [[
                { text: 'Open Fina', web_app: { url: miniAppUrl } },
              ]],
            }
          : undefined,
      );

      return { handled: true, action: wantsStart ? 'start_sent' : 'help_sent' };
    }

    const record = this.createFallbackLoginCode({
      id: from.id,
      first_name: from.first_name || 'Telegram user',
      last_name: from.last_name,
      username: from.username,
      photo_url: from.photo_url,
    });

    const minutes = Math.max(1, Math.round(FALLBACK_CODE_TTL_MS / 60_000));

    await sendTelegramMessage(
      chatId,
      `Fina login code: <b>${record.code}</b>\n\nIt is valid for ${minutes} minutes. Do not share this code.`,
    );

    return { handled: true, action: 'code_sent' };
  }
}

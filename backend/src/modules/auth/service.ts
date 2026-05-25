import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import type { TelegramInitDataUser } from '../../shared/utils/telegramAuth';

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

async function sendTelegramMessage(chatId: number | string, text: string) {
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

    return prisma.user.upsert({
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
  }

  generateToken(userId: string) {
    return jwt.sign(
      {
        userId,
      },
      env.jwtSecret,
      {
        expiresIn: '30d',
      },
    );
  }

  serializeUser(user: {
    id: string;
    telegramId: bigint;
    username: string | null;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    tier?: string;
    isAdmin?: boolean;
  }) {
    const telegramId = user.telegramId.toString();
    const isAdmin = Boolean(user.isAdmin) || env.adminTelegramIds.includes(telegramId);

    return {
      id: user.id,
      telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
      tier: user.tier,
      isAdmin,
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

    if (!wantsLoginCode) {
      await sendTelegramMessage(
        chatId,
        'Для входа в AI-financer через сторонний Telegram-клиент отправь /login. Я пришлю одноразовый код.',
      );

      return { handled: true, action: 'help_sent' };
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
      `Код входа в AI-financer: <b>${record.code}</b>\n\nОн действует ${minutes} минут. Никому не пересылай этот код.`,
    );

    return { handled: true, action: 'code_sent' };
  }
}

import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import type { TelegramInitDataUser } from '../../shared/utils/telegramAuth';

export class AuthService {
  async findOrCreateUser(telegramUser: TelegramInitDataUser) {
    const telegramId = BigInt(telegramUser.id);
    const firstName = telegramUser.first_name || 'Telegram user';

    return prisma.user.upsert({
      where: {
        telegramId,
      },
      update: {
        username: telegramUser.username ?? null,
        firstName,
        lastName: telegramUser.last_name ?? null,
        photoUrl: telegramUser.photo_url ?? null,
      },
      create: {
        telegramId,
        username: telegramUser.username ?? null,
        firstName,
        lastName: telegramUser.last_name ?? null,
        photoUrl: telegramUser.photo_url ?? null,
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
  }) {
    const telegramId = user.telegramId.toString();
    const isAdmin = telegramId === String(env.adminTelegramId);

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
}
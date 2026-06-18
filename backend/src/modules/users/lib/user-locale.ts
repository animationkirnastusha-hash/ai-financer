import { prisma } from '../../../lib/prisma';

export type UserLocale = 'en' | 'ru';

export function normalizeUserLocale(value: unknown): UserLocale | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'ru' || raw === 'russian' || raw.startsWith('ru-') || raw.startsWith('ru_')) return 'ru';
  if (raw === 'en' || raw === 'english' || raw.startsWith('en-') || raw.startsWith('en_')) return 'en';
  return null;
}

export async function readUserLocale(userId: string): Promise<UserLocale | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ locale: string | null }>>`
      SELECT locale FROM "User" WHERE id = ${userId} LIMIT 1
    `;
    return normalizeUserLocale(rows[0]?.locale ?? null);
  } catch {
    return null;
  }
}

export async function writeUserLocale(userId: string, locale: UserLocale): Promise<UserLocale> {
  await prisma.$executeRaw`
    UPDATE "User" SET locale = ${locale}, updatedAt = CURRENT_TIMESTAMP WHERE id = ${userId}
  `;
  return locale;
}

#!/usr/bin/env node
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ override: true });

const prisma = new PrismaClient();

function readTelegramId() {
  const raw = process.env.TEST_TELEGRAM_ID || process.env.DEV_TELEGRAM_ID || process.env.ADMIN_TELEGRAM_ID || '1001';
  const parsed = BigInt(String(raw));
  if (parsed <= 0n) throw new Error('TEST_TELEGRAM_ID must be a positive integer');
  return parsed;
}

function readAdminTelegramIds() {
  const values = [process.env.ADMIN_TELEGRAM_ID, ...(process.env.ADMIN_TELEGRAM_IDS || '').split(',')]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return new Set(values);
}

function readJwtOptions() {
  return {
    expiresIn: process.env.TEST_AUTH_TOKEN_TTL || process.env.AUTH_ACCESS_TOKEN_TTL || '30d',
    issuer: process.env.AUTH_JWT_ISSUER || 'ai-financer-api',
    audience: process.env.AUTH_JWT_AUDIENCE || 'ai-financer-web',
  };
}

async function main() {
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
  const telegramId = readTelegramId();
  const telegramIdText = telegramId.toString();
  const adminIds = readAdminTelegramIds();
  const isAdmin = process.env.TEST_ADMIN === '1' || adminIds.has(telegramIdText);

  const user = await prisma.user.upsert({
    where: { telegramId },
    update: {
      firstName: isAdmin ? 'Admin' : 'Test',
      lastName: 'User',
      username: isAdmin ? 'admin_test' : `test_${telegramIdText}`,
      isAdmin,
    },
    create: {
      telegramId,
      firstName: isAdmin ? 'Admin' : 'Test',
      lastName: 'User',
      username: isAdmin ? 'admin_test' : `test_${telegramIdText}`,
      isAdmin,
    },
  });

  const token = jwt.sign(
    {
      userId: user.id,
      sub: user.id,
      jti: crypto.randomUUID(),
    },
    jwtSecret,
    readJwtOptions(),
  );

  const tokenPath = join(process.cwd(), '.test-auth-token');
  const envPath = join(process.cwd(), '.test-auth-token.env');
  writeFileSync(tokenPath, `${token}\n`, 'utf8');
  writeFileSync(envPath, `TEST_AUTH_TOKEN=${token}\nTEST_TELEGRAM_ID=${telegramIdText}\nTEST_ADMIN=${isAdmin ? '1' : '0'}\n`, 'utf8');

  console.log(token);
  console.error(`Created/found test user: ${user.id} telegramId=${telegramIdText} admin=${user.isAdmin}`);
  console.error(`Saved token to: ${tokenPath}`);
  console.error(`Saved env snippet to: ${envPath}`);
  console.error('Run without pasting token: TEST_ADMIN=1 npm run test:base-ai');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../../../lib/prisma';
import { AIAnalyticsService } from '../ai-analytics.service';
import { AIPremiumService } from '../ai-premium.service';

async function resetDb() {
  await prisma.aIPremiumCapability.deleteMany();
  await prisma.aICompanionEvent.deleteMany();
  await prisma.aISessionState.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.userAISettings.deleteMany();
  await prisma.onboardingState.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser() {
  return prisma.user.create({
    data: {
      telegramId: BigInt(Date.now() + Math.floor(Math.random() * 100000)),
      firstName: 'Test',
      username: `mega_${Math.floor(Math.random() * 1000000)}`,
    },
  });
}

test.after(async () => {
  await prisma.$disconnect();
});

test('mega foundation: analytics summarizes transactions', async () => {
  await resetDb();
  const user = await createUser();
  const account = await prisma.account.create({
    data: { userId: user.id, name: 'Карта', type: 'card', currency: 'RUB', balance: 700 },
  });

  await prisma.transaction.createMany({
    data: [
      { userId: user.id, accountId: account.id, amount: 1000, type: 'income', description: 'Доход', isAIGenerated: true },
      { userId: user.id, accountId: account.id, amount: 300, type: 'expense', description: 'Кофе', isAIGenerated: true },
    ],
  });

  const analytics = await new AIAnalyticsService().query(user.id, { period: 'month', metric: 'summary' }) as { totals: { income: number; expenses: number; net: number } };

  assert.equal(analytics.totals.income, 1000);
  assert.equal(analytics.totals.expenses, 300);
  assert.equal(analytics.totals.net, 700);
});

test('mega foundation: premium capabilities expose free and premium boundaries', async () => {
  await resetDb();
  const user = await createUser();

  const result = await new AIPremiumService().getCapabilities(user.id);

  assert.equal(result.tier, 'FREE');
  assert.ok(result.capabilities.some((item) => item.key === 'basic_ai_control' && item.enabled));
  assert.ok(result.capabilities.some((item) => item.key === 'advanced_memory' && !item.enabled));
});

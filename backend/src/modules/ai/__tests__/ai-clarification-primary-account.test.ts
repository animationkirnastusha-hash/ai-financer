import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../../../lib/prisma';
import { AIValidatorService } from '../ai-validator.service';
import { AIActionPlan } from '../types';

const validator = new AIValidatorService();

async function resetDb() {
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.aIPendingAction.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser() {
  return prisma.user.create({
    data: {
      telegramId: BigInt(Date.now() + Math.floor(Math.random() * 100000)),
      firstName: 'Test',
      username: `clar_${Math.floor(Math.random() * 1000000)}`,
    },
  });
}

test.after(async () => {
  await prisma.$disconnect();
});

test('validator asks account clarification for expense without account when user has multiple accounts', async () => {
  await resetDb();
  const user = await createUser();
  await prisma.account.create({ data: { userId: user.id, name: 'Основная карта', type: 'card', currency: 'RUB', balance: 10000 } });
  await prisma.account.create({ data: { userId: user.id, name: 'Наличка', type: 'cash', currency: 'RUB', balance: 10000 } });

  const plan: AIActionPlan = {
    mode: 'actions',
    actions: [{
      tool: 'create_transaction',
      input: { kind: 'expense', amount: 300, category: 'Кофе', description: 'Кофе', currency: 'RUB', __userText: 'кофе 300' },
    }],
  };

  const result = await validator.validate(user.id, plan);
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.code === 'needs_account_clarification'), true);
});

test('validator resolves primary account alias for transfer', async () => {
  await resetDb();
  const user = await createUser();
  const main = await prisma.account.create({ data: { userId: user.id, name: 'Карта', type: 'card', currency: 'RUB', balance: 10000 } });
  const cash = await prisma.account.create({ data: { userId: user.id, name: 'Наличка', type: 'cash', currency: 'RUB', balance: 0 } });

  const plan: AIActionPlan = {
    mode: 'actions',
    actions: [{
      tool: 'transfer_money',
      input: { fromAccount: 'основной счет', toAccount: 'наличка', amount: 1000, currency: 'RUB', description: 'Перевод', __userText: 'переведи 1000 с основного на наличку' },
    }],
  };

  const result = await validator.validate(user.id, plan);
  assert.equal(result.ok, true);
  assert.equal(result.actions[0].resolved?.fromAccountId, main.id);
  assert.equal(result.actions[0].resolved?.toAccountId, cash.id);
});

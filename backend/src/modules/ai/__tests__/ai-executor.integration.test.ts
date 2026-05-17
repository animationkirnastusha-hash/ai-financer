import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../../../lib/prisma';
import { AIExecutorService } from '../ai-executor.service';
import { AIParsedCommand, AIValidatedAction } from '../types';

const executor = new AIExecutorService();

async function resetDb() {
  await prisma.transaction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.aIPendingAction.deleteMany();
  await prisma.aIAuditLog.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser() {
  return prisma.user.create({
    data: {
      telegramId: BigInt(Date.now() + Math.floor(Math.random() * 100000)),
      firstName: 'Test',
      username: `test_${Math.floor(Math.random() * 1000000)}`,
    },
  });
}

function action(tool: AIValidatedAction['tool'], input: Record<string, unknown>, resolved: Record<string, unknown> = {}): AIValidatedAction {
  return {
    tool,
    input,
    resolved,
    riskLevel: 'low',
    requiresConfirmation: false,
  };
}

function parsed(summary: string, actions: AIValidatedAction[]): AIParsedCommand {
  return { intent: 'batch', summary, actions };
}

test.after(async () => {
  await prisma.$disconnect();
});

test('executor: income increments balance and creates transaction', async () => {
  await resetDb();
  const user = await createUser();
  const account = await prisma.account.create({
    data: { userId: user.id, name: 'Основной', type: 'card', currency: 'RUB', balance: 0 },
  });

  const result = await executor.execute(user.id, parsed('Доход 30000', [
    action('create_transaction', {
      kind: 'income',
      amount: 30000,
      account: 'Основной',
      category: 'Доход',
      description: 'Доход',
      currency: 'RUB',
    }, {
      accountId: account.id,
      accountCurrency: 'RUB',
      amountInAccountCurrency: 30000,
    }),
  ]));

  const updated = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  const txCount = await prisma.transaction.count({ where: { userId: user.id, type: 'income', amount: 30000 } });

  assert.equal(updated.balance, 30000);
  assert.equal(txCount, 1);
  assert.equal(result.actionsCount, 1);
});

test('executor: expense decrements balance and blocks overdraft', async () => {
  await resetDb();
  const user = await createUser();
  const account = await prisma.account.create({
    data: { userId: user.id, name: 'Наличка', type: 'cash', currency: 'RUB', balance: 500 },
  });

  await executor.execute(user.id, parsed('Кофе 300', [
    action('create_transaction', {
      kind: 'expense',
      amount: 300,
      account: 'Наличка',
      category: 'Кофе',
      description: 'Кофе',
      currency: 'RUB',
    }, {
      accountId: account.id,
      accountCurrency: 'RUB',
      amountInAccountCurrency: 300,
    }),
  ]));

  const updated = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(updated.balance, 200);

  await assert.rejects(
    () => executor.execute(user.id, parsed('Большой расход', [
      action('create_transaction', {
        kind: 'expense',
        amount: 1000,
        account: 'Наличка',
        category: 'Расход',
        description: 'Расход',
        currency: 'RUB',
      }, {
        accountId: account.id,
        accountCurrency: 'RUB',
        amountInAccountCurrency: 1000,
      }),
    ])),
    /Недостаточно средств|Insufficient funds/,
  );

  const afterFailed = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(afterFailed.balance, 200);
});

test('executor: create account + income batch does not double initialBalance', async () => {
  await resetDb();
  const user = await createUser();

  await executor.execute(user.id, parsed('Создать счет тест и положить 5000', [
    action('create_account', {
      name: 'Тест',
      type: 'cash',
      currency: 'RUB',
      initialBalance: 0,
    }),
    action('create_transaction', {
      kind: 'income',
      amount: 5000,
      account: 'Тест',
      category: 'Пополнение',
      description: 'Пополнение',
      currency: 'RUB',
    }, {
      pendingAccountName: 'Тест',
      accountCurrency: 'RUB',
      amountInAccountCurrency: 5000,
    }),
  ]));

  const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id, name: 'Тест' } });
  const txs = await prisma.transaction.findMany({ where: { userId: user.id, accountId: account.id } });

  assert.equal(account.balance, 5000);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].amount, 5000);
});

test('executor: transfer decrements source and increments destination', async () => {
  await resetDb();
  const user = await createUser();
  const from = await prisma.account.create({
    data: { userId: user.id, name: 'Карта', type: 'card', currency: 'RUB', balance: 5000 },
  });
  const to = await prisma.account.create({
    data: { userId: user.id, name: 'Наличка', type: 'cash', currency: 'RUB', balance: 100 },
  });

  await executor.execute(user.id, parsed('Перевод 1000', [
    action('transfer_money', {
      fromAccount: 'Карта',
      toAccount: 'Наличка',
      amount: 1000,
      currency: 'RUB',
      description: 'Перевод',
    }, {
      fromAccountId: from.id,
      toAccountId: to.id,
      amountInFromCurrency: 1000,
    }),
  ]));

  const updatedFrom = await prisma.account.findUniqueOrThrow({ where: { id: from.id } });
  const updatedTo = await prisma.account.findUniqueOrThrow({ where: { id: to.id } });
  const tx = await prisma.transaction.findFirstOrThrow({ where: { userId: user.id, type: 'transfer' } });

  assert.equal(updatedFrom.balance, 4000);
  assert.equal(updatedTo.balance, 1100);
  assert.equal(tx.amount, 1000);
  assert.equal(tx.accountId, from.id);
  assert.equal(tx.toAccountId, to.id);
});

test('executor: pending action status is confirmed once after execution', async () => {
  await resetDb();
  const user = await createUser();
  const account = await prisma.account.create({
    data: { userId: user.id, name: 'Основной', type: 'card', currency: 'RUB', balance: 0 },
  });

  const pending = await prisma.aIPendingAction.create({
    data: {
      userId: user.id,
      command: 'доход 100',
      intent: 'batch',
      riskLevel: 'low',
      parsed: '{}',
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  await executor.execute(user.id, parsed('Доход 100', [
    action('create_transaction', {
      kind: 'income',
      amount: 100,
      account: 'Основной',
      category: 'Доход',
      description: 'Доход',
      currency: 'RUB',
    }, {
      accountId: account.id,
      accountCurrency: 'RUB',
      amountInAccountCurrency: 100,
    }),
  ]), { pendingActionId: pending.id });

  const updatedPending = await prisma.aIPendingAction.findUniqueOrThrow({ where: { id: pending.id } });
  const updatedAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });

  assert.equal(updatedPending.status, 'confirmed');
  assert.ok(updatedPending.confirmedAt);
  assert.equal(updatedAccount.balance, 100);
});

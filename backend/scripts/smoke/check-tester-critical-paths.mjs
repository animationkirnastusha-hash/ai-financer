import { runSmoke } from './lib/test-context.mjs';
import { requestJson, unwrapArray } from './lib/http-client.mjs';

function requireId(value, label) {
  if (!value || typeof value !== 'string') throw new Error(`${label}: id is missing`);
  return value;
}

function assertAmount(actual, expected, label) {
  const diff = Math.abs(Number(actual) - Number(expected));
  if (!Number.isFinite(Number(actual)) || diff > 0.01) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertNonEmpty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is empty`);
}

function getGoalAccountId(goal) {
  return goal?.accountId || goal?.account?.id || null;
}

async function getAccountBalance(context, accountId) {
  const response = await requestJson(context, `/accounts/${accountId}`);
  const account = response.payload?.account;
  requireId(account?.id, 'account');
  return Number(account.balance);
}

async function createAccount(context, name, balance, type = 'cash') {
  const response = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name,
      type,
      currency: 'RUB',
      balance,
      showInTotalBalance: true,
    },
  });

  const account = response.payload?.account;
  requireId(account?.id, `account ${name}`);
  assertAmount(account.balance, balance, `initial balance for ${name}`);
  return account;
}

async function createSection(context, name) {
  const response = await requestJson(context, '/sections', {
    method: 'POST',
    expected: [201],
    body: { name, icon: '•', color: '#64748b' },
  });
  const section = response.payload?.section;
  requireId(section?.id, `section ${name}`);
  assertNonEmpty(section.name, 'section name');
  return section;
}

async function createCategory(context, name, sectionId) {
  const response = await requestJson(context, '/categories', {
    method: 'POST',
    expected: [201],
    body: { name, type: 'expense', sectionId, icon: '☕', color: '#f59e0b' },
  });
  const category = response.payload?.category;
  requireId(category?.id, `category ${name}`);
  assertNonEmpty(category.name, 'category name');
  if (category.sectionId !== sectionId) throw new Error('category lost section link');
  return category;
}

async function createTransaction(context, body, label) {
  const response = await requestJson(context, '/transactions', {
    method: 'POST',
    expected: [201],
    body,
  });
  const transaction = response.payload?.transaction;
  requireId(transaction?.id, label);
  assertNonEmpty(transaction.title, `${label} title`);
  return transaction;
}

await runSmoke('tester-critical-paths', async (context) => {
  const cash = await createAccount(context, `Тест наличные ${context.suffix}`, 50000, 'cash');
  const card = await createAccount(context, `Тест карта ${context.suffix}`, 25000, 'card');
  const section = await createSection(context, `Кафе ${context.suffix}`);
  const category = await createCategory(context, `Кофе ${context.suffix}`, section.id);

  const expense = await createTransaction(context, {
    accountId: cash.id,
    categoryId: category.id,
    sectionId: section.id,
    type: 'expense',
    amount: 450,
    title: 'Кофе',
    description: 'Проверка обычной траты',
  }, 'expense transaction');

  if (expense.categoryId !== category.id) throw new Error('expense lost category link');
  if (expense.sectionId !== section.id) throw new Error('expense lost section link');
  assertAmount(await getAccountBalance(context, cash.id), 49550, 'cash after expense');

  const income = await createTransaction(context, {
    accountId: card.id,
    type: 'income',
    amount: 20000,
    title: 'Зарплата',
    description: 'Проверка дохода',
  }, 'income transaction');

  assertAmount(await getAccountBalance(context, card.id), 45000, 'card after income');

  const transfer = await createTransaction(context, {
    accountId: card.id,
    toAccountId: cash.id,
    type: 'transfer',
    amount: 2000,
    title: 'Перевод на наличные',
  }, 'transfer transaction');

  if (transfer.toAccountId !== cash.id) throw new Error('transfer lost target account');
  assertAmount(await getAccountBalance(context, card.id), 43000, 'card after transfer');
  assertAmount(await getAccountBalance(context, cash.id), 51550, 'cash after transfer');

  const goalResponse = await requestJson(context, '/goals', {
    method: 'POST',
    expected: [201],
    body: {
      title: `Отпуск ${context.suffix}`,
      targetAmount: 100000,
      currency: 'RUB',
      autoSavePercent: 10,
    },
  });
  const goal = goalResponse.payload?.goal;
  requireId(goal?.id, 'goal');
  const goalAccountId = requireId(getGoalAccountId(goal), 'goal account');

  const autosaveIncome = await createTransaction(context, {
    accountId: card.id,
    type: 'income',
    amount: 10000,
    title: 'Премия',
    description: 'Проверка автопополнения цели',
  }, 'autosave income transaction');

  const transactionsAfterAutosave = await requestJson(context, '/transactions', {
    method: 'GET',
  });
  const transactions = unwrapArray(transactionsAfterAutosave.payload, 'transactions');
  const linkedTransfer = transactions.find((item) => item?.sourceTransactionId === autosaveIncome.id && item?.goalId === goal.id);
  if (!linkedTransfer) throw new Error('autosave linked transfer was not created');
  assertAmount(linkedTransfer.amount, 1000, 'autosave transfer amount');
  if (linkedTransfer.toAccountId !== goalAccountId) throw new Error('autosave transfer lost goal account link');

  const goalsAfterAutosave = await requestJson(context, '/goals');
  const updatedGoal = unwrapArray(goalsAfterAutosave.payload, 'goals').find((item) => item.id === goal.id);
  if (!updatedGoal) throw new Error('goal is not visible after autosave');
  assertAmount(updatedGoal.currentAmount, 1000, 'goal progress after autosave');

  await requestJson(context, `/transactions/${autosaveIncome.id}`, {
    method: 'DELETE',
    body: { balanceMode: 'revert' },
  });

  const goalsAfterDelete = await requestJson(context, '/goals');
  const revertedGoal = unwrapArray(goalsAfterDelete.payload, 'goals').find((item) => item.id === goal.id);
  if (!revertedGoal) throw new Error('goal is not visible after income delete');
  assertAmount(revertedGoal.currentAmount, 0, 'goal progress after income delete');

  const limitResponse = await requestJson(context, '/spending-limits', {
    method: 'POST',
    expected: [201],
    body: {
      targetType: 'category',
      categoryId: category.id,
      amount: 5000,
      period: 'month',
      notifyAt: 80,
      isActive: true,
    },
  });
  const limit = limitResponse.payload?.limit;
  requireId(limit?.id, 'spending limit');

  const stats = await requestJson(context, '/transactions/stats/monthly');
  if (!Number.isFinite(Number(stats.payload?.expenses)) || Number(stats.payload.expenses) < 450) {
    throw new Error('monthly stats did not include expense');
  }

  const reportPreview = await requestJson(context, '/reports/preview');
  if (!reportPreview.payload) throw new Error('report preview is empty');

  await requestJson(context, `/spending-limits/${limit.id}`, { method: 'DELETE' });
  await requestJson(context, `/goals/${goal.id}`, { method: 'DELETE' });
  await requestJson(context, `/accounts/${goalAccountId}`, { method: 'DELETE' });
  await requestJson(context, `/transactions/${transfer.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await requestJson(context, `/transactions/${income.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await requestJson(context, `/transactions/${expense.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await requestJson(context, `/categories/${category.id}`, { method: 'DELETE' });
  await requestJson(context, `/sections/${section.id}`, { method: 'DELETE' });

  context.log('tester critical path passed', {
    cashAccountId: cash.id,
    cardAccountId: card.id,
    expenseId: expense.id,
    incomeId: income.id,
    goalId: goal.id,
    linkedAutosaveTransferId: linkedTransfer.id,
  });
});

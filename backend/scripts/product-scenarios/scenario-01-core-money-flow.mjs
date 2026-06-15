import { runSmoke } from '../smoke/lib/test-context.mjs';
import {
  assertAmount,
  createAccount,
  createCategory,
  createSection,
  createTransaction,
  getAccountBalance,
  requestJson,
  safeRequest,
} from './lib/scenario-helpers.mjs';

await runSmoke('scenario-01-core-money-flow', async (context) => {
  const cash = await createAccount(context, `Сценарий наличные ${context.suffix}`, 30000, 'cash');
  const card = await createAccount(context, `Сценарий карта ${context.suffix}`, 70000, 'card');
  const section = await createSection(context, `Еда ${context.suffix}`, '🍽️', '#f59e0b');
  const category = await createCategory(context, `Кофе ${context.suffix}`, section.id, '☕', '#f59e0b');

  const expense = await createTransaction(context, {
    accountId: cash.id,
    type: 'expense',
    amount: 350,
    title: 'Кофе',
    categoryId: category.id,
    sectionId: section.id,
    description: 'Первый расход в базовом сценарии',
  }, 'coffee expense');

  assertAmount(await getAccountBalance(context, cash.id), 29650, 'cash after coffee expense');

  const income = await createTransaction(context, {
    accountId: card.id,
    type: 'income',
    amount: 20000,
    title: 'Зарплата',
    description: 'Первый доход в базовом сценарии',
  }, 'salary income');

  assertAmount(await getAccountBalance(context, card.id), 90000, 'card after salary income');

  const transfer = await createTransaction(context, {
    accountId: card.id,
    toAccountId: cash.id,
    type: 'transfer',
    amount: 5000,
    title: 'Перевод в наличные',
  }, 'card to cash transfer');

  assertAmount(await getAccountBalance(context, card.id), 85000, 'card after transfer');
  assertAmount(await getAccountBalance(context, cash.id), 34650, 'cash after transfer');

  const stats = await requestJson(context, '/transactions/stats/monthly');
  if (Number(stats.payload?.expenses) < 350) throw new Error('Monthly stats missed expense');
  if (Number(stats.payload?.income) < 20000) throw new Error('Monthly stats missed income');

  await safeRequest(context, `/transactions/${transfer.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await safeRequest(context, `/transactions/${income.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await safeRequest(context, `/transactions/${expense.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await safeRequest(context, `/categories/${category.id}`, { method: 'DELETE' });
  await safeRequest(context, `/sections/${section.id}`, { method: 'DELETE' });
  await safeRequest(context, `/accounts/${card.id}`, { method: 'DELETE' });
  await safeRequest(context, `/accounts/${cash.id}`, { method: 'DELETE' });

  context.log('core money flow passed', { cashAccountId: cash.id, cardAccountId: card.id, expenseId: expense.id, incomeId: income.id });
});

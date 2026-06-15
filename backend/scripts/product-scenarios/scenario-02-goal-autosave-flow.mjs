import { runSmoke } from '../smoke/lib/test-context.mjs';
import {
  assertAmount,
  createAccount,
  createGoal,
  createTransaction,
  getAccountBalance,
  getGoalAccountId,
  requestJson,
  requireId,
  safeRequest,
  unwrapArray,
} from './lib/scenario-helpers.mjs';

await runSmoke('scenario-02-goal-autosave-flow', async (context) => {
  const incomeAccount = await createAccount(context, `Доход для цели ${context.suffix}`, 50000, 'card');

  const goal = await createGoal(context, {
    title: `Отпуск ${context.suffix}`,
    targetAmount: 120000,
    currency: 'RUB',
    autoSavePercent: 10,
  }, 'vacation goal');

  const goalAccountId = requireId(getGoalAccountId(goal), 'goal account');
  assertAmount(await getAccountBalance(context, goalAccountId), 0, 'goal account initial balance');

  const income = await createTransaction(context, {
    accountId: incomeAccount.id,
    type: 'income',
    amount: 20000,
    title: 'Премия',
    description: 'Доход для автопополнения цели',
  }, 'autosave income');

  assertAmount(await getAccountBalance(context, incomeAccount.id), 68000, 'income account after autosave debit');
  assertAmount(await getAccountBalance(context, goalAccountId), 2000, 'goal account after autosave');

  const transactionsResponse = await requestJson(context, '/transactions');
  const transfers = unwrapArray(transactionsResponse.payload, 'transactions');
  const linkedTransfer = transfers.find((item) => item?.sourceTransactionId === income.id && item?.goalId === goal.id);
  requireId(linkedTransfer?.id, 'autosave linked transfer');
  if (linkedTransfer.toAccountId !== goalAccountId) throw new Error('Autosave transfer target is not goal account');
  assertAmount(linkedTransfer.amount, 2000, 'autosave amount');

  const goalsAfterIncome = unwrapArray((await requestJson(context, '/goals')).payload, 'goals');
  const updatedGoal = goalsAfterIncome.find((item) => item.id === goal.id);
  assertAmount(updatedGoal?.currentAmount, 2000, 'goal current amount after autosave');

  await requestJson(context, `/transactions/${income.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });

  assertAmount(await getAccountBalance(context, incomeAccount.id), 50000, 'income account after rollback');
  assertAmount(await getAccountBalance(context, goalAccountId), 0, 'goal account after rollback');
  const goalsAfterRollback = unwrapArray((await requestJson(context, '/goals')).payload, 'goals');
  const revertedGoal = goalsAfterRollback.find((item) => item.id === goal.id);
  assertAmount(revertedGoal?.currentAmount, 0, 'goal current amount after rollback');

  await safeRequest(context, `/goals/${goal.id}`, { method: 'DELETE' });
  await safeRequest(context, `/accounts/${goalAccountId}`, { method: 'DELETE' });
  await safeRequest(context, `/accounts/${incomeAccount.id}`, { method: 'DELETE' });

  context.log('goal autosave flow passed', { goalId: goal.id, goalAccountId, incomeId: income.id });
});

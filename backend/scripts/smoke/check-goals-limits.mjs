import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('goals-limits', async (context) => {
  const goalTitle = `Smoke goal ${context.suffix}`;
  const createdGoal = await requestJson(context, '/goals', {
    method: 'POST',
    expected: [201],
    body: {
      title: goalTitle,
      targetAmount: 50000,
      currentAmount: 5000,
      currency: 'RUB',
      note: 'predeploy smoke',
    },
  });

  const goal = createdGoal.payload?.goal;
  if (!goal?.id) throw new Error('Goal was not created');
  if (goal.title !== goalTitle) throw new Error('Goal title mismatch');

  const updatedGoal = await requestJson(context, `/goals/${goal.id}`, {
    method: 'PATCH',
    body: { currentAmount: 7500, note: 'predeploy smoke updated' },
  });
  if (Number(updatedGoal.payload?.goal?.currentAmount) !== 7500) {
    throw new Error(`Goal currentAmount was not updated: ${updatedGoal.payload?.goal?.currentAmount}`);
  }

  const accountResponse = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Smoke limit account ${context.suffix}`,
      type: 'card',
      currency: 'RUB',
      balance: 15000,
    },
  });
  const accountId = accountResponse.payload?.account?.id;
  if (!accountId) throw new Error('Account for spending limit was not created');

  const createdLimit = await requestJson(context, '/spending-limits', {
    method: 'POST',
    expected: [201],
    body: {
      targetType: 'account',
      accountId,
      amount: 10000,
      period: 'monthly',
      notifyAt: 80,
      isActive: true,
    },
  });
  const limit = createdLimit.payload?.limit;
  if (!limit?.id) throw new Error('Spending limit was not created');
  if (Number(limit.amount) !== 10000) throw new Error('Spending limit amount mismatch');

  const listLimits = await requestJson(context, '/spending-limits');
  const limits = listLimits.payload?.limits ?? [];
  if (!Array.isArray(limits) || !limits.some((item) => item.id === limit.id)) {
    throw new Error('Spending limit list does not contain created limit');
  }

  const updatedLimit = await requestJson(context, `/spending-limits/${limit.id}`, {
    method: 'PUT',
    body: { amount: 12000, period: 'monthly', notifyAt: 75, isActive: true },
  });
  if (Number(updatedLimit.payload?.limit?.amount) !== 12000) {
    throw new Error(`Spending limit was not updated: ${updatedLimit.payload?.limit?.amount}`);
  }

  await requestJson(context, `/spending-limits/${limit.id}`, { method: 'DELETE' });
  await requestJson(context, `/goals/${goal.id}`, { method: 'DELETE' });

  context.log('goals and spending limits passed', { goalId: goal.id, limitId: limit.id, accountId });
});

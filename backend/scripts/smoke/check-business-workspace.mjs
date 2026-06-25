import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

async function ensureBusinessAccess(context) {
  const me = await requestJson(context, '/auth/me');
  const userId = me.payload?.user?.id;
  if (!userId) throw new Error('Cannot resolve current test user id');
  if (me.payload?.user?.isAdmin !== true) throw new Error('Business workspace smoke requires admin test token');

  const granted = await requestJson(context, `/admin/users/${userId}/subscription/grant`, {
    method: 'POST',
    body: { product: 'business', lifetime: true },
  });

  if (!granted.payload?.result?.access?.hasBusiness) throw new Error('Business access was not granted by admin endpoint');
}

await runSmoke('business-workspace', async (context) => {
  await ensureBusinessAccess(context);

  const account = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Business smoke account ${context.suffix}`,
      type: 'card',
      currency: 'RUB',
      balance: 25000,
    },
  });
  const accountId = account.payload?.account?.id;
  if (!accountId) throw new Error('Business account was not created');

  const initial = await requestJson(context, '/business-workspace/me');
  if (!initial.payload?.workspace?.id) throw new Error('Business workspace was not returned');
  if (!Array.isArray(initial.payload?.accounts)) throw new Error('Business workspace accounts list is invalid');

  const update = await requestJson(context, '/business-workspace/me', {
    method: 'PUT',
    body: {
      profileType: 'self_employed',
      displayName: `Smoke Business ${context.suffix}`,
      taxMode: 'НПД',
      incomeAccountId: accountId,
      expenseAccountId: accountId,
      monthlyIncomePlan: 120000,
      monthlyExpensePlan: 40000,
      reminderDay: 10,
    },
  });

  if (update.payload?.workspace?.displayName !== `Smoke Business ${context.suffix}`) {
    throw new Error('Business workspace displayName was not saved');
  }
  if (update.payload?.workspace?.incomeAccountId !== accountId) {
    throw new Error('Business workspace income account was not saved');
  }
  if (typeof update.payload?.summary?.profit !== 'number') {
    throw new Error('Business workspace summary is invalid');
  }

  context.log('business workspace flow passed', {
    workspaceId: update.payload.workspace.id,
    accountId,
    incomePlan: update.payload.workspace.monthlyIncomePlan,
  });
});

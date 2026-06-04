import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('accounts-balances', async (context) => {
  const name = `Smoke account ${context.suffix}`;
  const created = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: { name, type: 'cash', currency: 'RUB', balance: 10000 },
  });

  const account = created.payload?.account;
  if (!account?.id) throw new Error('Account was not created');
  if (Number(account.balance) !== 10000) throw new Error(`Unexpected initial balance: ${account.balance}`);

  await requestJson(context, '/accounts/recalculate-balances', { method: 'POST' });
  const loaded = await requestJson(context, `/accounts/${account.id}`);
  if (Number(loaded.payload?.account?.balance) !== 10000) {
    throw new Error(`Balance recalc did not preserve opening balance: ${loaded.payload?.account?.balance}`);
  }

  context.log('account created and balance preserved', { id: account.id });
});

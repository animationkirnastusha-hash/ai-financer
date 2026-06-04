import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

await runSmoke('transactions', async (context) => {
  const accountResponse = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: { name: `Smoke tx account ${context.suffix}`, type: 'cash', currency: 'RUB', balance: 5000 },
  });
  const account = accountResponse.payload?.account;
  if (!account?.id) throw new Error('Account for transaction smoke was not created');

  const created = await requestJson(context, '/transactions', {
    method: 'POST',
    expected: [201],
    body: {
      accountId: account.id,
      amount: 300,
      type: 'expense',
      title: `Smoke expense ${context.suffix}`,
      description: 'predeploy smoke',
    },
  });
  const transaction = created.payload?.transaction;
  if (!transaction?.id) throw new Error('Transaction was not created');

  const updated = await requestJson(context, `/transactions/${transaction.id}`, {
    method: 'PATCH',
    body: { title: `Smoke expense updated ${context.suffix}`, amount: 350 },
  });
  if (!updated.payload?.transaction?.id) throw new Error('Transaction was not updated');

  await requestJson(context, `/transactions/${transaction.id}`, {
    method: 'DELETE',
    body: { balanceMode: 'revert' },
  });

  context.log('transaction lifecycle passed', { accountId: account.id, transactionId: transaction.id });
});

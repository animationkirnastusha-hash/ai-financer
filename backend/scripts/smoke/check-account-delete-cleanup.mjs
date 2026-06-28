import { runSmoke } from './lib/test-context.mjs';
import { requestJson, unwrapArray } from './lib/http-client.mjs';

function requireAccount(payload, label) {
  const account = payload?.account;
  if (!account?.id) throw new Error(`${label}: account was not returned`);
  return account;
}

async function createAccount(context, name, balance) {
  const response = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: { name, type: 'card', currency: 'RUB', balance },
  });
  return requireAccount(response.payload, name);
}

async function createTransaction(context, body, label) {
  const response = await requestJson(context, '/transactions', {
    method: 'POST',
    expected: [201],
    body,
  });
  const transaction = response.payload?.transaction;
  if (!transaction?.id) throw new Error(`${label}: transaction was not returned`);
  return transaction;
}

await runSmoke('account-delete-cleanup', async (context) => {
  const primary = await createAccount(context, `Delete linked source ${context.suffix}`, 10000);
  const target = await createAccount(context, `Delete linked target ${context.suffix}`, 3000);

  await createTransaction(context, {
    accountId: primary.id,
    amount: 700,
    type: 'expense',
    title: `Delete cleanup expense ${context.suffix}`,
    description: 'account delete cleanup smoke',
  }, 'expense');

  await createTransaction(context, {
    accountId: primary.id,
    toAccountId: target.id,
    amount: 1200,
    type: 'transfer',
    title: `Delete cleanup transfer ${context.suffix}`,
    description: 'account delete cleanup smoke',
  }, 'transfer');

  await requestJson(context, `/accounts/${primary.id}`, {
    method: 'DELETE',
    expected: [200],
  });

  await requestJson(context, `/accounts/${primary.id}`, {
    method: 'GET',
    expected: [404],
  });

  const loadedTarget = await requestJson(context, `/accounts/${target.id}`, { expected: [200] });
  const targetAccount = requireAccount(loadedTarget.payload, 'target after delete');
  if (Number(targetAccount.balance) !== 3000) {
    throw new Error(`target transfer balance was not reverted: expected 3000, got ${targetAccount.balance}`);
  }

  const txList = await requestJson(context, `/transactions?accountId=${encodeURIComponent(primary.id)}&limit=20`, { expected: [200] });
  const transactions = unwrapArray(txList.payload, 'transactions');
  if (transactions.length > 0) {
    throw new Error(`linked transactions were not removed: ${transactions.length}`);
  }

  await requestJson(context, `/accounts/${target.id}`, {
    method: 'DELETE',
    expected: [200],
  });

  context.log('linked account delete cleanup passed', { deletedAccountId: primary.id, targetAccountId: target.id });
});

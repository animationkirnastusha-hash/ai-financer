import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

async function ensurePremiumAccess(context) {
  const order = await requestJson(context, '/payments/orders', {
    method: 'POST',
    body: { product: 'premium', duration: 'month', provider: 'mock' },
  });
  const orderId = order.payload?.order?.id;
  if (!orderId) throw new Error('Premium mock order was not created');
  const completed = await requestJson(context, `/payments/orders/${orderId}/mock-complete`, { method: 'POST' });
  if (!completed.payload?.subscription?.access?.hasPremium) throw new Error('Premium access was not granted');
}

async function uploadReceipt(context) {
  const form = new FormData();
  const fakePng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);
  form.append('receipt', new Blob([fakePng], { type: 'image/png' }), `smoke-receipt-${context.suffix}.png`);

  const response = await fetch(`${context.baseUrl}/receipt-scans/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${context.token}` },
    body: form,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.status !== 201) {
    throw new Error(`Receipt upload returned ${response.status}: ${text}`);
  }
  return payload;
}

await runSmoke('receipt-scans', async (context) => {
  await ensurePremiumAccess(context);

  const accountResponse = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Receipt smoke account ${context.suffix}`,
      type: 'card',
      currency: 'RUB',
      balance: 15000,
    },
  });
  const accountId = accountResponse.payload?.account?.id;
  if (!accountId) throw new Error('Account for receipt expense was not created');

  const before = await requestJson(context, '/subscription/me');
  const beforeUsed = before.payload?.usage?.receiptScansThisMonth?.used;
  if (typeof beforeUsed !== 'number') throw new Error('Receipt usage before upload is invalid');

  const uploaded = await uploadReceipt(context);
  const scanId = uploaded?.scan?.id;
  if (!scanId) throw new Error('Receipt scan was not created');
  if (uploaded.scan.status !== 'uploaded') throw new Error('Receipt scan status is invalid');
  if (!uploaded.scan.preview?.title) throw new Error('Receipt scan preview is missing');

  const fetched = await requestJson(context, `/receipt-scans/${scanId}`);
  if (fetched.payload?.id !== scanId) throw new Error('Receipt fetch returned wrong scan');

  const list = await requestJson(context, '/receipt-scans');
  const items = list.payload?.items ?? [];
  if (!Array.isArray(items) || !items.some((item) => item.id === scanId)) {
    throw new Error('Receipt list does not contain uploaded scan');
  }

  const reviewed = await requestJson(context, `/receipt-scans/${scanId}/review`, {
    method: 'PATCH',
    body: {
      merchant: `Smoke Market ${context.suffix}`,
      totalAmount: 1234,
      currency: 'RUB',
      purchasedAt: new Date().toISOString(),
      rawText: 'Smoke receipt raw text',
    },
  });
  if (reviewed.payload?.scan?.status !== 'reviewed') throw new Error('Receipt review did not set reviewed status');

  const expense = await requestJson(context, `/receipt-scans/${scanId}/create-expense`, {
    method: 'POST',
    expected: [201],
    body: {
      accountId,
      amount: 1234,
      title: `Smoke receipt expense ${context.suffix}`,
      description: 'predeploy receipt smoke',
      date: new Date().toISOString(),
    },
  });
  if (expense.payload?.scan?.status !== 'expense_created') throw new Error('Receipt expense did not set expense_created status');
  if (!expense.payload?.transaction?.id) throw new Error('Receipt expense did not return transaction');

  const after = await requestJson(context, '/subscription/me');
  const afterUsed = after.payload?.usage?.receiptScansThisMonth?.used;
  if (typeof afterUsed !== 'number' || afterUsed < beforeUsed + 1) {
    throw new Error('Receipt upload did not record subscription usage');
  }

  context.log('receipt scan flow passed', {
    scanId,
    accountId,
    transactionId: expense.payload.transaction.id,
    beforeUsed,
    afterUsed,
  });
});

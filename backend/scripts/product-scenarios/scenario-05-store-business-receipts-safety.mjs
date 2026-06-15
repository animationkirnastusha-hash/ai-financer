import { runSmoke } from '../smoke/lib/test-context.mjs';
import {
  createAccount,
  ensureBusinessAccess,
  ensurePremiumAccess,
  requestJson,
  requireId,
  safeRequest,
  uploadFakeReceipt,
} from './lib/scenario-helpers.mjs';

await runSmoke('scenario-05-store-business-receipts-safety', async (context) => {
  const catalog = await requestJson(context, '/payments/catalog');
  const products = catalog.payload?.products ?? [];
  if (!Array.isArray(products) || !products.some((item) => item.product === 'premium') || !products.some((item) => item.product === 'business')) {
    throw new Error('Store catalog does not contain Premium and Business');
  }

  await ensurePremiumAccess(context);
  await ensureBusinessAccess(context);

  const account = await createAccount(context, `Чеки ${context.suffix}`, 20000, 'card');
  const uploaded = await uploadFakeReceipt(context, `receipt-${context.suffix}.png`);
  const scanId = requireId(uploaded?.scan?.id, 'receipt scan');

  const reviewed = await requestJson(context, `/receipt-scans/${scanId}/review`, {
    method: 'PATCH',
    body: {
      merchant: `Молоко ${context.suffix}`,
      totalAmount: 1470,
      currency: 'RUB',
      purchasedAt: new Date().toISOString(),
      rawText: 'молоко сыр хлеб',
      description: 'Проверка чека: магазин хранится как место покупки',
    },
  });
  if (reviewed.payload?.scan?.status !== 'reviewed') throw new Error('Receipt review failed');

  const expense = await requestJson(context, `/receipt-scans/${scanId}/expense`, {
    method: 'POST',
    expected: [200, 201],
    body: {
      accountId: account.id,
      totalAmount: 1470,
      title: 'Покупка по чеку',
      description: 'Место: Молоко',
      purchasedAt: new Date().toISOString(),
    },
  });
  const transactionId = requireId(expense.payload?.transactionId, 'receipt transaction');
  if (expense.payload?.scan?.status !== 'expense_created') throw new Error('Receipt was not converted into expense');

  const business = await requestJson(context, '/business-workspace/me');
  requireId(business.payload?.workspace?.id, 'business workspace');

  const adminUsers = await requestJson(context, '/admin/users');
  const users = adminUsers.payload?.users;
  if (!Array.isArray(users)) throw new Error('Admin users list is invalid');

  await safeRequest(context, `/transactions/${transactionId}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await safeRequest(context, `/accounts/${account.id}`, { method: 'DELETE' });

  context.log('store business receipts safety passed', { scanId, transactionId, accountId: account.id });
});

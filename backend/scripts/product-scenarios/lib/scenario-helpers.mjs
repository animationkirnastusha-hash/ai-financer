import { requestJson, unwrapArray } from '../../smoke/lib/http-client.mjs';

export { requestJson, unwrapArray };

export function requireId(value, label) {
  if (!value || typeof value !== 'string') throw new Error(`${label}: id is missing`);
  return value;
}

export function assertAmount(actual, expected, label) {
  const num = Number(actual);
  const diff = Math.abs(num - Number(expected));
  if (!Number.isFinite(num) || diff > 0.01) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

export function assertNonEmpty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is empty`);
}

export function getGoalAccountId(goal) {
  return goal?.accountId || goal?.account?.id || null;
}

export async function safeRequest(context, path, options = {}) {
  try {
    return await requestJson(context, path, options);
  } catch (error) {
    context.log(`cleanup ignored: ${path}`, error?.message ?? String(error));
    return null;
  }
}

export async function createAccount(context, name, balance, type = 'cash') {
  const response = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: { name, type, currency: 'RUB', balance, showInTotalBalance: true },
  });
  const account = response.payload?.account;
  requireId(account?.id, `account ${name}`);
  assertAmount(account.balance, balance, `initial balance for ${name}`);
  return account;
}

export async function getAccount(context, accountId) {
  const response = await requestJson(context, `/accounts/${accountId}`);
  const account = response.payload?.account;
  requireId(account?.id, 'account');
  return account;
}

export async function getAccountBalance(context, accountId) {
  const account = await getAccount(context, accountId);
  return Number(account.balance);
}

export async function createSection(context, name, icon = '•', color = '#64748b') {
  const response = await requestJson(context, '/sections', {
    method: 'POST',
    expected: [201],
    body: { name, icon, color },
  });
  const section = response.payload?.section;
  requireId(section?.id, `section ${name}`);
  assertNonEmpty(section.name, 'section name');
  return section;
}

export async function createCategory(context, name, sectionId, icon = '☕', color = '#f59e0b') {
  const response = await requestJson(context, '/categories', {
    method: 'POST',
    expected: [201],
    body: { name, type: 'expense', sectionId, icon, color },
  });
  const category = response.payload?.category;
  requireId(category?.id, `category ${name}`);
  assertNonEmpty(category.name, 'category name');
  if (category.sectionId !== sectionId) throw new Error('category lost section link');
  return category;
}

export async function createTransaction(context, body, label = 'transaction') {
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

export async function createGoal(context, body, label = 'goal') {
  const response = await requestJson(context, '/goals', {
    method: 'POST',
    expected: [201],
    body,
  });
  const createdGoal = response.payload?.goal;
  const goalId = requireId(createdGoal?.id, label);

  if (getGoalAccountId(createdGoal)) return createdGoal;

  const listResponse = await requestJson(context, '/goals');
  const listedGoal = unwrapArray(listResponse.payload, 'goals').find((goal) => goal?.id === goalId);
  return listedGoal || createdGoal;
}

export async function ensurePremiumAccess(context) {
  const order = await requestJson(context, '/payments/orders', {
    method: 'POST',
    body: { product: 'premium', duration: 'month', provider: 'mock' },
  });
  const orderId = requireId(order.payload?.order?.id, 'premium order');
  const completed = await requestJson(context, `/payments/orders/${orderId}/mock-complete`, { method: 'POST' });
  if (!completed.payload?.subscription?.access?.hasPremium) throw new Error('Premium access was not granted');
  return completed.payload.subscription;
}

export async function uploadFakeReceipt(context, name = 'scenario-receipt.png') {
  const form = new FormData();
  const fakePng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);

  form.append('receipt', new Blob([fakePng], { type: 'image/png' }), name);

  const response = await fetch(`${context.baseUrl}/receipt-scans/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${context.token}` },
    body: form,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.status !== 201) throw new Error(`Receipt upload returned ${response.status}: ${text}`);
  return payload;
}

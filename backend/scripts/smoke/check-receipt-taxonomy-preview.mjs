import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

const OTHER_NAMES = new Set(['другое', 'прочее', 'other', 'misc']);

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function assertGroups(groups) {
  if (!Array.isArray(groups) || groups.length < 2) {
    throw new Error(`Receipt taxonomy groups are missing or too few: ${JSON.stringify(groups)}`);
  }

  for (const group of groups) {
    const sectionName = normalizeName(group.sectionName ?? group.name ?? group.section);
    if (!sectionName) throw new Error(`Receipt taxonomy group has no section name: ${JSON.stringify(group)}`);
    if (OTHER_NAMES.has(sectionName)) {
      throw new Error(`Receipt taxonomy must not fall back to ${group.sectionName ?? group.name ?? group.section}`);
    }
    const categories = group.categories ?? group.items ?? [];
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new Error(`Receipt taxonomy group has no categories/items: ${JSON.stringify(group)}`);
    }
  }
}

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
  form.append('receipt', new Blob([fakePng], { type: 'image/png' }), `smoke-taxonomy-receipt-${context.suffix}.png`);

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

await runSmoke('receipt-taxonomy-preview', async (context) => {
  await ensurePremiumAccess(context);

  const uploaded = await uploadReceipt(context);
  const scanId = uploaded?.scan?.id;
  if (!scanId) throw new Error('Receipt scan was not created');

  const reviewed = await requestJson(context, `/receipt-scans/${scanId}/review`, {
    method: 'PATCH',
    body: {
      merchant: `Smoke taxonomy market ${context.suffix}`,
      totalAmount: 1850,
      currency: 'RUB',
      purchasedAt: new Date().toISOString(),
      rawText: [
        'кофе капучино 250',
        'бензин АИ-95 900',
        'аптека витамины 700',
      ].join('\n'),
    },
  });

  const scan = reviewed.payload?.scan;
  const groups = scan?.preview?.groups ?? reviewed.payload?.preview?.groups ?? [];
  assertGroups(groups);

  context.log('receipt taxonomy preview passed', {
    scanId,
    groupCount: groups.length,
    groups: groups.map((group) => group.sectionName ?? group.name ?? group.section),
  });
});

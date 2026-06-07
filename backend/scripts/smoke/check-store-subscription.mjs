import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

function assertBucket(name, bucket) {
  if (!bucket || typeof bucket.used !== 'number' || typeof bucket.limit !== 'number' || typeof bucket.remaining !== 'number') {
    throw new Error(`${name} usage bucket is invalid`);
  }
}

function assertAccess(status) {
  const access = status?.access;
  if (!access || typeof access.status !== 'string') throw new Error('Subscription access is missing');
  if (typeof access.hasPremium !== 'boolean') throw new Error('Subscription hasPremium is invalid');
  if (typeof access.hasBusiness !== 'boolean') throw new Error('Subscription hasBusiness is invalid');

  assertBucket('voiceCommandsToday', status.usage?.voiceCommandsToday);
  assertBucket('receiptScansThisMonth', status.usage?.receiptScansThisMonth);
  assertBucket('advancedReportsThisMonth', status.usage?.advancedReportsThisMonth);
}

async function createAndCompleteMockOrder(context, product) {
  const created = await requestJson(context, '/payments/orders', {
    method: 'POST',
    body: { product, duration: 'month', provider: 'mock' },
  });

  const orderId = created.payload?.order?.id;
  if (!orderId) throw new Error(`${product} mock order was not created`);
  if (created.payload?.checkout?.provider !== 'mock') throw new Error(`${product} checkout provider is not mock`);

  const fetched = await requestJson(context, `/payments/orders/${orderId}`);
  if (fetched.payload?.id !== orderId) throw new Error(`${product} order fetch returned wrong order`);

  const completed = await requestJson(context, `/payments/orders/${orderId}/mock-complete`, { method: 'POST' });
  if (completed.payload?.order?.status !== 'paid') throw new Error(`${product} mock order was not paid`);
  assertAccess(completed.payload?.subscription);
  return completed.payload.subscription;
}

await runSmoke('store-subscription', async (context) => {
  const status = await requestJson(context, '/subscription/me');
  assertAccess(status.payload);

  const catalog = await requestJson(context, '/payments/catalog');
  const products = catalog.payload?.products ?? [];
  if (!Array.isArray(products) || !products.some((item) => item.product === 'premium') || !products.some((item) => item.product === 'business')) {
    throw new Error('Payment catalog does not contain premium and business products');
  }

  for (const feature of ['store', 'receiptScan', 'advancedReports', 'businessWorkspace']) {
    const featureAccess = await requestJson(context, `/subscription/features/${feature}`);
    if (featureAccess.payload?.feature !== feature) throw new Error(`Feature access mismatch for ${feature}`);
    if (typeof featureAccess.payload?.allowed !== 'boolean') throw new Error(`Feature access allowed flag is invalid for ${feature}`);
  }

  const premium = await createAndCompleteMockOrder(context, 'premium');
  if (!premium.access?.hasPremium) throw new Error('Premium mock payment did not grant premium access');

  const business = await createAndCompleteMockOrder(context, 'business');
  if (!business.access?.hasBusiness) throw new Error('Business mock payment did not grant business access');
  if (!business.access?.hasPremium) throw new Error('Business access must include premium');

  const referral = await requestJson(context, '/referral');
  if (!referral.payload?.referral?.code) throw new Error('Referral code is missing');

  context.log('store and subscription flow passed', {
    status: business.access.status,
    hasPremium: business.access.hasPremium,
    hasBusiness: business.access.hasBusiness,
    referralCode: referral.payload.referral.code,
  });
});

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


  const premiumPlan = products.find((item) => item.product === 'premium')?.options?.find((option) => option.duration === 'month');
  const premiumYear = products.find((item) => item.product === 'premium')?.options?.find((option) => option.duration === 'year');
  const businessPlan = products.find((item) => item.product === 'business')?.options?.find((option) => option.duration === 'month');
  const businessYear = products.find((item) => item.product === 'business')?.options?.find((option) => option.duration === 'year');
  if (premiumPlan?.amount !== 56000 || premiumPlan?.baseAmount !== 70000) throw new Error('Premium month price mismatch');
  if (businessPlan?.amount !== 120000 || businessPlan?.baseAmount !== 150000) throw new Error('Business month price mismatch');
  if (premiumYear?.amount !== 630000 || premiumYear?.baseAmount !== 840000) throw new Error('Premium year price mismatch');
  if (businessYear?.amount !== 1350000 || businessYear?.baseAmount !== 1800000) throw new Error('Business year price mismatch');
  if (!premiumPlan?.starsAmount || !businessPlan?.starsAmount) throw new Error('Stars price is missing');

  const starsOrder = await requestJson(context, '/payments/orders', {
    method: 'POST',
    body: { product: 'premium', duration: 'month', provider: 'telegramStars' },
  });
  if (starsOrder.payload?.order?.provider !== 'telegramStars') throw new Error('Telegram Stars order provider mismatch');
  if (starsOrder.payload?.order?.currency !== 'XTR') throw new Error('Telegram Stars order currency mismatch');
  if (!['ready', 'not_configured'].includes(starsOrder.payload?.checkout?.status)) throw new Error('Telegram Stars checkout status mismatch');

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
  const referralData = referral.payload?.referral ?? referral.payload ?? {};
  const referralCode = referralData.code ?? referralData.referralCode;
  if (!referralCode) {
    throw new Error(`Referral code is missing. Response: ${JSON.stringify(referral.payload)}`);
  }

  context.log('store and subscription flow passed', {
    status: business.access.status,
    hasPremium: business.access.hasPremium,
    hasBusiness: business.access.hasBusiness,
    referralCode,
  });
});

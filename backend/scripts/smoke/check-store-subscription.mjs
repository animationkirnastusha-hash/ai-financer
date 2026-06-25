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
  if (!Array.isArray(products)) throw new Error('Payment catalog products list is invalid');

  const premiumProduct = products.find((item) => item.product === 'premium');
  const businessProduct = products.find((item) => item.product === 'business');
  if (!premiumProduct) throw new Error('Payment catalog does not contain premium product');
  if (!businessProduct) throw new Error('Payment catalog does not contain business product placeholder');

  const premiumPlan = premiumProduct.options?.find((option) => option.duration === 'month');
  const premiumYear = premiumProduct.options?.find((option) => option.duration === 'year');
  if (premiumPlan?.amount !== 39900 || premiumPlan?.baseAmount !== 49900) throw new Error('Premium month RUB price mismatch');
  if (premiumYear?.amount !== 359000 || premiumYear?.baseAmount !== 478800) throw new Error('Premium year RUB price mismatch');
  if (typeof premiumPlan?.starsAmount !== 'number' || premiumPlan.starsAmount <= 0) throw new Error('Premium month Stars price is missing');
  if (typeof premiumPlan?.starsBaseAmount !== 'number' || premiumPlan.starsBaseAmount <= 0) throw new Error('Premium month Stars base price is missing');
  if (typeof premiumYear?.starsAmount !== 'number' || premiumYear.starsAmount <= 0) throw new Error('Premium year Stars price is missing');

  if (businessProduct.comingSoon !== true) throw new Error('Business product must be marked as coming soon');
  if (Array.isArray(businessProduct.options) && businessProduct.options.length > 0) {
    throw new Error('Business product must not expose purchasable options in personal Fina');
  }

  const starsOrder = await requestJson(context, '/payments/orders', {
    method: 'POST',
    body: { product: 'premium', duration: 'month', provider: 'telegramStars' },
  });
  if (starsOrder.payload?.order?.provider !== 'telegramStars') throw new Error('Telegram Stars order provider mismatch');
  if (starsOrder.payload?.order?.currency !== 'XTR') throw new Error('Telegram Stars order currency mismatch');
  if (starsOrder.payload?.order?.amount !== premiumPlan.starsAmount) throw new Error('Telegram Stars order amount mismatch');
  if (!['ready', 'not_configured'].includes(starsOrder.payload?.checkout?.status)) throw new Error('Telegram Stars checkout status mismatch');

  const blockedBusinessOrder = await requestJson(context, '/payments/orders', {
    method: 'POST',
    expected: [400],
    body: { product: 'business', duration: 'month', provider: 'mock' },
  });
  if (blockedBusinessOrder.payload?.error?.code !== 'BAD_REQUEST') throw new Error('Business purchase block response is invalid');

  for (const feature of ['store', 'receiptScan', 'advancedReports', 'businessWorkspace']) {
    const featureAccess = await requestJson(context, `/subscription/features/${feature}`);
    if (featureAccess.payload?.feature !== feature) throw new Error(`Feature access mismatch for ${feature}`);
    if (typeof featureAccess.payload?.allowed !== 'boolean') throw new Error(`Feature access allowed flag is invalid for ${feature}`);
  }

  const premium = await createAndCompleteMockOrder(context, 'premium');
  if (!premium.access?.hasPremium) throw new Error('Premium mock payment did not grant premium access');
  if (premium.access?.hasBusiness) throw new Error('Premium payment must not grant business access');

  const referral = await requestJson(context, '/referral');
  const referralData = referral.payload?.referral ?? referral.payload ?? {};
  const referralCode = referralData.code ?? referralData.referralCode;
  if (!referralCode) {
    throw new Error(`Referral code is missing. Response: ${JSON.stringify(referral.payload)}`);
  }

  context.log('store and subscription flow passed', {
    status: premium.access.status,
    hasPremium: premium.access.hasPremium,
    hasBusiness: premium.access.hasBusiness,
    businessComingSoon: businessProduct.comingSoon === true,
    referralCode,
  });
});

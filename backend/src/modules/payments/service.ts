import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import { subscriptionService, type BundleProduct } from '../subscription/service';
import { createTelegramStarsInvoiceLink, isTelegramStarsConfigured, answerTelegramPreCheckoutQuery } from './lib/telegram-stars';
import { getAvailableDurations, getPricePlan, type PaymentDuration, type PaymentStoreProduct } from './lib/payment-pricing';
import {
  createYooKassaSbpPayment,
  getYooKassaPayment,
  getYooKassaReturnUrl,
  isYooKassaConfigured,
  type YooKassaPaymentObject,
  type YooKassaWebhookPayload,
} from './lib/yookassa';

export type PaymentProvider = 'telegramStars' | 'yookassaSbp' | 'crypto' | 'manual' | 'mock';

type CheckoutInput = {
  product?: unknown;
  duration?: unknown;
  provider?: unknown;
};

type TelegramUpdate = {
  pre_checkout_query?: {
    id?: string;
    from?: { id?: number };
    currency?: string;
    total_amount?: number;
    invoice_payload?: string;
  };
  message?: {
    successful_payment?: {
      currency?: string;
      total_amount?: number;
      invoice_payload?: string;
      telegram_payment_charge_id?: string;
      provider_payment_charge_id?: string;
    };
  };
};

const ORDER_TTL_MS = 30 * 60 * 1000;
function normalizeProduct(value: unknown): PaymentStoreProduct {
  if (value === 'bundle_try') return 'bundle_try';
  if (value === 'bundle_week') return 'bundle_week';
  if (value === 'premium' || value == null) return 'premium';
  throw new BadRequestError('Unknown product');
}

function isBundleProduct(product: PaymentStoreProduct): product is BundleProduct {
  return product === 'bundle_try' || product === 'bundle_week';
}

function normalizeDuration(value: unknown): PaymentDuration {
  if (value === 'year') return 'year';
  if (value === 'once') return 'once';
  if (value === 'month' || value == null) return 'month';
  throw new BadRequestError('Unknown duration');
}

function normalizeProvider(value: unknown): PaymentProvider {
  if (value === 'telegramStars' || value === 'yookassaSbp' || value === 'crypto' || value === 'manual' || value === 'mock') return value;
  if (value == null) return 'yookassaSbp';
  throw new BadRequestError('Unknown provider');
}

function parseOrderPayload(payload: string | null | undefined) {
  if (!payload) return null;
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function serializeOrder(order: Awaited<ReturnType<typeof prisma.storePaymentOrder.findUnique>>) {
  if (!order) return null;
  return {
    id: order.id,
    product: order.product,
    duration: order.duration,
    provider: order.provider,
    status: order.status,
    amount: order.amount,
    baseAmount: order.baseAmount,
    discountPercent: order.discountPercent,
    currency: order.currency,
    description: order.description,
    payload: parseOrderPayload(order.payload),
    telegramInvoiceLink: order.telegramInvoiceLink,
    telegramPaymentChargeId: order.telegramPaymentChargeId,
    providerPaymentChargeId: order.providerPaymentChargeId,
    checkoutUrl: order.checkoutUrl,
    paidAt: order.paidAt?.toISOString() ?? null,
    expiresAt: order.expiresAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

function getOrderIdFromPayload(value: unknown): string {
  const text = String(value ?? '');
  if (!text.startsWith('store_order:')) throw new BadRequestError('Unknown payment payload');
  const orderId = text.slice('store_order:'.length).trim();
  if (!orderId) throw new BadRequestError('Order is required');
  return orderId;
}

function kopecksFromYooKassaAmount(payment: YooKassaPaymentObject) {
  const value = payment.amount?.value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) throw new BadRequestError('YooKassa payment amount is invalid');
  return Math.round(numeric * 100);
}

function orderIdFromYooKassaPayment(payment: YooKassaPaymentObject) {
  const orderId = String(payment.metadata?.orderId ?? '').trim();
  if (!orderId) throw new BadRequestError('YooKassa payment order id is missing');
  return orderId;
}

function safeProviderPayload(value: unknown) {
  try {
    return JSON.stringify(value).slice(0, 16_000);
  } catch {
    return null;
  }
}

export class PaymentService {
  getCatalog() {
    return {
      products: [
        { product: 'premium', title: 'Premium', options: this.getProductOptions('premium') },
        { product: 'bundle_try', title: 'Попробовать Фину', options: this.getProductOptions('bundle_try') },
        { product: 'bundle_week', title: 'На неделю', options: this.getProductOptions('bundle_week') },
      ],
      providers: ['yookassaSbp', 'telegramStars', 'crypto', 'manual', 'mock'] as PaymentProvider[],
      telegramStarsConfigured: isTelegramStarsConfigured(),
      yookassaSbpConfigured: isYooKassaConfigured(),
    };
  }

  private getProductOptions(product: PaymentStoreProduct) {
    return getAvailableDurations(product).map((duration) => {
      const plan = getPricePlan(product, duration);
      return {
        duration,
        amount: plan.amount,
        baseAmount: plan.baseAmount,
        discountPercent: plan.discountPercent,
        currency: plan.currency,
        starsAmount: plan.starsAmount,
        starsBaseAmount: plan.starsBaseAmount,
        starsCurrency: plan.starsCurrency,
        days: plan.days,
        monthsCharged: plan.monthsCharged,
      };
    });
  }

  async createCheckout(userId: string, input: CheckoutInput) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true } });
    if (!user) throw new NotFoundError('User not found');

    const product = normalizeProduct(input.product);
    const durationInput = normalizeDuration(input.duration);
    const availableDurations = getAvailableDurations(product);
    const fallbackDuration: PaymentDuration = availableDurations[0] ?? 'once';
    const duration: PaymentDuration = availableDurations.includes(durationInput) ? durationInput : fallbackDuration;
    const provider = normalizeProvider(input.provider);
    const basePlan = getPricePlan(product, duration);
    const amount = provider === 'telegramStars' ? basePlan.starsAmount : basePlan.amount;
    const baseAmount = provider === 'telegramStars' ? basePlan.starsBaseAmount : basePlan.baseAmount;
    const currency = provider === 'telegramStars' ? basePlan.starsCurrency : basePlan.currency;
    const expiresAt = new Date(Date.now() + ORDER_TTL_MS);

    const payload = {
      product,
      duration,
      days: basePlan.days,
      provider,
      checkoutMode: provider === 'mock' ? 'admin_test' : provider,
      rubAmount: basePlan.amount,
      baseRubAmount: basePlan.baseAmount,
      discountPercent: basePlan.discountPercent,
    };

    const order = await prisma.storePaymentOrder.create({
      data: {
        userId,
        product,
        duration,
        provider,
        amount,
        baseAmount,
        discountPercent: basePlan.discountPercent,
        currency,
        description: basePlan.title,
        expiresAt,
        payload: JSON.stringify(payload),
      },
    });

    if (provider === 'telegramStars') {
      const checkout = await this.buildTelegramStarsCheckout(order.id, amount, order.description, basePlan.description);
      const updated = checkout.invoiceLink
        ? await prisma.storePaymentOrder.update({ where: { id: order.id }, data: { telegramInvoiceLink: checkout.invoiceLink } })
        : order;
      return { order: serializeOrder(updated), checkout };
    }

    if (provider === 'yookassaSbp') {
      const checkout = await this.buildYooKassaSbpCheckout(order.id, userId, amount, order.description);
      const updated = checkout.paymentId
        ? await prisma.storePaymentOrder.update({
          where: { id: order.id },
          data: {
            providerPaymentChargeId: checkout.paymentId,
            checkoutUrl: checkout.confirmationUrl,
            providerPayload: checkout.providerPayload,
          },
        })
        : order;
      return { order: serializeOrder(updated), checkout };
    }

    return {
      order: serializeOrder(order),
      checkout: this.buildCheckout(order.provider as PaymentProvider, order.id, amount, currency, order.description, user.isAdmin),
    };
  }

  private async buildTelegramStarsCheckout(orderId: string, amount: number, title: string, description: string) {
    if (!isTelegramStarsConfigured()) {
      return {
        provider: 'telegramStars' as const,
        status: 'not_configured',
        title,
        amount,
        currency: 'XTR',
        payload: `store_order:${orderId}`,
        invoiceLink: null,
      };
    }

    const invoiceLink = await createTelegramStarsInvoiceLink({
      title,
      description,
      payload: `store_order:${orderId}`,
      amount,
    });

    return {
      provider: 'telegramStars' as const,
      status: 'ready',
      title,
      amount,
      currency: 'XTR',
      payload: `store_order:${orderId}`,
      invoiceLink,
    };
  }

  private async buildYooKassaSbpCheckout(orderId: string, userId: string, amount: number, title: string) {
    if (!isYooKassaConfigured()) {
      return {
        provider: 'yookassaSbp' as const,
        status: 'not_configured',
        title,
        amount,
        currency: 'RUB',
        paymentId: null,
        confirmationUrl: null,
        checkoutUrl: null,
        providerPayload: null,
      };
    }

    const payment = await createYooKassaSbpPayment({
      orderId,
      userId,
      amountKopecks: amount,
      description: title,
      returnUrl: getYooKassaReturnUrl(orderId),
    });

    const confirmationUrl = payment.confirmation?.confirmation_url ?? null;
    if (!confirmationUrl) throw new BadRequestError('YooKassa did not return payment URL');

    return {
      provider: 'yookassaSbp' as const,
      status: 'ready',
      title,
      amount,
      currency: 'RUB',
      paymentId: payment.id,
      confirmationUrl,
      checkoutUrl: confirmationUrl,
      providerPayload: safeProviderPayload(payment),
    };
  }

  private buildCheckout(provider: PaymentProvider, orderId: string, amount: number, currency: string, description: string, isAdmin: boolean) {
    if (provider === 'crypto') {
      return { provider, status: 'manual', title: description, amount, currency };
    }

    if (provider === 'manual') {
      return { provider, status: 'manual', title: description, amount, currency };
    }

    if (provider === 'mock') {
      return { provider, status: isAdmin ? 'can_complete' : 'manual', title: description, amount, currency };
    }

    return {
      provider,
      status: 'ready',
      title: description,
      amount,
      currency,
      payload: `store_order:${orderId}`,
    };
  }

  async getOrder(userId: string, orderId: string) {
    const order = await prisma.storePaymentOrder.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundError('Order not found');
    return serializeOrder(order);
  }

  async completeMockOrder(userId: string, orderId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true } });
    if (!user?.isAdmin) throw new ForbiddenError('Only admin can complete test payment');
    return this.completeOrder(orderId, { requireUserId: userId, source: 'mock' });
  }

  async handleTelegramUpdate(update: TelegramUpdate) {
    if (update.pre_checkout_query) {
      return this.handlePreCheckout(update.pre_checkout_query);
    }

    const successfulPayment = update.message?.successful_payment;
    if (successfulPayment) {
      return this.handleSuccessfulPayment(successfulPayment);
    }

    return { ok: true, skipped: true };
  }

  async handleYooKassaWebhook(payload: YooKassaWebhookPayload) {
    const event = String(payload.event ?? '');
    const paymentId = String(payload.object?.id ?? '').trim();
    if (!paymentId) throw new BadRequestError('YooKassa payment id is missing');

    const payment = await getYooKassaPayment(paymentId);
    const orderId = orderIdFromYooKassaPayment(payment);

    if (payment.status === 'succeeded') {
      const result = await this.completeOrder(orderId, {
        source: 'yookassaSbp',
        currency: payment.amount?.currency,
        amount: kopecksFromYooKassaAmount(payment),
        providerPaymentChargeId: payment.id,
        providerPayload: safeProviderPayload(payment),
      });
      return { ok: true, order: result.order, subscription: result.subscription };
    }

    if (payment.status === 'canceled') {
      const order = await this.cancelYooKassaOrder(orderId, payment);
      return { ok: true, order };
    }

    return { ok: true, skipped: true, event, status: payment.status };
  }

  private async handlePreCheckout(query: NonNullable<TelegramUpdate['pre_checkout_query']>) {
    const queryId = String(query.id ?? '');
    if (!queryId) return { ok: false, reason: 'missing_pre_checkout_query_id' };

    try {
      const orderId = getOrderIdFromPayload(query.invoice_payload);
      const order = await prisma.storePaymentOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundError('Order not found');
      if (order.provider !== 'telegramStars') throw new BadRequestError('Wrong payment provider');
      if (order.status !== 'pending') throw new BadRequestError('Order is not pending');
      if (order.expiresAt && order.expiresAt.getTime() < Date.now()) throw new BadRequestError('Order expired');
      if (order.currency !== query.currency || order.amount !== query.total_amount) throw new BadRequestError('Payment amount changed');

      await answerTelegramPreCheckoutQuery(queryId, true);
      return { ok: true, orderId };
    } catch (error) {
      await answerTelegramPreCheckoutQuery(queryId, false, 'Платёж не прошёл проверку');
      return { ok: false, reason: error instanceof Error ? error.message : 'pre_checkout_failed' };
    }
  }

  private async handleSuccessfulPayment(payment: NonNullable<NonNullable<TelegramUpdate['message']>['successful_payment']>) {
    const orderId = getOrderIdFromPayload(payment.invoice_payload);
    const result = await this.completeOrder(orderId, {
      source: 'telegramStars',
      currency: payment.currency,
      amount: payment.total_amount,
      telegramPaymentChargeId: payment.telegram_payment_charge_id,
      providerPaymentChargeId: payment.provider_payment_charge_id,
    });
    return { ok: true, order: result.order, subscription: result.subscription };
  }

  private async cancelYooKassaOrder(orderId: string, payment: YooKassaPaymentObject) {
    const order = await prisma.storePaymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.status === 'paid' || order.status === 'cancelled') return serializeOrder(order);
    if (order.provider !== 'yookassaSbp') throw new BadRequestError('Wrong payment provider');

    const updated = await prisma.storePaymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        providerPaymentChargeId: payment.id,
        providerPayload: safeProviderPayload(payment),
      },
    });
    return serializeOrder(updated);
  }

  private async completeOrder(orderId: string, input: {
    requireUserId?: string;
    source: 'mock' | 'telegramStars' | 'yookassaSbp';
    currency?: string;
    amount?: number;
    telegramPaymentChargeId?: string;
    providerPaymentChargeId?: string;
    providerPayload?: string | null;
  }) {
    const order = await prisma.storePaymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (input.requireUserId && order.userId !== input.requireUserId) throw new NotFoundError('Order not found');

    if (order.status === 'paid') {
      return { order: serializeOrder(order), subscription: await subscriptionService.getStatus(order.userId) };
    }
    if (order.status !== 'pending') throw new BadRequestError('Order is not pending');
    if (input.source !== 'yookassaSbp' && order.expiresAt && order.expiresAt.getTime() < Date.now()) throw new BadRequestError('Order expired');

    if (input.source === 'telegramStars') {
      if (order.provider !== 'telegramStars') throw new BadRequestError('Wrong payment provider');
      if (order.currency !== input.currency || order.amount !== input.amount) throw new BadRequestError('Payment amount changed');
    }

    if (input.source === 'yookassaSbp') {
      if (order.provider !== 'yookassaSbp') throw new BadRequestError('Wrong payment provider');
      if (order.currency !== input.currency || order.amount !== input.amount) throw new BadRequestError('Payment amount changed');
      if (order.providerPaymentChargeId && order.providerPaymentChargeId !== input.providerPaymentChargeId) {
        throw new BadRequestError('Payment id changed');
      }
    }

    const payload = parseOrderPayload(order.payload);
    const days = typeof payload?.days === 'number' ? payload.days : order.duration === 'year' ? 365 : 30;
    const product = normalizeProduct(order.product);

    const updated = await prisma.storePaymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        telegramPaymentChargeId: input.telegramPaymentChargeId ?? order.telegramPaymentChargeId,
        providerPaymentChargeId: input.providerPaymentChargeId ?? order.providerPaymentChargeId,
        providerPayload: input.providerPayload ?? order.providerPayload,
      },
    });

    const subscription = isBundleProduct(product)
      ? await subscriptionService.grantBundle(order.userId, product)
      : await subscriptionService.grant(order.userId, { product, days });
    return { order: serializeOrder(updated), subscription };
  }
}

export const paymentService = new PaymentService();

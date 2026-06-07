import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import { subscriptionService, type StoreProduct } from '../subscription/service';
import { createTelegramStarsInvoiceLink, isTelegramStarsConfigured, answerTelegramPreCheckoutQuery } from './lib/telegram-stars';
import { getPricePlan, toStarsAmount, type PaymentDuration } from './lib/payment-pricing';

export type PaymentProvider = 'telegramStars' | 'crypto' | 'manual' | 'mock';

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

function normalizeProduct(value: unknown): StoreProduct {
  if (value === 'business') return 'business';
  if (value === 'premium' || value == null) return 'premium';
  throw new BadRequestError('Unknown product');
}

function normalizeDuration(value: unknown): PaymentDuration {
  if (value === 'year') return 'year';
  if (value === 'month' || value == null) return 'month';
  throw new BadRequestError('Unknown duration');
}

function normalizeProvider(value: unknown): PaymentProvider {
  if (value === 'telegramStars' || value === 'crypto' || value === 'manual' || value === 'mock') return value;
  if (value == null) return 'telegramStars';
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

export class PaymentService {
  getCatalog() {
    return {
      products: [
        {
          product: 'premium',
          title: 'Premium',
          options: this.getProductOptions('premium'),
        },
        {
          product: 'business',
          title: 'Business',
          options: this.getProductOptions('business'),
        },
      ],
      providers: ['telegramStars', 'crypto', 'manual', 'mock'] as PaymentProvider[],
      telegramStarsConfigured: isTelegramStarsConfigured(),
      starsRubRate: Number(process.env.TELEGRAM_STARS_RUB_RATE || 1),
    };
  }

  private getProductOptions(product: StoreProduct) {
    return (['month', 'year'] as PaymentDuration[]).map((duration) => {
      const plan = getPricePlan(product, duration);
      return {
        duration,
        amount: plan.amount,
        baseAmount: plan.baseAmount,
        discountPercent: plan.discountPercent,
        currency: plan.currency,
        starsAmount: toStarsAmount(plan.amount),
        starsCurrency: 'XTR',
        days: plan.days,
        monthsCharged: plan.monthsCharged,
      };
    });
  }

  async createCheckout(userId: string, input: CheckoutInput) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true } });
    if (!user) throw new NotFoundError('User not found');

    const product = normalizeProduct(input.product);
    const duration = normalizeDuration(input.duration);
    const provider = normalizeProvider(input.provider);
    const basePlan = getPricePlan(product, duration);
    const amount = provider === 'telegramStars' ? toStarsAmount(basePlan.amount) : basePlan.amount;
    const currency = provider === 'telegramStars' ? 'XTR' : basePlan.currency;
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
        baseAmount: provider === 'telegramStars' ? toStarsAmount(basePlan.baseAmount) : basePlan.baseAmount,
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

  private async completeOrder(orderId: string, input: {
    requireUserId?: string;
    source: 'mock' | 'telegramStars';
    currency?: string;
    amount?: number;
    telegramPaymentChargeId?: string;
    providerPaymentChargeId?: string;
  }) {
    const order = await prisma.storePaymentOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Order not found');
    if (input.requireUserId && order.userId !== input.requireUserId) throw new NotFoundError('Order not found');

    if (order.status === 'paid') {
      return { order: serializeOrder(order), subscription: await subscriptionService.getStatus(order.userId) };
    }
    if (order.status !== 'pending') throw new BadRequestError('Order is not pending');
    if (order.expiresAt && order.expiresAt.getTime() < Date.now()) throw new BadRequestError('Order expired');

    if (input.source === 'telegramStars') {
      if (order.provider !== 'telegramStars') throw new BadRequestError('Wrong payment provider');
      if (order.currency !== input.currency || order.amount !== input.amount) throw new BadRequestError('Payment amount changed');
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
      },
    });

    const subscription = await subscriptionService.grant(order.userId, { product, days });
    return { order: serializeOrder(updated), subscription };
  }
}

export const paymentService = new PaymentService();

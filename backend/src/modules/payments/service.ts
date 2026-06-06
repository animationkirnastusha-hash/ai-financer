import { prisma } from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/core/errors';
import { subscriptionService, type StoreProduct } from '../subscription/service';

export type PaymentProvider = 'telegramStars' | 'crypto' | 'manual' | 'mock';
export type PaymentDuration = 'month' | 'year';

type CheckoutInput = {
  product?: unknown;
  duration?: unknown;
  provider?: unknown;
};

const ORDER_TTL_MS = 30 * 60 * 1000;

const CATALOG: Record<StoreProduct, Record<PaymentDuration, { amount: number; currency: string; title: string; days: number }>> = {
  premium: {
    month: { amount: 29900, currency: 'RUB', title: 'Premium на месяц', days: 30 },
    year: { amount: 299000, currency: 'RUB', title: 'Premium на год', days: 365 },
  },
  business: {
    month: { amount: 99000, currency: 'RUB', title: 'Business на месяц', days: 30 },
    year: { amount: 990000, currency: 'RUB', title: 'Business на год', days: 365 },
  },
};

const STARS_CATALOG: Record<StoreProduct, Record<PaymentDuration, { amount: number; currency: string }>> = {
  premium: {
    month: { amount: 199, currency: 'XTR' },
    year: { amount: 1990, currency: 'XTR' },
  },
  business: {
    month: { amount: 699, currency: 'XTR' },
    year: { amount: 6990, currency: 'XTR' },
  },
};

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

function serializeOrder(order: Awaited<ReturnType<typeof prisma.storePaymentOrder.findUnique>>) {
  if (!order) return null;
  return {
    id: order.id,
    product: order.product,
    duration: order.duration,
    provider: order.provider,
    status: order.status,
    amount: order.amount,
    currency: order.currency,
    description: order.description,
    payload: order.payload ? safeParse(order.payload) : null,
    paidAt: order.paidAt?.toISOString() ?? null,
    expiresAt: order.expiresAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}

function safeParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
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
    };
  }

  private getProductOptions(product: StoreProduct) {
    return (['month', 'year'] as PaymentDuration[]).map((duration) => ({
      duration,
      amount: CATALOG[product][duration].amount,
      currency: CATALOG[product][duration].currency,
      starsAmount: STARS_CATALOG[product][duration].amount,
      starsCurrency: STARS_CATALOG[product][duration].currency,
      days: CATALOG[product][duration].days,
    }));
  }

  async createCheckout(userId: string, input: CheckoutInput) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isAdmin: true } });
    if (!user) throw new NotFoundError('User not found');

    const product = normalizeProduct(input.product);
    const duration = normalizeDuration(input.duration);
    const provider = normalizeProvider(input.provider);
    const plan = provider === 'telegramStars' ? STARS_CATALOG[product][duration] : CATALOG[product][duration];
    const basePlan = CATALOG[product][duration];
    const expiresAt = new Date(Date.now() + ORDER_TTL_MS);

    const payload = {
      product,
      duration,
      days: basePlan.days,
      provider,
      checkoutMode: provider === 'mock' ? 'admin_test' : provider,
    };

    const order = await prisma.storePaymentOrder.create({
      data: {
        userId,
        product,
        duration,
        provider,
        amount: plan.amount,
        currency: plan.currency,
        description: basePlan.title,
        expiresAt,
        payload: JSON.stringify(payload),
      },
    });

    return {
      order: serializeOrder(order),
      checkout: this.buildCheckout(order.provider as PaymentProvider, order.id, plan.amount, plan.currency, order.description, user.isAdmin),
    };
  }

  private buildCheckout(provider: PaymentProvider, orderId: string, amount: number, currency: string, description: string, isAdmin: boolean) {
    if (provider === 'telegramStars') {
      return {
        provider,
        status: 'ready',
        title: description,
        amount,
        currency,
        payload: `store_order:${orderId}`,
      };
    }

    if (provider === 'crypto') {
      return {
        provider,
        status: 'manual',
        title: description,
        amount,
        currency,
      };
    }

    if (provider === 'manual') {
      return {
        provider,
        status: 'manual',
        title: description,
        amount,
        currency,
      };
    }

    return {
      provider,
      status: isAdmin ? 'can_complete' : 'manual',
      title: description,
      amount,
      currency,
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

    const order = await prisma.storePaymentOrder.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundError('Order not found');
    if (order.status === 'paid') {
      return { order: serializeOrder(order), subscription: await subscriptionService.getStatus(userId) };
    }
    if (order.status !== 'pending') throw new BadRequestError('Order is not pending');
    if (order.expiresAt && order.expiresAt.getTime() < Date.now()) throw new BadRequestError('Order expired');

    const payload = order.payload ? safeParse(order.payload) : null;
    const days = typeof payload?.days === 'number' ? payload.days : order.duration === 'year' ? 365 : 30;
    const product = normalizeProduct(order.product);

    const updated = await prisma.storePaymentOrder.update({
      where: { id: order.id },
      data: { status: 'paid', paidAt: new Date() },
    });

    const subscription = await subscriptionService.grant(userId, { product, days });
    return { order: serializeOrder(updated), subscription };
  }
}

export const paymentService = new PaymentService();

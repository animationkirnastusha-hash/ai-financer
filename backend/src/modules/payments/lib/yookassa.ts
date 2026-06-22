import { env } from '../../../config/env';
import { BadRequestError } from '../../../shared/core/errors';

export type YooKassaConfirmation = {
  type?: string;
  confirmation_url?: string;
};

export type YooKassaPaymentObject = {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled' | string;
  paid?: boolean;
  amount?: {
    value?: string;
    currency?: string;
  };
  confirmation?: YooKassaConfirmation;
  metadata?: Record<string, unknown>;
  cancellation_details?: {
    party?: string;
    reason?: string;
  };
};

export type YooKassaWebhookPayload = {
  type?: string;
  event?: string;
  object?: YooKassaPaymentObject;
};

export type YooKassaCreatePaymentInput = {
  orderId: string;
  userId: string;
  amountKopecks: number;
  description: string;
  returnUrl: string;
};

function getCredentials() {
  const shopId = env.yookassaShopId.trim();
  const secretKey = env.yookassaSecretKey.trim();
  if (!env.yookassaEnabled || !shopId || !secretKey) {
    throw new BadRequestError('YooKassa is not configured');
  }
  return { shopId, secretKey };
}

function authHeader() {
  const { shopId, secretKey } = getCredentials();
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;
}

function amountToRubString(amountKopecks: number) {
  if (!Number.isInteger(amountKopecks) || amountKopecks <= 0) {
    throw new BadRequestError('Payment amount is invalid');
  }
  return (amountKopecks / 100).toFixed(2);
}

type YooKassaRequestInit = {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  idempotenceKey?: string;
};

async function callYooKassa<T>(path: string, init: YooKassaRequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.yookassa.ru/v3${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(init.idempotenceKey ? { 'Idempotence-Key': init.idempotenceKey } : {}),
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'description' in payload
      ? String((payload as { description?: unknown }).description || 'YooKassa request failed')
      : 'YooKassa request failed';
    throw new BadRequestError(message, payload);
  }
  return payload as T;
}

export function isYooKassaConfigured() {
  return Boolean(env.yookassaEnabled && env.yookassaShopId.trim() && env.yookassaSecretKey.trim());
}

export async function createYooKassaSbpPayment(input: YooKassaCreatePaymentInput) {
  const payload = {
    amount: {
      value: amountToRubString(input.amountKopecks),
      currency: 'RUB',
    },
    capture: true,
    payment_method_data: {
      type: 'sbp',
    },
    confirmation: {
      type: 'redirect',
      return_url: input.returnUrl,
    },
    description: input.description.slice(0, 128),
    metadata: {
      orderId: input.orderId,
      userId: input.userId,
      product: 'ai-financer-store',
    },
  };

  return callYooKassa<YooKassaPaymentObject>('/payments', {
    method: 'POST',
    idempotenceKey: `store-order-${input.orderId}`,
    body: JSON.stringify(payload),
  });
}

export async function getYooKassaPayment(paymentId: string) {
  if (!paymentId.trim()) throw new BadRequestError('YooKassa payment id is required');
  return callYooKassa<YooKassaPaymentObject>(`/payments/${encodeURIComponent(paymentId)}`);
}

export function getYooKassaReturnUrl(orderId: string) {
  const configured = env.yookassaReturnUrl.trim();
  if (configured) {
    const url = new URL(configured);
    url.searchParams.set('paymentOrderId', orderId);
    url.searchParams.set('paymentProvider', 'yookassaSbp');
    return url.toString();
  }

  const fallback = new URL(env.frontendUrl);
  fallback.searchParams.set('paymentOrderId', orderId);
  fallback.searchParams.set('paymentProvider', 'yookassaSbp');
  return fallback.toString();
}

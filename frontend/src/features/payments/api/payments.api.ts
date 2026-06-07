import { apiClient } from '@/shared/api/client';
import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';

export type StorePaymentProduct = 'premium' | 'business';
export type StorePaymentDuration = 'month' | 'year';
export type StorePaymentProvider = 'telegramStars' | 'crypto' | 'manual' | 'mock';

export type StorePaymentOrderDto = {
  id: string;
  product: StorePaymentProduct | string;
  duration: StorePaymentDuration | string;
  provider: StorePaymentProvider | string;
  status: 'pending' | 'paid' | 'cancelled' | 'failed' | string;
  amount: number;
  baseAmount?: number;
  discountPercent?: number;
  currency: string;
  description: string;
  payload: unknown;
  telegramInvoiceLink?: string | null;
  telegramPaymentChargeId?: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type StorePaymentCheckoutDto = {
  provider: StorePaymentProvider | string;
  status: string;
  title: string;
  amount: number;
  baseAmount?: number;
  discountPercent?: number;
  currency: string;
  payload?: string;
  invoiceLink?: string | null;
};

export type StorePaymentCatalogDto = {
  products: Array<{
    product: StorePaymentProduct | string;
    title: string;
    options: Array<{
      duration: StorePaymentDuration | string;
      amount: number;
      baseAmount?: number;
      discountPercent?: number;
      currency: string;
      starsAmount: number;
      starsBaseAmount?: number;
      starsCurrency: string;
      days: number;
      monthsCharged?: number;
    }>;
  }>;
  providers: string[];
  telegramStarsConfigured?: boolean;
};

export type CreatePaymentOrderPayload = {
  product: StorePaymentProduct;
  duration: StorePaymentDuration;
  provider: StorePaymentProvider;
};

export type CreatePaymentOrderResult = {
  order: StorePaymentOrderDto;
  checkout: StorePaymentCheckoutDto;
};

export type CompleteMockPaymentResult = {
  order: StorePaymentOrderDto;
  subscription: SubscriptionStatusDto;
};

export const paymentsApi = {
  catalog: () => apiClient.get<StorePaymentCatalogDto>('/payments/catalog'),
  createOrder: (payload: CreatePaymentOrderPayload) => apiClient.post<CreatePaymentOrderResult>('/payments/orders', payload),
  getOrder: (orderId: string) => apiClient.get<StorePaymentOrderDto>(`/payments/orders/${encodeURIComponent(orderId)}`),
  completeMock: (orderId: string) => apiClient.post<CompleteMockPaymentResult>(`/payments/orders/${encodeURIComponent(orderId)}/mock-complete`),
};

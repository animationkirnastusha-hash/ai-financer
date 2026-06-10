import { getAccessToken } from '@/features/auth/lib/accessToken';
import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { env } from '@/shared/config/env';

export type ReceiptScanPreviewDto = {
  title: string;
  caption: string;
  fields: Array<{ label: string; value: string }>;
};

export type ReceiptScanDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  merchant: string | null;
  totalAmount: number | null;
  currency: string;
  purchasedAt: string | null;
  preview: ReceiptScanPreviewDto | null;
  createdAt: string;
  updatedAt: string;
};

export type ReceiptScanListDto = {
  items: ReceiptScanDto[];
};

export type ReceiptScanUploadDto = {
  scan: ReceiptScanDto;
  subscription: SubscriptionStatusDto;
};

export type ReviewReceiptScanPayload = Partial<{
  merchant: string | null;
  totalAmount: number | null;
  currency: string;
  purchasedAt: string | null;
  rawText: string | null;
}>;

export type CreateReceiptExpensePayload = {
  accountId: string;
  amount?: number | null;
  title?: string | null;
  description?: string | null;
  date?: string | null;
  categoryId?: string | null;
  sectionId?: string | null;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null
      ? String((payload as { error?: { message?: unknown }; message?: unknown }).error?.message
        || (payload as { message?: unknown }).message
        || `Request failed with status ${response.status}`)
      : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', ...authHeaders() };
}

export const receiptScansApi = {
  list: async () => {
    const response = await fetch(`${env.apiBaseUrl}/receipt-scans`, {
      headers: authHeaders(),
    });
    return parseResponse<ReceiptScanListDto>(response);
  },

  upload: async (file: File) => {
    const body = new FormData();
    body.append('receipt', file);
    const response = await fetch(`${env.apiBaseUrl}/receipt-scans/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body,
    });
    return parseResponse<ReceiptScanUploadDto>(response);
  },

  review: async (receiptScanId: string, payload: ReviewReceiptScanPayload) => {
    const response = await fetch(`${env.apiBaseUrl}/receipt-scans/${receiptScanId}/review`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });
    return parseResponse<{ scan: ReceiptScanDto }>(response);
  },

  createExpense: async (receiptScanId: string, payload: CreateReceiptExpensePayload) => {
    const response = await fetch(`${env.apiBaseUrl}/receipt-scans/${receiptScanId}/create-expense`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(payload),
    });
    return parseResponse<{ scan: ReceiptScanDto; transaction: TransactionDto }>(response);
  },
};

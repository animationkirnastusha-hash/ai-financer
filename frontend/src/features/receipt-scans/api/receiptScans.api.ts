import { getAccessToken } from '@/features/auth/lib/accessToken';
import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';
import { env } from '@/shared/config/env';

export type ReceiptScanPreviewGroupDto = {
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  amount: number;
  categories: Array<{
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    amount: number;
    items: Array<{ title: string; amount: number | null }>;
  }>;
};

export type ReceiptScanPreviewDto = {
  title: string;
  caption: string;
  fields: Array<{ label: string; value: string }>;
  groups?: ReceiptScanPreviewGroupDto[];
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
  accountId: string | null;
  categoryId: string | null;
  transactionId: string | null;
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
  currency: string | null;
  purchasedAt: string | null;
  accountId: string | null;
  categoryId: string | null;
  rawText: string | null;
}>;

export type CreateReceiptExpensePayload = {
  accountId: string;
  amount?: number | null;
  totalAmount?: number | null;
  title?: string | null;
  description?: string | null;
  date?: string | null;
  purchasedAt?: string | null;
  categoryId?: string | null;
  currency?: string | null;
  merchant?: string | null;
};

export function getReceiptUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  if (lower.includes('too large') || lower.includes('file_size') || lower.includes('payload')) return 'Файл слишком большой. Выберите чек до 20 МБ.';
  if (lower.includes('unsupported') || lower.includes('type')) return 'Формат файла не поддерживается. Лучше загрузить JPG, PNG, WEBP или PDF.';
  if (lower.includes('empty')) return 'Файл пустой. Выберите другой чек.';
  if (lower.includes('limit reached') || lower.includes('forbidden')) return 'Лимит чеков закончился.';
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('load fail')) return 'Не удалось загрузить чек. Проверьте соединение и попробуйте ещё раз.';
  return message || 'Не удалось загрузить чек.';
}

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

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getAccessToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

function normalizeExpensePayload(payload: CreateReceiptExpensePayload): ReviewReceiptScanPayload & { title?: string | null; description?: string | null } {
  return {
    accountId: payload.accountId,
    categoryId: payload.categoryId ?? null,
    totalAmount: payload.totalAmount ?? payload.amount ?? null,
    purchasedAt: payload.purchasedAt ?? payload.date ?? null,
    currency: payload.currency ?? 'RUB',
    merchant: payload.merchant ?? payload.title ?? null,
    title: payload.title ?? null,
    description: payload.description ?? null,
  };
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
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    return parseResponse<{ scan: ReceiptScanDto }>(response);
  },

  createExpense: async (receiptScanId: string, payload: CreateReceiptExpensePayload) => {
    const response = await fetch(`${env.apiBaseUrl}/receipt-scans/${receiptScanId}/expense`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(normalizeExpensePayload(payload)),
    });
    return parseResponse<{ scan: ReceiptScanDto; transactionId: string }>(response);
  },
};

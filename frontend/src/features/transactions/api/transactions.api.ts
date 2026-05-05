import { apiClient } from '@/shared/api/client';
import { env } from '@/shared/config/env';

export type TransactionDto = {
  id: string;
  userId: string;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description?: string | null;
  date: string;
  isAIGenerated?: boolean;
  createdAt?: string;
  updatedAt?: string;
  account?: {
    id: string;
    name: string;
    currency: string;
    icon?: string | null;
    color?: string | null;
  };
  toAccount?: {
    id: string;
    name: string;
    currency: string;
    icon?: string | null;
    color?: string | null;
  } | null;
  category?: {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    type?: string;
  } | null;
};

export type UpdateTransactionPayload = {
  accountId?: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  description?: string | null;
  date?: string;
};

export type MonthlyStatsDto = {
  period: {
    startDate: string;
    endDate: string;
  };
  income: number;
  expenses: number;
  balance: number;
  count: number;
  topCategories: Array<{
    name: string;
    icon?: string | null;
    amount: number;
    count: number;
  }>;
  transactions: TransactionDto[];
};

type TransactionsResponse =
  | TransactionDto[]
  | {
      transactions?: TransactionDto[];
      total?: number;
    };

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-token');

  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
}

function unwrapTransaction(payload: any): TransactionDto {
  return payload?.transaction ?? payload;
}

export async function fetchTransactions(limit = 100): Promise<TransactionDto[]> {
  const response = await fetch(`${env.apiBaseUrl}/transactions?limit=${limit}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const payload: TransactionsResponse = await response.json();

  if (!response.ok) {
    throw new Error(
      (payload as any)?.error?.message ||
        (payload as any)?.message ||
        'Failed to fetch transactions',
    );
  }

  if (Array.isArray(payload)) return payload;

  return Array.isArray(payload.transactions) ? payload.transactions : [];
}

export async function fetchLatestTransaction(): Promise<TransactionDto | null> {
  const response = await apiClient.get<{ transaction?: TransactionDto | null }>('/transactions/latest');
  return response.transaction ?? null;
}

export async function fetchMonthlyTransactionStats(category?: string): Promise<MonthlyStatsDto> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return apiClient.get<MonthlyStatsDto>(`/transactions/stats/monthly${query}`);
}

export async function updateTransaction(
  transactionId: string,
  payload: UpdateTransactionPayload,
): Promise<TransactionDto> {
  const response = await apiClient.patch<any>(`/transactions/${transactionId}`, payload);
  return unwrapTransaction(response);
}

export async function deleteTransaction(transactionId: string): Promise<TransactionDto> {
  const response = await apiClient.delete<any>(`/transactions/${transactionId}`);
  return unwrapTransaction(response);
}

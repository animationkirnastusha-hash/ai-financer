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
  };
  toAccount?: {
    id: string;
    name: string;
    currency: string;
  } | null;
  category?: {
    id: string;
    name: string;
    icon?: string | null;
    color?: string | null;
    type?: string;
  } | null;
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

export async function fetchTransactions(): Promise<TransactionDto[]> {
  const response = await fetch(`${env.apiBaseUrl}/transactions?limit=100`, {
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
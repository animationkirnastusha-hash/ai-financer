import { apiClient } from '@/shared/api/client';

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

export type MonthlyStatsDto = {
  period?: {
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
  transactions?: TransactionDto[];
};

type TransactionsResponse =
  | TransactionDto[]
  | {
      transactions?: TransactionDto[];
      total?: number;
    };

type LatestResponse =
  | TransactionDto
  | null
  | {
      transaction?: TransactionDto | null;
    };

function extractTransactions(payload: TransactionsResponse): TransactionDto[] {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.transactions) ? payload.transactions : [];
}

function isTransactionDto(value: unknown): value is TransactionDto {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'accountId' in value &&
      'amount' in value &&
      'type' in value,
  );
}

function extractLatest(payload: LatestResponse): TransactionDto | null {
  if (!payload) return null;
  if (isTransactionDto(payload)) return payload;
  return payload.transaction ?? null;
}

export async function fetchTransactions(limit = 100): Promise<TransactionDto[]> {
  const payload = await apiClient.get<TransactionsResponse>(`/transactions?limit=${limit}`);
  return extractTransactions(payload);
}

export async function fetchLatestTransaction(): Promise<TransactionDto | null> {
  const payload = await apiClient.get<LatestResponse>('/transactions/latest');
  return extractLatest(payload);
}

export async function fetchMonthlyStats(): Promise<MonthlyStatsDto> {
  return apiClient.get<MonthlyStatsDto>('/transactions/stats/monthly');
}

export async function updateTransaction(
  id: string,
  payload: Partial<Pick<TransactionDto, 'amount' | 'description' | 'date' | 'accountId' | 'categoryId' | 'type' | 'toAccountId'>>,
): Promise<TransactionDto> {
  const response = await apiClient.patch<{ transaction?: TransactionDto } | TransactionDto>(
    `/transactions/${id}`,
    payload,
  );

  return 'transaction' in response && response.transaction ? response.transaction : (response as TransactionDto);
}

export async function deleteTransaction(id: string): Promise<TransactionDto | null> {
  const response = await apiClient.delete<{ transaction?: TransactionDto } | TransactionDto>(`/transactions/${id}`);

  if ('transaction' in response) return response.transaction ?? null;
  return response as TransactionDto;
}

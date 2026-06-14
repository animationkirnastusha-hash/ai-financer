import type { TransactionDto } from '@/features/transactions/api/transactions.api';

export type JournalPeriod = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';
export type JournalTypeFilter = 'all' | TransactionDto['type'];

export type JournalTagOption = {
  value: string;
  label: string;
  count: number;
};

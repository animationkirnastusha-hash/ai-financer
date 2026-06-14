export type JournalPeriod = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

export type JournalTypeFilter = 'all' | 'income' | 'expense' | 'transfer';

export type JournalTagOption = {
  value: string;
  label: string;
  count: number;
};

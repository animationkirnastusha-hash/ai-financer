import { useEffect } from 'react';

import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';

export function FinanceBootstrap() {
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);

  useEffect(() => {
    void Promise.allSettled([loadAccounts(true), loadTransactions(true)]);
  }, [loadAccounts, loadTransactions]);

  return null;
}
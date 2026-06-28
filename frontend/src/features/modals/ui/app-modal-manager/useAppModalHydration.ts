import { useEffect } from 'react';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import type { AppModalDependencies } from './useAppModalDependencies';

export function useAppModalHydration(stack: AppModalDescriptor[], deps: AppModalDependencies) {
  useEffect(() => {
    if (stack.some((modal) => ['account-details', 'account-edit'].includes(modal.type))) {
      void deps.loadAccounts();
    }
  }, [deps.loadAccounts, stack]);

  useEffect(() => {
    if (stack.some((modal) => ['category-edit', 'section-edit', 'taxonomy-section', 'taxonomy-tools'].includes(modal.type))) {
      void deps.loadTaxonomy();
    }
  }, [deps.loadTaxonomy, stack]);

  useEffect(() => {
    if (stack.some((modal) => ['home-chart-details', 'home-category-operations', 'transaction-edit'].includes(modal.type))) {
      void deps.loadTransactions(true);
    }
  }, [deps.loadTransactions, stack]);
}

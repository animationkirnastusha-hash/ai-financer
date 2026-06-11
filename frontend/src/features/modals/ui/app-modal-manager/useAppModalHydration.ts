import { useEffect } from 'react';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import { pickModal } from '@/features/modals/lib/modalLayers';
import type { AppModalDependencies } from './useAppModalDependencies';

export function useAppModalHydration(stack: AppModalDescriptor[], deps: AppModalDependencies) {
  const accountCreateModal = pickModal(stack, 'account-create');

  useEffect(() => {
    if (!accountCreateModal) return;
    deps.updateAccountDraft(accountCreateModal.prefill ?? {});
  }, [accountCreateModal, deps.updateAccountDraft]);

  useEffect(() => {
    if (stack.some((modal) => ['account-details', 'account-transfer', 'account-edit'].includes(modal.type))) {
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

  useEffect(() => {
    if (stack.some((modal) => modal.type === 'obligation-edit')) {
      void Promise.allSettled([deps.loadAccounts(), deps.loadObligations(true)]);
    }
  }, [deps.loadAccounts, deps.loadObligations, stack]);
}

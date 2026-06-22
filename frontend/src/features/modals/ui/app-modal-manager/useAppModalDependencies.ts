import { useMemo } from 'react';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';

export function useAppModalDependencies() {
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const createAccount = useAccountsStore((state) => state.createAccount);
  const updateAccount = useAccountsStore((state) => state.updateAccount);
  const deleteAccount = useAccountsStore((state) => state.deleteAccount);
  const isDeletingAccount = useAccountsStore((state) => state.isDeleting);
  const isUpdatingAccount = useAccountsStore((state) => state.isUpdating);

  const setPrimaryAccountId = useSettingsStore((state) => state.setPrimaryAccountId);
  const setIncomeAccountId = useSettingsStore((state) => state.setIncomeAccountId);
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const incomeAccountId = useSettingsStore((state) => state.incomeAccountId);
  const setMainCurrency = useSettingsStore((state) => state.setMainCurrency);
  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const createTransaction = useTransactionsStore((state) => state.createItem);
  const createTransfer = useTransactionsStore((state) => state.createTransfer);
  const updateTransaction = useTransactionsStore((state) => state.updateItem);
  const deleteTransaction = useTransactionsStore((state) => state.deleteItem);
  const isTransactionSaving = useTransactionsStore((state) => state.isMutating);

  const sections = useSectionsStore((state) => state.sections);
  const categories = useSectionsStore((state) => state.categories);
  const loadTaxonomy = useSectionsStore((state) => state.loadAll);
  const createSection = useSectionsStore((state) => state.createSection);
  const updateSection = useSectionsStore((state) => state.updateSection);
  const deleteSection = useSectionsStore((state) => state.deleteSection);
  const createCategory = useSectionsStore((state) => state.createCategory);
  const updateCategory = useSectionsStore((state) => state.updateCategory);
  const deleteCategory = useSectionsStore((state) => state.deleteCategory);
  const isCreatingTaxonomy = useSectionsStore((state) => state.isCreating);
  const isTaxonomySaving = useSectionsStore((state) => state.isMutating);

  const loadObligations = useObligationsStore((state) => state.loadAll);
  const createLoan = useObligationsStore((state) => state.createLoan);
  const updateLoan = useObligationsStore((state) => state.updateLoan);
  const deleteLoan = useObligationsStore((state) => state.deleteLoan);
  const isObligationSaving = useObligationsStore((state) => state.isMutating);

  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);

  const updateAccountDraft = useAccountFlowStore((state) => state.updateDraft);
  const resetAccountDraft = useAccountFlowStore((state) => state.resetDraft);

  const rates = useMemo(() => ({ usd: rubToUsdRate || 90, eur: rubToEurRate || 100 }), [rubToEurRate, rubToUsdRate]);

  async function refreshFinance() {
    await Promise.allSettled([loadAccounts(true), loadTransactions(true), loadTaxonomy(true)]);
  }

  return {
    accounts,
    categories,
    createAccount,
    createCategory,
    createLoan,
    createSection,
    createTransaction,
    createTransfer,
    deleteAccount,
    deleteCategory,
    deleteLoan,
    deleteSection,
    deleteTransaction,
    incomeAccountId,
    isCreatingTaxonomy,
    isDeletingAccount,
    isObligationSaving,
    isTaxonomySaving,
    isTransactionSaving,
    isUpdatingAccount,
    loadAccounts,
    loadObligations,
    loadTaxonomy,
    loadTransactions,
    mainCurrency,
    navigateTo,
    primaryAccountId,
    rates,
    refreshFinance,
    resetAccountDraft,
    sections,
    setIncomeAccountId,
    setMainCurrency,
    setPrimaryAccountId,
    subscription,
    loadSubscription,
    transactions,
    updateAccount,
    updateAccountDraft,
    updateCategory,
    updateLoan,
    updateSection,
    updateTransaction,
  };
}

export type AppModalDependencies = ReturnType<typeof useAppModalDependencies>;

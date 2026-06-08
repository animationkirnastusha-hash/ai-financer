import { Fragment, useEffect, useMemo } from 'react';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore, type AppModalDescriptor } from '@/features/modals/model/appModal.store';
import { useObligationsStore } from '@/features/obligations/model/obligations.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { AccountModals } from '@/features/modals/ui/AccountModals';
import { AppModalBodyLock } from '@/features/modals/ui/AppModalBodyLock';
import { FinanceEntityModals } from '@/features/modals/ui/FinanceEntityModals';
import { HomeFinanceModals } from '@/features/modals/ui/HomeFinanceModals';
import { ObligationModals } from '@/features/modals/ui/ObligationModals';
import { NotificationSheet } from '@/features/notifications/ui/NotificationSheet';
import { UtilityModals } from '@/features/modals/ui/UtilityModals';
import { ReportExportSheet } from '@/features/reports/ui/ReportExportSheet';
import { TextChatOverlay } from '@/features/chat/ui/TextChatOverlay';
import { layerByIndex, pickModal } from '@/features/modals/lib/modalLayers';

const ACCOUNT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['account-create', 'account-details', 'account-transfer', 'account-edit']);
const FINANCE_ENTITY_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['transaction-create', 'transaction-edit', 'category-edit', 'section-edit', 'goal-edit']);
const HOME_FINANCE_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['home-chart-details', 'home-category-operations']);
const OBLIGATION_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['obligation-edit']);
const NOTIFICATION_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['notifications']);
const REPORT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['report-export']);
const TEXT_CHAT_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['ai-text-overlay']);
const UTILITY_MODAL_TYPES = new Set<AppModalDescriptor['type']>(['accounts-tools', 'taxonomy-tools', 'taxonomy-section']);

function isAccountModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'account-create' | 'account-details' | 'account-transfer' | 'account-edit' }> {
  return ACCOUNT_MODAL_TYPES.has(modal.type);
}

function isFinanceEntityModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'transaction-create' | 'transaction-edit' | 'category-edit' | 'section-edit' | 'goal-edit' }> {
  return FINANCE_ENTITY_MODAL_TYPES.has(modal.type);
}

function isHomeFinanceModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'home-chart-details' | 'home-category-operations' }> {
  return HOME_FINANCE_MODAL_TYPES.has(modal.type);
}

function isObligationModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'obligation-edit' }> {
  return OBLIGATION_MODAL_TYPES.has(modal.type);
}

function isUtilityModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'accounts-tools' | 'taxonomy-tools' | 'taxonomy-section' }> {
  return UTILITY_MODAL_TYPES.has(modal.type);
}

function isNotificationModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'notifications' }> {
  return NOTIFICATION_MODAL_TYPES.has(modal.type);
}

function isReportModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'report-export' }> {
  return REPORT_MODAL_TYPES.has(modal.type);
}

function isTextChatModal(modal: AppModalDescriptor): modal is Extract<AppModalDescriptor, { type: 'ai-text-overlay' }> {
  return TEXT_CHAT_MODAL_TYPES.has(modal.type);
}

export function AppModalManager() {
  const stack = useAppModalStore((state) => state.stack);
  const openModal = useAppModalStore((state) => state.openModal);
  const closeModal = useAppModalStore((state) => state.closeModal);
  const closeAllModals = useAppModalStore((state) => state.closeAllModals);
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

  const updateAccountDraft = useAccountFlowStore((state) => state.updateDraft);
  const resetAccountDraft = useAccountFlowStore((state) => state.resetDraft);
  const accountCreateModal = pickModal(stack, 'account-create');
  const rates = useMemo(() => ({ usd: rubToUsdRate || 90, eur: rubToEurRate || 100 }), [rubToEurRate, rubToUsdRate]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ command?: string | null; mode?: 'text' | 'voice'; autoStartVoice?: boolean; autoCloseOnVoiceResult?: boolean; autoSubmitInitialCommand?: boolean }>).detail;
      openModal({ type: 'ai-text-overlay', initialCommand: detail?.command ?? null, mode: detail?.mode ?? 'text', autoStartVoice: Boolean(detail?.autoStartVoice), autoCloseOnVoiceResult: Boolean(detail?.autoCloseOnVoiceResult), autoSubmitInitialCommand: Boolean(detail?.autoSubmitInitialCommand) });
    };

    window.addEventListener('ai-financer:open-text-chat', handler);
    return () => window.removeEventListener('ai-financer:open-text-chat', handler);
  }, [openModal]);

  async function refreshFinance() {
    await Promise.allSettled([loadAccounts(true), loadTransactions(true), loadTaxonomy(true)]);
  }

  useEffect(() => {
    if (!accountCreateModal) return;
    updateAccountDraft(accountCreateModal.prefill ?? {});
  }, [accountCreateModal, updateAccountDraft]);

  useEffect(() => {
    if (stack.some((modal) => ['account-details', 'account-transfer', 'account-edit'].includes(modal.type))) void loadAccounts();
  }, [loadAccounts, stack]);

  useEffect(() => {
    if (stack.some((modal) => ['category-edit', 'section-edit', 'taxonomy-section', 'taxonomy-tools'].includes(modal.type))) void loadTaxonomy();
  }, [loadTaxonomy, stack]);

  useEffect(() => {
    if (stack.some((modal) => ['home-chart-details', 'home-category-operations', 'transaction-edit'].includes(modal.type))) void loadTransactions(true);
  }, [loadTransactions, stack]);

  useEffect(() => {
    if (stack.some((modal) => modal.type === 'obligation-edit')) void Promise.allSettled([loadAccounts(), loadObligations(true)]);
  }, [loadAccounts, loadObligations, stack]);

  function renderModal(modal: AppModalDescriptor, index: number) {
    const layer = layerByIndex(index);
    if (isAccountModal(modal)) {
      return (
        <AccountModals
          modal={modal}
          accounts={accounts}
          primaryAccountId={primaryAccountId}
          incomeAccountId={incomeAccountId}
          isDeletingAccount={isDeletingAccount}
          isUpdatingAccount={isUpdatingAccount}
          isTransactionSaving={isTransactionSaving}
          closeModal={closeModal}
          openModal={openModal}
          resetAccountDraft={resetAccountDraft}
          createAccount={createAccount}
          updateAccount={updateAccount}
          deleteAccount={deleteAccount}
          loadAccounts={loadAccounts}
          refreshFinance={refreshFinance}
          setPrimaryAccountId={setPrimaryAccountId}
          setIncomeAccountId={setIncomeAccountId}
          createTransfer={createTransfer}
          navigateToAI={() => openModal({ type: 'ai-text-overlay' })}
        />
      );
    }

    if (isFinanceEntityModal(modal)) {
      return (
        <FinanceEntityModals
          modal={modal}
          layer={layer}
          sections={sections}
          isTransactionSaving={isTransactionSaving}
          isCreatingTaxonomy={isCreatingTaxonomy}
          isTaxonomySaving={isTaxonomySaving}
          closeModal={closeModal}
          refreshFinance={refreshFinance}
          createTransaction={createTransaction}
          updateTransaction={updateTransaction}
          deleteTransaction={deleteTransaction}
          createSection={createSection}
          updateSection={updateSection}
          deleteSection={deleteSection}
          createCategory={createCategory}
          updateCategory={updateCategory}
          deleteCategory={deleteCategory}
          loadTaxonomy={loadTaxonomy}
        />
      );
    }

    if (isHomeFinanceModal(modal)) {
      return (
        <HomeFinanceModals
          modal={modal}
          layer={layer}
          stack={stack}
          transactions={transactions}
          rates={rates}
          closeModal={closeModal}
          closeAllModals={closeAllModals}
          openModal={openModal}
          openAnalytics={() => navigateTo('analytics')}
          openAnalyticsReport={() => {
            closeAllModals();
            navigateTo('analytics');
            openModal({ type: 'report-export', mode: 'base' });
          }}
        />
      );
    }


    if (isObligationModal(modal)) {
      return (
        <ObligationModals
          modal={modal}
          layer={layer}
          accounts={accounts}
          isSaving={isObligationSaving}
          closeModal={closeModal}
          createLoan={createLoan}
          updateLoan={updateLoan}
          deleteLoan={deleteLoan}
        />
      );
    }


    if (isNotificationModal(modal)) {
      return (
        <NotificationSheet
          open
          layer={layer}
          onClose={() => closeModal('notifications')}
        />
      );
    }

    if (isReportModal(modal)) {
      return (
        <ReportExportSheet
          open
          mode={modal.mode ?? 'base'}
          layer={layer}
          onClose={() => closeModal('report-export')}
        />
      );
    }

    if (isTextChatModal(modal)) {
      return (
        <TextChatOverlay
          open
          initialCommand={modal.initialCommand ?? null}
          mode={modal.mode ?? 'text'}
          autoStartVoice={Boolean(modal.autoStartVoice)}
          autoCloseOnVoiceResult={Boolean(modal.autoCloseOnVoiceResult)}
          autoSubmitInitialCommand={Boolean(modal.autoSubmitInitialCommand)}
          layer={layer}
          onClose={() => closeModal('ai-text-overlay')}
        />
      );
    }

    if (isUtilityModal(modal)) {
      return (
        <UtilityModals
          modal={modal}
          layer={layer}
          accounts={accounts}
          categories={categories}
          primaryAccountId={primaryAccountId}
          incomeAccountId={incomeAccountId}
          mainCurrency={mainCurrency}
          closeModal={closeModal}
          openModal={openModal}
          setMainCurrency={setMainCurrency}
        />
      );
    }

    return null;
  }

  return (
    <>
      <AppModalBodyLock active={stack.length > 0} />
      {stack.map((modal, index) => (
        <Fragment key={`${modal.type}-${index}`}>{renderModal(modal, index)}</Fragment>
      ))}
    </>
  );
}

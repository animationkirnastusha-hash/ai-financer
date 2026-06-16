import { AccountModals } from '@/features/modals/ui/AccountModals';
import { FinanceEntityModals } from '@/features/modals/ui/FinanceEntityModals';
import { HomeFinanceModals } from '@/features/modals/ui/HomeFinanceModals';
import { ObligationModals } from '@/features/modals/ui/ObligationModals';
import { NotificationSheet } from '@/features/notifications/ui/NotificationSheet';
import { UtilityModals } from '@/features/modals/ui/UtilityModals';
import { ReportExportSheet } from '@/features/reports/ui/ReportExportSheet';
import { TextChatOverlay } from '@/features/chat/ui/TextChatOverlay';
import { TrialOfferSheet } from '@/features/subscription/ui/TrialOfferSheet';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import { layerByIndex } from '@/features/modals/lib/modalLayers';
import type { AppModalDependencies } from './useAppModalDependencies';
import {
  isAccountModal,
  isFinanceEntityModal,
  isHomeFinanceModal,
  isNotificationModal,
  isObligationModal,
  isReportModal,
  isTextChatModal,
  isTrialOfferModal,
  isUtilityModal,
} from './modalTypeGuards';

type CloseModal = (type?: AppModalDescriptor['type']) => void;
type CloseAllModals = () => void;
type OpenModal = (modal: AppModalDescriptor) => void;

type Props = {
  closeAllModals: CloseAllModals;
  closeModal: CloseModal;
  deps: AppModalDependencies;
  index: number;
  modal: AppModalDescriptor;
  openModal: OpenModal;
  stack: AppModalDescriptor[];
};

export function AppModalRenderer({ closeAllModals, closeModal, deps, index, modal, openModal, stack }: Props) {
  const layer = layerByIndex(index);

  if (isAccountModal(modal)) {
    return (
      <AccountModals
        modal={modal}
        accounts={deps.accounts}
        primaryAccountId={deps.primaryAccountId}
        incomeAccountId={deps.incomeAccountId}
        isDeletingAccount={deps.isDeletingAccount}
        isUpdatingAccount={deps.isUpdatingAccount}
        isTransactionSaving={deps.isTransactionSaving}
        closeModal={closeModal}
        openModal={openModal}
        resetAccountDraft={deps.resetAccountDraft}
        createAccount={deps.createAccount}
        updateAccount={deps.updateAccount}
        deleteAccount={deps.deleteAccount}
        loadAccounts={deps.loadAccounts}
        refreshFinance={deps.refreshFinance}
        setPrimaryAccountId={deps.setPrimaryAccountId}
        setIncomeAccountId={deps.setIncomeAccountId}
        createTransfer={deps.createTransfer}
        navigateToAI={() => openModal({ type: 'ai-text-overlay' })}
      />
    );
  }

  if (isFinanceEntityModal(modal)) {
    return (
      <FinanceEntityModals
        modal={modal}
        layer={layer}
        sections={deps.sections}
        isTransactionSaving={deps.isTransactionSaving}
        isCreatingTaxonomy={deps.isCreatingTaxonomy}
        isTaxonomySaving={deps.isTaxonomySaving}
        closeModal={closeModal}
        refreshFinance={deps.refreshFinance}
        createTransaction={deps.createTransaction}
        updateTransaction={deps.updateTransaction}
        deleteTransaction={deps.deleteTransaction}
        createSection={deps.createSection}
        updateSection={deps.updateSection}
        deleteSection={deps.deleteSection}
        createCategory={deps.createCategory}
        updateCategory={deps.updateCategory}
        deleteCategory={deps.deleteCategory}
        loadTaxonomy={deps.loadTaxonomy}
      />
    );
  }

  if (isHomeFinanceModal(modal)) {
    return (
      <HomeFinanceModals
        modal={modal}
        layer={layer}
        stack={stack}
        transactions={deps.transactions}
        rates={deps.rates}
        closeModal={closeModal}
        closeAllModals={closeAllModals}
        openModal={openModal}
        openAnalytics={() => deps.navigateTo('analytics')}
        openAnalyticsReport={() => {
          closeAllModals();
          deps.navigateTo('analytics');
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
        accounts={deps.accounts}
        isSaving={deps.isObligationSaving}
        closeModal={closeModal}
        createLoan={deps.createLoan}
        updateLoan={deps.updateLoan}
        deleteLoan={deps.deleteLoan}
      />
    );
  }

  if (isNotificationModal(modal)) {
    return <NotificationSheet open layer={layer} onClose={() => closeModal('notifications')} />;
  }

  if (isReportModal(modal)) {
    return <ReportExportSheet open mode={modal.mode ?? 'base'} layer={layer} onClose={() => closeModal('report-export')} />;
  }


  if (isTrialOfferModal(modal)) {
    return <TrialOfferSheet open layer={layer} source={modal.source ?? 'manual'} onClose={() => closeModal('trial-offer')} />;
  }

  if (isTextChatModal(modal)) {
    return (
      <TextChatOverlay
        open
        initialCommand={modal.initialCommand ?? null}
        initialAssistantMessage={modal.initialAssistantMessage ?? null}
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
        accounts={deps.accounts}
        categories={deps.categories}
        primaryAccountId={deps.primaryAccountId}
        incomeAccountId={deps.incomeAccountId}
        mainCurrency={deps.mainCurrency}
        closeModal={closeModal}
        openModal={openModal}
        setMainCurrency={deps.setMainCurrency}
      />
    );
  }

  return null;
}

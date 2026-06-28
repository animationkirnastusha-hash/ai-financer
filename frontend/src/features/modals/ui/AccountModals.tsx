import { AccountDetailsSheet } from '@/features/accounts/ui/AccountDetailsSheet';
import { EditAccountModal } from '@/features/accounts/ui/EditAccountModal';
import type { AccountDto, UpdateAccountPayload } from '@/features/accounts/api/accounts.api';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import { useI18n } from '@/shared/lib/i18n';

type AccountModal = Extract<AppModalDescriptor, { type: 'account-details' | 'account-edit' }>;

type Props = {
  modal: AccountModal;
  accounts: AccountDto[];
  primaryAccountId: string | null;
  incomeAccountId: string | null;
  isDeletingAccount: boolean;
  isUpdatingAccount: boolean;
  closeModal: (type?: AppModalDescriptor['type']) => void;
  openModal: (modal: AppModalDescriptor) => void;
  updateAccount: (id: string, payload: UpdateAccountPayload) => Promise<unknown>;
  deleteAccount: (id: string) => Promise<unknown>;
  refreshFinance: () => Promise<void>;
  setPrimaryAccountId: (id: string | null) => void;
  setIncomeAccountId: (id: string | null) => void;
};

export function AccountModals({
  modal,
  accounts,
  primaryAccountId,
  incomeAccountId,
  isDeletingAccount,
  isUpdatingAccount,
  closeModal,
  openModal,
  updateAccount,
  deleteAccount,
  refreshFinance,
  setPrimaryAccountId,
  setIncomeAccountId,
}: Props) {
  const { t } = useI18n();

  switch (modal.type) {
    case 'account-details': {
      const account = accounts.find((item) => item.id === modal.accountId) ?? null;
      const openAccountAI = (nextAccount: AccountDto, mode: 'transfer' | 'settings') => {
        closeModal('account-details');
        openModal({
          type: 'ai-text-overlay',
          initialAssistantMessage: mode === 'transfer'
            ? t('accounts.ai.transfer.message', { name: nextAccount.name })
            : t('accounts.ai.settings.message', { name: nextAccount.name }),
          hiddenCommandPrefix: mode === 'transfer'
            ? t('accounts.ai.transfer.prefix', { name: nextAccount.name })
            : t('accounts.ai.settings.prefix', { name: nextAccount.name }),
          autoSubmitInitialCommand: false,
        });
      };

      return (
        <AccountDetailsSheet
          account={account}
          open={Boolean(account)}
          isPrimary={account?.id === primaryAccountId}
          isIncomeDefault={account?.id === incomeAccountId}
          isDeleting={isDeletingAccount}
          onClose={() => closeModal('account-details')}
          onEdit={(nextAccount) => openModal({ type: 'account-edit', account: nextAccount })}
          onDelete={async (accountId) => {
            await deleteAccount(accountId);
            if (accountId === primaryAccountId) setPrimaryAccountId(null);
            if (accountId === incomeAccountId) setIncomeAccountId(null);
            closeModal('account-details');
            await refreshFinance();
          }}
          onSetPrimary={(accountId) => setPrimaryAccountId(accountId)}
          onSetIncomeDefault={(accountId) => setIncomeAccountId(accountId)}
          onTransfer={(nextAccount) => openAccountAI(nextAccount, 'transfer')}
          onAskAI={(nextAccount) => openAccountAI(nextAccount, 'settings')}
        />
      );
    }
    case 'account-edit':
      return (
        <EditAccountModal
          open
          account={modal.account}
          isSaving={isUpdatingAccount}
          onClose={() => closeModal('account-edit')}
          onSave={async (id, payload) => {
            await updateAccount(id, payload);
            closeModal('account-edit');
            await refreshFinance();
          }}
        />
      );
    default:
      return null;
  }
}

import { AccountDetailsSheet } from '@/features/accounts/ui/AccountDetailsSheet';
import { AccountTransferSheet } from '@/features/accounts/ui/AccountTransferSheet';
import { CreateAccountSheet } from '@/features/accounts/ui/CreateAccountSheet';
import { EditAccountModal } from '@/features/accounts/ui/EditAccountModal';
import type { AccountDto, UpdateAccountPayload } from '@/features/accounts/api/accounts.api';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';

type AccountModal = Extract<AppModalDescriptor, { type: 'account-create' | 'account-details' | 'account-transfer' | 'account-edit' }>;

type Props = {
  modal: AccountModal;
  accounts: AccountDto[];
  primaryAccountId: string | null;
  incomeAccountId: string | null;
  isDeletingAccount: boolean;
  isUpdatingAccount: boolean;
  isTransactionSaving: boolean;
  closeModal: (type?: AppModalDescriptor['type']) => void;
  openModal: (modal: AppModalDescriptor) => void;
  resetAccountDraft: () => void;
  createAccount: (payload: any) => Promise<unknown>;
  updateAccount: (id: string, payload: UpdateAccountPayload) => Promise<unknown>;
  deleteAccount: (id: string) => Promise<unknown>;
  loadAccounts: (force?: boolean) => Promise<unknown>;
  refreshFinance: () => Promise<void>;
  setPrimaryAccountId: (id: string | null) => void;
  setIncomeAccountId: (id: string | null) => void;
  createTransfer: (payload: any) => Promise<unknown>;
  navigateToAI: () => void;
};

export function AccountModals({
  modal,
  accounts,
  primaryAccountId,
  incomeAccountId,
  isDeletingAccount,
  isUpdatingAccount,
  isTransactionSaving,
  closeModal,
  openModal,
  resetAccountDraft,
  createAccount,
  updateAccount,
  deleteAccount,
  loadAccounts,
  refreshFinance,
  setPrimaryAccountId,
  setIncomeAccountId,
  createTransfer,
  navigateToAI,
}: Props) {
  switch (modal.type) {
    case 'account-create':
      return (
        <CreateAccountSheet
          open
          onClose={() => {
            resetAccountDraft();
            closeModal('account-create');
          }}
          onSubmit={async (payload) => {
            await createAccount(payload);
            resetAccountDraft();
            closeModal('account-create');
            await loadAccounts(true);
          }}
        />
      );
    case 'account-details': {
      const account = accounts.find((item) => item.id === modal.accountId) ?? null;
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
          onTransfer={(nextAccount) => openModal({ type: 'account-transfer', fromAccountId: nextAccount.id })}
          onAskAI={navigateToAI}
        />
      );
    }
    case 'account-transfer': {
      const fromAccount = accounts.find((item) => item.id === modal.fromAccountId) ?? null;
      return (
        <AccountTransferSheet
          open={Boolean(fromAccount)}
          fromAccount={fromAccount}
          accounts={accounts}
          isSaving={isTransactionSaving}
          onClose={() => closeModal('account-transfer')}
          onSubmit={async (payload) => {
            await createTransfer(payload);
            closeModal('account-transfer');
            await refreshFinance();
          }}
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

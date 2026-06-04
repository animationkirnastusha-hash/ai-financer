import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { AppModalDescriptor } from '@/features/modals/model/appModal.store';
import { LoanEditSheet } from '@/features/obligations/ui/LoanEditSheet';
import type { CreateLoanPayload, LoanDto, UpdateLoanPayload } from '@/features/obligations/api/obligations.api';

type ObligationModal = Extract<AppModalDescriptor, { type: 'obligation-edit' }>;

type Props = {
  modal: ObligationModal;
  layer: number;
  accounts: AccountDto[];
  isSaving: boolean;
  closeModal: (type?: AppModalDescriptor['type']) => void;
  createLoan: (payload: CreateLoanPayload) => Promise<LoanDto>;
  updateLoan: (id: string, payload: UpdateLoanPayload) => Promise<LoanDto>;
  deleteLoan: (id: string) => Promise<void>;
};

export function ObligationModals({ modal, layer, accounts, isSaving, closeModal, createLoan, updateLoan, deleteLoan }: Props) {
  if (modal.type !== 'obligation-edit') return null;

  const handleSave = async (payload: CreateLoanPayload) => {
    if (modal.loan) {
      await updateLoan(modal.loan.id, payload);
      return;
    }
    await createLoan(payload);
  };

  const handleDelete = async (loan: LoanDto) => {
    const confirmed = window.confirm(`Удалить «${loan.title}»? Платежи и напоминания по нему тоже будут удалены.`);
    if (!confirmed) return;
    await deleteLoan(loan.id);
    closeModal('obligation-edit');
  };

  return (
    <LoanEditSheet
        open
        loan={modal.loan ?? null}
        initialType={modal.initialType ?? null}
        accounts={accounts}
        isSaving={isSaving}
        layer={layer}
        onClose={() => closeModal('obligation-edit')}
        onSave={handleSave}
        onDelete={handleDelete}
      />
  );
}

import { Drawer } from '@/shared/ui/Drawer';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { CreateLoanPayload, LoanDto, LoanType } from '@/features/obligations/api/obligations.api';
import { LoanAccountSection } from './loan-edit-sheet/LoanAccountSection';
import { LoanAmountsSection } from './loan-edit-sheet/LoanAmountsSection';
import { LoanEditFooter } from './loan-edit-sheet/LoanEditFooter';
import { LoanMainFields } from './loan-edit-sheet/LoanMainFields';
import { LoanNoteField } from './loan-edit-sheet/LoanNoteField';
import { LoanReminderSection } from './loan-edit-sheet/LoanReminderSection';
import { LoanTermsSection } from './loan-edit-sheet/LoanTermsSection';
import { LoanTypeSelector } from './loan-edit-sheet/LoanTypeSelector';
import { useLoanEditForm } from './loan-edit-sheet/useLoanEditForm';

type Props = {
  open: boolean;
  loan?: LoanDto | null;
  initialType?: LoanType | null;
  accounts: AccountDto[];
  isSaving: boolean;
  layer?: number;
  onClose: () => void;
  onSave: (payload: CreateLoanPayload) => Promise<void>;
  onDelete?: (loan: LoanDto) => Promise<void>;
};

export function LoanEditSheet({ open, loan, initialType, accounts, isSaving, layer, onClose, onSave, onDelete }: Props) {
  const { state, actions, derived, handleSave } = useLoanEditForm({
    open,
    loan,
    initialType,
    accounts,
    onSave,
    onClose,
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={loan ? 'Изменить обязательство' : 'Новое обязательство'}
      className="app-obligation-sheet"
      bodyClassName="app-obligation-sheet__body"
      layer={layer}
      footer={(
        <LoanEditFooter
          loan={loan}
          isSaving={isSaving}
          onClose={onClose}
          onSave={handleSave}
          onDelete={onDelete}
        />
      )}
    >
      <div className="app-obligation-form">
        {state.error ? <div className="app-error-box app-obligation-error">{state.error}</div> : null}

        <LoanTypeSelector type={state.type} isSaving={isSaving} onChange={actions.setType} />

        <LoanMainFields state={state} actions={actions} isSubscription={derived.isSubscription} />

        <LoanAccountSection
          state={state}
          actions={actions}
          accounts={derived.accountOptions}
          isSaving={isSaving}
        />

        <LoanAmountsSection
          state={state}
          actions={actions}
          isDebtLike={derived.isDebtLike}
          isSubscription={derived.isSubscription}
          isOther={derived.isOther}
        />

        {derived.isDebtLike ? (
          <LoanTermsSection
            state={state}
            actions={actions}
            isCreditLike={derived.isCreditLike}
            isInstallment={derived.isInstallment}
          />
        ) : null}

        <LoanReminderSection state={state} actions={actions} />

        <LoanNoteField value={state.note} onChange={actions.setNote} />
      </div>
    </Drawer>
  );
}

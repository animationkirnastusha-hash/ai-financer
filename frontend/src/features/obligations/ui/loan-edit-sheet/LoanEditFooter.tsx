import type { LoanDto } from '@/features/obligations/api/obligations.api';

type Props = {
  loan?: LoanDto | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete?: (loan: LoanDto) => Promise<void>;
};

export function LoanEditFooter({ loan, isSaving, onClose, onSave, onDelete }: Props) {
  return (
    <div className="app-obligation-footer">
      {loan && onDelete ? (
        <button type="button" className="app-danger-button" disabled={isSaving} onClick={() => onDelete(loan)}>
          Удалить
        </button>
      ) : null}
      <button type="button" className="app-secondary-button" onClick={onClose} disabled={isSaving}>Отмена</button>
      <button type="button" className="app-primary-button" onClick={onSave} disabled={isSaving}>
        {isSaving ? 'Сохраняю...' : 'Сохранить'}
      </button>
    </div>
  );
}

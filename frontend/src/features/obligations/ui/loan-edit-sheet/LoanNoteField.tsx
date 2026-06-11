import type { LoanEditFormActions, LoanEditFormState } from './loanEditSheet.types';

type Props = {
  value: LoanEditFormState['note'];
  onChange: LoanEditFormActions['setNote'];
};

export function LoanNoteField({ value, onChange }: Props) {
  return (
    <label className="app-field app-obligation-field app-obligation-note">
      <span>Заметка</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder="Например: гасить досрочно при возможности" />
    </label>
  );
}

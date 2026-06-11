import type { LoanType } from '@/features/obligations/api/obligations.api';
import { loanTypes } from './loanEditSheet.constants';

type Props = {
  type: LoanType;
  isSaving: boolean;
  onChange: (type: LoanType) => void;
};

export function LoanTypeSelector({ type, isSaving, onChange }: Props) {
  return (
    <section className="app-obligation-section">
      <div className="app-obligation-type-grid" aria-label="Тип обязательства">
        {loanTypes.map((item) => (
          <button
            key={item.value}
            type="button"
            className={item.value === type ? 'app-obligation-type app-obligation-type--active' : 'app-obligation-type'}
            onClick={() => onChange(item.value)}
            disabled={isSaving}
          >
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

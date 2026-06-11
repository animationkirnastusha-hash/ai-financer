import type { LoanEditFormActions, LoanEditFormState } from './loanEditSheet.types';

type Props = {
  state: Pick<LoanEditFormState, 'interestRate' | 'termMonths' | 'paidMonths'>;
  actions: Pick<LoanEditFormActions, 'setInterestRate' | 'setTermMonths' | 'setPaidMonths'>;
  isCreditLike: boolean;
  isInstallment: boolean;
};

export function LoanTermsSection({ state, actions, isCreditLike, isInstallment }: Props) {
  return (
    <section className="app-obligation-section">
      <div className="app-obligation-section__head">
        <strong>{isInstallment ? 'Срок рассрочки' : 'Условия'}</strong>
      </div>

      <div className={isCreditLike ? 'app-obligation-grid app-obligation-grid--3' : 'app-obligation-grid app-obligation-grid--2'}>
        {isCreditLike ? (
          <label className="app-field app-obligation-field app-obligation-field--short">
            <span>Ставка, %</span>
            <input inputMode="decimal" value={state.interestRate} onChange={(event) => actions.setInterestRate(event.target.value)} placeholder="12.9" />
          </label>
        ) : null}

        <label className="app-field app-obligation-field app-obligation-field--short">
          <span>Срок</span>
          <input inputMode="numeric" value={state.termMonths} onChange={(event) => actions.setTermMonths(event.target.value)} placeholder="36" />
        </label>

        <label className="app-field app-obligation-field app-obligation-field--short">
          <span>Оплачено</span>
          <input inputMode="numeric" value={state.paidMonths} onChange={(event) => actions.setPaidMonths(event.target.value)} placeholder="4" />
        </label>
      </div>
    </section>
  );
}

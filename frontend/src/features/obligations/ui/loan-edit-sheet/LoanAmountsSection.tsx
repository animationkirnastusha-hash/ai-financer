import type { LoanEditFormActions, LoanEditFormState } from './loanEditSheet.types';

type Props = {
  state: Pick<LoanEditFormState, 'currentDebt' | 'monthlyPayment' | 'principalAmount'>;
  actions: Pick<LoanEditFormActions, 'setCurrentDebt' | 'setMonthlyPayment' | 'setPrincipalAmount'>;
  isDebtLike: boolean;
  isSubscription: boolean;
  isOther: boolean;
};

export function LoanAmountsSection({ state, actions, isDebtLike, isSubscription, isOther }: Props) {
  return (
    <section className="app-obligation-section">
      <div className="app-obligation-section__head">
        <strong>{isSubscription || isOther ? 'Платёж' : 'Суммы'}</strong>
      </div>

      <div className={isDebtLike ? 'app-obligation-grid app-obligation-grid--3' : 'app-obligation-grid app-obligation-grid--2'}>
        {isDebtLike ? (
          <label className="app-field app-obligation-field app-obligation-field--short">
            <span>Остаток</span>
            <input inputMode="numeric" value={state.currentDebt} onChange={(event) => actions.setCurrentDebt(event.target.value)} placeholder="500000" />
          </label>
        ) : null}

        <label className="app-field app-obligation-field app-obligation-field--short">
          <span>{isSubscription ? 'Списание' : 'Платёж'}</span>
          <input inputMode="numeric" value={state.monthlyPayment} onChange={(event) => actions.setMonthlyPayment(event.target.value)} placeholder={isSubscription ? '899' : '18000'} />
        </label>

        {isDebtLike ? (
          <label className="app-field app-obligation-field app-obligation-field--short">
            <span>Общая сумма</span>
            <input inputMode="numeric" value={state.principalAmount} onChange={(event) => actions.setPrincipalAmount(event.target.value)} placeholder="700000" />
          </label>
        ) : null}
      </div>
    </section>
  );
}

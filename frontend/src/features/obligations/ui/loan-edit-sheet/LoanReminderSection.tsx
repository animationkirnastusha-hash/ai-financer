import type { LoanEditFormActions, LoanEditFormState } from './loanEditSheet.types';

type Props = {
  state: Pick<LoanEditFormState, 'paymentDay' | 'nextPaymentDate' | 'reminderDaysBefore'>;
  actions: Pick<LoanEditFormActions, 'setPaymentDay' | 'setNextPaymentDate' | 'setReminderDaysBefore'>;
};

export function LoanReminderSection({ state, actions }: Props) {
  return (
    <section className="app-obligation-section">
      <div className="app-obligation-section__head">
        <strong>Напоминание</strong>
      </div>

      <div className="app-obligation-grid app-obligation-grid--3">
        <label className="app-field app-obligation-field app-obligation-field--short">
          <span>День</span>
          <input inputMode="numeric" value={state.paymentDay} onChange={(event) => actions.setPaymentDay(event.target.value)} placeholder="15" />
        </label>

        <label className="app-field app-obligation-field">
          <span>Ближайший</span>
          <input type="date" value={state.nextPaymentDate} onChange={(event) => actions.setNextPaymentDate(event.target.value)} />
        </label>

        <label className="app-field app-obligation-field app-obligation-field--short">
          <span>За дней</span>
          <input inputMode="numeric" value={state.reminderDaysBefore} onChange={(event) => actions.setReminderDaysBefore(event.target.value)} placeholder="1" />
        </label>
      </div>
    </section>
  );
}

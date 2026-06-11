import type { LoanEditFormActions, LoanEditFormState } from './loanEditSheet.types';

type Props = {
  state: LoanEditFormState;
  actions: Pick<LoanEditFormActions, 'setTitle' | 'setCreditor' | 'setCurrency'>;
  isSubscription: boolean;
};

export function LoanMainFields({ state, actions, isSubscription }: Props) {
  return (
    <section className="app-obligation-section app-obligation-section--main">
      <div className="app-obligation-section__head">
        <strong>Основное</strong>
      </div>

      <label className="app-field app-obligation-field app-obligation-field--wide">
        <span>{isSubscription ? 'Название подписки' : 'Название'}</span>
        <input
          value={state.title}
          onChange={(event) => actions.setTitle(event.target.value)}
          placeholder={isSubscription ? 'Netflix, Spotify, связь' : 'Ипотека, автокредит, рассрочка'}
        />
      </label>

      <div className="app-obligation-grid app-obligation-grid--2">
        <label className="app-field app-obligation-field">
          <span>{isSubscription ? 'Сервис' : 'Банк / организация'}</span>
          <input
            value={state.creditor}
            onChange={(event) => actions.setCreditor(event.target.value)}
            placeholder={isSubscription ? 'Онлайн-кинотеатр' : 'Сбер, Т-Банк, магазин'}
          />
        </label>

        <label className="app-field app-obligation-field app-obligation-field--short">
          <span>Валюта</span>
          <select value={state.currency} onChange={(event) => actions.setCurrency(event.target.value)}>
            <option value="RUB">RUB</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
      </div>
    </section>
  );
}

import type { LoanEditFormActions, LoanEditFormState } from './loanEditSheet.types';
import type { AccountDto } from '@/features/accounts/api/accounts.api';

type Props = {
  state: Pick<LoanEditFormState, 'accountId' | 'autoCreateExpense'>;
  actions: Pick<LoanEditFormActions, 'setAccountId' | 'setAutoCreateExpense'>;
  accounts: AccountDto[];
  isSaving: boolean;
};

export function LoanAccountSection({ state, actions, accounts, isSaving }: Props) {
  return (
    <section className="app-obligation-section app-obligation-section--source">
      <div className="app-obligation-section__head">
        <strong>Списание</strong>
      </div>

      <div className="app-obligation-source-panel">
        <div className="app-obligation-account-picker" role="radiogroup" aria-label="Счёт списания">
          <button
            type="button"
            className={!state.accountId ? 'app-obligation-account app-obligation-account--active' : 'app-obligation-account'}
            onClick={() => actions.setAccountId('')}
            disabled={isSaving}
          >
            <span>Без счёта</span>
            <small>Только напоминание</small>
          </button>

          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className={account.id === state.accountId ? 'app-obligation-account app-obligation-account--active' : 'app-obligation-account'}
              onClick={() => actions.setAccountId(account.id)}
              disabled={isSaving}
            >
              <span>{account.name}</span>
              <small>{account.currency}</small>
            </button>
          ))}
        </div>

        <label className="app-checkbox-card app-obligation-checkbox app-obligation-checkbox--inline">
          <input
            type="checkbox"
            checked={state.autoCreateExpense}
            onChange={(event) => actions.setAutoCreateExpense(event.target.checked)}
          />
          <span>
            <strong>Списывать как расход</strong>
            <small>При оплате</small>
          </span>
        </label>
      </div>
    </section>
  );
}

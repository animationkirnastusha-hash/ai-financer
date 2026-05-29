import type { OnboardingAccountDraft, OnboardingDraft } from '@/features/onboarding/model/onboarding.types';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

function updateAccount(accounts: OnboardingAccountDraft[], id: OnboardingAccountDraft['id'], patch: Partial<OnboardingAccountDraft>) {
  return accounts.map((account) => account.id === id ? { ...account, ...patch } : account);
}

export function AccountsStep({ draft, onChange }: { draft: OnboardingDraft; onChange: (draft: OnboardingDraft) => void }) {
  const setAccount = (id: OnboardingAccountDraft['id'], patch: Partial<OnboardingAccountDraft>) => {
    onChange({ ...draft, accounts: updateAccount(draft.accounts, id, patch) });
  };

  return (
    <OnboardingStepShell
      eyebrow="Счета"
      title="Создай первые счета"
      description="Лучше начать с двух базовых счетов: наличка и карта. Балансы можно оставить нулевыми."
    >
      <div className="onboarding-form-grid">
        {draft.accounts.map((account) => (
          <div key={account.id} className="onboarding-form-card">
            <label className="onboarding-check-row">
              <input
                type="checkbox"
                checked={account.enabled}
                onChange={(event) => setAccount(account.id, { enabled: event.target.checked })}
              />
              <span>{account.id === 'cash' ? 'Наличные' : 'Безналичный счёт'}</span>
            </label>

            <label className="onboarding-field">
              <span>Название</span>
              <input value={account.name} onChange={(event) => setAccount(account.id, { name: event.target.value })} />
            </label>

            <label className="onboarding-field">
              <span>Стартовый баланс</span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={account.balance}
                onChange={(event) => setAccount(account.id, { balance: Number(event.target.value) || 0 })}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="onboarding-tip-card">
        <strong>Можно голосом после настройки</strong>
        <span>Например: “Фина, у меня 5000 наличными и 20000 на карте”.</span>
      </div>
    </OnboardingStepShell>
  );
}

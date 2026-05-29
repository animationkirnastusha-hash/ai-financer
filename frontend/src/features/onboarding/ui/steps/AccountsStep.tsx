import type { OnboardingAccountDraft, OnboardingDraft } from '@/features/onboarding/model/onboarding.types';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

function updateAccount(accounts: OnboardingAccountDraft[], id: OnboardingAccountDraft['id'], patch: Partial<OnboardingAccountDraft>) {
  return accounts.map((account) => account.id === id ? { ...account, ...patch } : account);
}

const voiceExamples = [
  {
    label: '1. Создать наличку',
    phrase: 'создай счёт Наличка, у меня там 5000 рублей',
    hint: 'Если сумма другая, скажи свою сумму. Можно оставить 0 рублей.',
  },
  {
    label: '2. Создать карту',
    phrase: 'создай счёт Карта, у меня там 20000 рублей',
    hint: 'Если у тебя несколько карт, создай основную. Остальные добавишь позже.',
  },
];

export function AccountsStep({ draft, onChange }: { draft: OnboardingDraft; onChange: (draft: OnboardingDraft) => void }) {
  const setupMode = draft.accountsSetupMode ?? 'voice';
  const voicePermissionReady = useSettingsStore((state) => state.voicePermissionPrompted);

  const setSetupMode = (accountsSetupMode: OnboardingDraft['accountsSetupMode']) => {
    onChange({ ...draft, accountsSetupMode });
  };

  const setAccount = (id: OnboardingAccountDraft['id'], patch: Partial<OnboardingAccountDraft>) => {
    onChange({ ...draft, accounts: updateAccount(draft.accounts, id, patch), accountsSetupMode: 'manual' });
  };

  return (
    <OnboardingStepShell
      eyebrow="Счета"
      title="Создай наличку и карту голосом"
      description="У почти каждого есть наличные и карта. Сейчас ты зажмёшь Фину, скажешь две команды и сразу создашь первые счета в приложении."
    >
      {setupMode === 'voice' && !voicePermissionReady ? (
        <div className="onboarding-tip-card onboarding-tip-card--warning">
          <strong>Сначала разреши микрофон</strong>
          <span>Вернись на шаг “Микрофон” и нажми “Разрешить микрофон”. Иначе Фина не сможет начать запись по удержанию.</span>
        </div>
      ) : null}

      <div className="onboarding-live-voice-guide">
        <div>
          <strong>Как выполнить этот шаг</strong>
          <span>Зажми Фину внизу справа, скажи команду, отпусти. Если Фина покажет подтверждение — проверь и подтверди.</span>
        </div>
        <em>Фина видна поверх этого шага специально для тренировки.</em>
      </div>

      <div className="onboarding-example-list onboarding-account-voice-examples">
        {voiceExamples.map((example) => (
          <div key={example.label} className="onboarding-example-item onboarding-example-item--voice-create">
            <small>{example.label}</small>
            <span>{example.phrase}</span>
            <small>{example.hint}</small>
          </div>
        ))}
      </div>

      <div className="onboarding-chip-row onboarding-account-mode-row">
        <button
          type="button"
          className={setupMode === 'voice' ? 'onboarding-chip is-active' : 'onboarding-chip'}
          onClick={() => setSetupMode('voice')}
        >
          Создаю голосом
        </button>
        <button
          type="button"
          className={setupMode === 'manual' ? 'onboarding-chip is-active' : 'onboarding-chip'}
          onClick={() => setSetupMode('manual')}
        >
          Заполнить вручную
        </button>
        <button
          type="button"
          className={setupMode === 'skip' ? 'onboarding-chip is-active' : 'onboarding-chip'}
          onClick={() => setSetupMode('skip')}
        >
          Пропустить счета
        </button>
      </div>

      {setupMode === 'manual' ? (
        <div className="onboarding-form-grid">
          {draft.accounts.map((account) => (
            <div key={account.id} className="onboarding-form-card">
              <label className="onboarding-check-row">
                <input
                  type="checkbox"
                  checked={account.enabled}
                  onChange={(event) => setAccount(account.id, { enabled: event.target.checked })}
                />
                <span>{account.id === 'cash' ? 'Наличные' : 'Карта'}</span>
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
      ) : null}

      {setupMode === 'voice' ? (
        <div className="onboarding-tip-card onboarding-tip-card--voice-note">
          <strong>После двух команд нажми “Дальше”</strong>
          <span>Онбординг не создаёт дубли. Счета появятся через обычный голосовой механизм Фины, как в приложении после настройки.</span>
        </div>
      ) : null}

      {setupMode === 'skip' ? (
        <div className="onboarding-tip-card">
          <strong>Можно позже</strong>
          <span>Без счетов приложение тоже откроется, но для расходов Фина будет чаще просить уточнение.</span>
        </div>
      ) : null}
    </OnboardingStepShell>
  );
}

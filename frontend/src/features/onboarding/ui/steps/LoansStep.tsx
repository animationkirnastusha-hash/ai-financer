import type { OnboardingDraft, OnboardingLoanKind } from '@/features/onboarding/model/onboarding.types';
import { OnboardingChoice, OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

const loanKinds: Array<{ id: OnboardingLoanKind; title: string }> = [
  { id: 'credit', title: 'Кредит' },
  { id: 'mortgage', title: 'Ипотека' },
  { id: 'installment', title: 'Рассрочка' },
  { id: 'loan', title: 'Займ' },
];

export function LoansStep({ draft, onChange }: { draft: OnboardingDraft; onChange: (draft: OnboardingDraft) => void }) {
  const loan = draft.loan;
  const patchLoan = (patch: Partial<typeof loan>) => onChange({ ...draft, loan: { ...loan, ...patch } });

  return (
    <OnboardingStepShell
      eyebrow="Кредиты"
      title="Есть кредиты или рассрочки?"
      description="Фина сможет напоминать о платежах и позже подсказывать, как снизить переплату."
    >
      <div className="onboarding-choice-grid two">
        <OnboardingChoice active={loan.enabled} title="Да, добавить" caption="Заполним основные поля" onClick={() => patchLoan({ enabled: true })} />
        <OnboardingChoice active={!loan.enabled} title="Нет или позже" caption="Можно добавить в приложении" onClick={() => patchLoan({ enabled: false })} />
      </div>

      {loan.enabled ? (
        <div className="onboarding-form-card">
          <div className="onboarding-chip-row">
            {loanKinds.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`onboarding-chip ${loan.kind === item.id ? 'is-active' : ''}`}
                onClick={() => patchLoan({ kind: item.id })}
              >
                {item.title}
              </button>
            ))}
          </div>

          <label className="onboarding-field">
            <span>Название</span>
            <input value={loan.title} onChange={(event) => patchLoan({ title: event.target.value })} />
          </label>

          <div className="onboarding-two-cols">
            <label className="onboarding-field">
              <span>Остаток долга</span>
              <input type="number" min="0" inputMode="decimal" value={loan.remainingAmount} onChange={(event) => patchLoan({ remainingAmount: Number(event.target.value) || 0 })} />
            </label>
            <label className="onboarding-field">
              <span>Платёж в месяц</span>
              <input type="number" min="0" inputMode="decimal" value={loan.monthlyPayment} onChange={(event) => patchLoan({ monthlyPayment: Number(event.target.value) || 0 })} />
            </label>
          </div>

          <div className="onboarding-two-cols">
            <label className="onboarding-field">
              <span>День платежа</span>
              <input type="number" min="1" max="31" inputMode="numeric" value={loan.paymentDay} onChange={(event) => patchLoan({ paymentDay: Math.max(1, Math.min(31, Number(event.target.value) || 1)) })} />
            </label>
            <label className="onboarding-field">
              <span>Ставка, если знаешь</span>
              <input type="number" min="0" inputMode="decimal" value={loan.rate ?? ''} onChange={(event) => patchLoan({ rate: Number(event.target.value) || undefined })} />
            </label>
          </div>
        </div>
      ) : null}
    </OnboardingStepShell>
  );
}

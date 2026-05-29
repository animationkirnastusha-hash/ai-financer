import type { AppCurrency } from '@/features/settings/model/settings.types';
import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

const currencies: Array<{ code: AppCurrency; title: string; caption: string }> = [
  { code: 'RUB', title: '₽ RUB', caption: 'Россия' },
  { code: 'USD', title: '$ USD', caption: 'Доллары' },
  { code: 'EUR', title: '€ EUR', caption: 'Евро' },
  { code: 'KZT', title: '₸ KZT', caption: 'Казахстан' },
  { code: 'UZS', title: 'UZS', caption: 'Узбекистан' },
  { code: 'KGS', title: 'KGS', caption: 'Кыргызстан' },
  { code: 'AMD', title: 'AMD', caption: 'Армения' },
  { code: 'GEL', title: 'GEL', caption: 'Грузия' },
  { code: 'AZN', title: 'AZN', caption: 'Азербайджан' },
];

export function CurrencyStep({ value, onChange }: { value: AppCurrency; onChange: (value: AppCurrency) => void }) {
  return (
    <OnboardingStepShell
      eyebrow="Валюта"
      title="Выбери основную валюту"
      description="В ней будут показываться баланс, цели и первые счета. Потом валюту можно изменить в настройках."
    >
      <div className="onboarding-currency-grid">
        {currencies.map((currency) => (
          <button
            key={currency.code}
            type="button"
            className={`onboarding-currency ${value === currency.code ? 'is-active' : ''}`}
            onClick={() => onChange(currency.code)}
          >
            <strong>{currency.title}</strong>
            <small>{currency.caption}</small>
          </button>
        ))}
      </div>
    </OnboardingStepShell>
  );
}

import { useMemo, useState, type TouchEvent } from 'react';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { AppCurrency } from '@/features/settings/model/settings.types';
import { APP_CURRENCIES, convertCurrency, getCurrencyProfile } from '@/features/currency/lib/currency';
import { formatMoney } from '@/shared/lib/money';

const currencyLabels: Record<AppCurrency, string> = Object.fromEntries(APP_CURRENCIES.map((item) => [item.code, item.label])) as Record<AppCurrency, string>;

type Rates = { usd: number; eur: number };

type Props = {
  accounts: AccountDto[];
  mainCurrency: AppCurrency;
  secondaryCurrency: AppCurrency;
  secondaryCurrencyEnabled: boolean;
  rates: Rates;
  income: number;
  expenses: number;
  delta: number;
  onOpenAccounts: () => void;
};

type Slide =
  | { kind: 'total'; id: 'total'; name: string; amount: number; currency: AppCurrency; caption: string; conversion: string }
  | { kind: 'account'; id: string; name: string; amount: number; currency: AppCurrency; caption: string; conversion: string };

function toRub(amount: number, currency: string, rates: Rates) {
  return convertCurrency(amount, currency as AppCurrency, 'RUB', { USD: rates.usd, EUR: rates.eur });
}

function fromRub(amount: number, currency: AppCurrency, rates: Rates) {
  return convertCurrency(amount, 'RUB', currency, { USD: rates.usd, EUR: rates.eur });
}

function conversionText(amount: number, from: AppCurrency, target: AppCurrency, rates: Rates) {
  if (from === target) return getCurrencyProfile(from).label;
  const rub = toRub(amount, from, rates);
  return `≈ ${formatMoney(fromRub(rub, target, rates), target)}`;
}

export function HomeBalanceCarousel({
  accounts,
  mainCurrency,
  secondaryCurrency,
  secondaryCurrencyEnabled,
  rates,
  income,
  expenses,
  delta,
  onOpenAccounts,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const compareCurrency = secondaryCurrencyEnabled ? secondaryCurrency : mainCurrency === 'RUB' ? 'USD' : 'RUB';

  const slides = useMemo<Slide[]>(() => {
    const totalRub = accounts.reduce((sum, account) => sum + toRub(Number(account.balance) || 0, account.currency, rates), 0);
    const total: Slide = {
      kind: 'total',
      id: 'total',
      name: 'Все деньги',
      amount: fromRub(totalRub, mainCurrency, rates),
      currency: mainCurrency,
      caption: accounts.length ? `${accounts.length} сч.` : 'счета ещё не созданы',
      conversion: conversionText(fromRub(totalRub, mainCurrency, rates), mainCurrency, compareCurrency, rates),
    };

    const accountSlides = accounts.map((account): Slide => ({
      kind: 'account',
      id: account.id,
      name: account.name,
      amount: Number(account.balance) || 0,
      currency: account.currency as AppCurrency,
      caption: account.type === 'cash' ? 'наличные' : account.type === 'card' ? 'карта' : account.type === 'savings' ? 'накопления' : 'счёт',
      conversion: conversionText(Number(account.balance) || 0, account.currency as AppCurrency, compareCurrency, rates),
    }));

    return [total, ...accountSlides];
  }, [accounts, compareCurrency, mainCurrency, rates]);

  const safeIndex = activeIndex % Math.max(1, slides.length);
  const active = slides[safeIndex] ?? slides[0];

  const go = (direction: 1 | -1) => {
    setActiveIndex((value) => (value + direction + Math.max(1, slides.length)) % Math.max(1, slides.length));
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => setTouchX(event.touches[0]?.clientX ?? null);
  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (touchX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchX;
    const dx = endX - touchX;
    setTouchX(null);
    if (Math.abs(dx) < 42) return;
    go(dx < 0 ? 1 : -1);
  };

  return (
    <header className="app-card app-card--hero app-home-balance-card" data-no-swipe="true" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="app-home-balance-card__top">
        <div className="min-w-0">
          <div className="app-eyebrow">Баланс</div>
          <div className="app-home-balance-card__amount">{formatMoney(active.amount, active.currency)}</div>
          <p>{active.kind === 'total' ? currencyLabels[active.currency] : active.name} · {active.caption}</p>
        </div>
        <div className="app-home-balance-card__nav">
          <button type="button" onClick={() => go(-1)} aria-label="Предыдущий счёт">‹</button>
          <span>{active.kind === 'total' ? 'Итого' : active.currency}</span>
          <button type="button" onClick={() => go(1)} aria-label="Следующий счёт">›</button>
        </div>
      </div>

      <div className="app-home-balance-card__rate">{active.conversion}</div>

      <div className="app-home-balance-card__metrics">
        <div className="app-home-metric"><span>Доходы</span><b>{formatMoney(income, mainCurrency, { sign: 'plus' })}</b></div>
        <div className="app-home-metric"><span>Расходы</span><b>{formatMoney(expenses, mainCurrency, { sign: 'minus' })}</b></div>
        <div className="app-home-metric"><span>Итог</span><b>{formatMoney(delta, mainCurrency, { sign: 'auto' })}</b></div>
      </div>

      <div className="app-home-balance-card__footer">
        <div className="app-home-balance-card__dots" aria-hidden="true">
          {slides.map((slide, index) => <i key={slide.id} data-active={index === safeIndex} />)}
        </div>
        <button type="button" onClick={onOpenAccounts}>Открыть счета</button>
      </div>
    </header>
  );
}

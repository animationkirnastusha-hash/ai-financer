import { useMemo, useState, type TouchEvent } from 'react';
import type { AccountDto } from '@/features/accounts/api/accounts.api';
import type { AppCurrency } from '@/features/settings/model/settings.types';
import { convertCurrency, getCurrencyProfile } from '@/features/currency/lib/currency';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';


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
  onReceiptClick: () => void;
  receiptAvailable: boolean;
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
  onReceiptClick,
  receiptAvailable,
}: Props) {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const compareCurrency = secondaryCurrencyEnabled ? secondaryCurrency : mainCurrency === 'RUB' ? 'USD' : 'RUB';

  const slides = useMemo<Slide[]>(() => {
    const totalRub = accounts.reduce((sum, account) => sum + toRub(Number(account.balance) || 0, account.currency, rates), 0);
    const total: Slide = {
      kind: 'total',
      id: 'total',
      name: t('dashboard.balance.allMoney'),
      amount: fromRub(totalRub, mainCurrency, rates),
      currency: mainCurrency,
      caption: accounts.length ? t('dashboard.balance.accountsShort', { count: accounts.length }) : t('dashboard.balance.noAccounts'),
      conversion: conversionText(fromRub(totalRub, mainCurrency, rates), mainCurrency, compareCurrency, rates),
    };

    const accountSlides = accounts.map((account): Slide => ({
      kind: 'account',
      id: account.id,
      name: account.name,
      amount: Number(account.balance) || 0,
      currency: account.currency as AppCurrency,
      caption: account.type === 'cash' ? t('dashboard.balance.cash') : account.type === 'card' ? t('dashboard.balance.card') : account.type === 'savings' ? t('dashboard.balance.savings') : t('dashboard.balance.account'),
      conversion: conversionText(Number(account.balance) || 0, account.currency as AppCurrency, compareCurrency, rates),
    }));

    return [total, ...accountSlides];
  }, [accounts, compareCurrency, mainCurrency, rates, t]);

  const safeIndex = activeIndex % Math.max(1, slides.length);
  const active = slides[safeIndex] ?? slides[0];
  const activeAmountText = active ? formatMoney(active.amount, active.currency) : '';
  const amountScale = activeAmountText.length > 18 ? 'compact' : activeAmountText.length > 14 ? 'medium' : 'normal';

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
          <div className="app-eyebrow">{t('dashboard.balance.eyebrow')}</div>
          <div className="app-home-balance-card__amount" data-scale={amountScale}>{activeAmountText}</div>
          <p>{active.kind === 'total' ? active.currency : active.name} · {active.caption}</p>
        </div>
        <div className="app-home-balance-card__nav">
          <button type="button" onClick={() => go(-1)} aria-label={t('dashboard.balance.prev')}>‹</button>
          <span>{active.kind === 'total' ? t('dashboard.balance.total') : active.currency}</span>
          <button type="button" onClick={() => go(1)} aria-label={t('dashboard.balance.next')}>›</button>
        </div>
      </div>

      <div className="app-home-balance-card__rate">{active.conversion}</div>

      <div className="app-home-balance-card__metrics">
        <div className="app-home-metric"><span>{t('dashboard.balance.income')}</span><b>{formatMoney(income, mainCurrency, { sign: 'plus' })}</b></div>
        <div className="app-home-metric"><span>{t('dashboard.balance.expenses')}</span><b>{formatMoney(expenses, mainCurrency, { sign: 'minus' })}</b></div>
        <div className="app-home-metric"><span>{t('dashboard.balance.result')}</span><b>{formatMoney(delta, mainCurrency, { sign: 'auto' })}</b></div>
      </div>

      <div className="app-home-balance-card__footer">
        <div className="app-home-balance-card__dots" aria-hidden="true">
          {slides.map((slide, index) => <i key={slide.id} data-active={index === safeIndex} />)}
        </div>
        <div className="app-home-balance-card__actions">
          <button
            type="button"
            className="app-home-balance-card__receipt"
            data-locked={receiptAvailable ? 'false' : 'true'}
            onClick={onReceiptClick}
          >
            {t('dashboard.receipt.button')}
          </button>
          <button type="button" className="app-home-balance-card__accounts" onClick={onOpenAccounts}>{t('dashboard.balance.openAccounts')}</button>
        </div>
      </div>
    </header>
  );
}

import { useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { formatMoney } from '@/shared/lib/money';
import { cn } from '@/shared/lib/cn';

type CurrencyCode = 'RUB' | 'USD' | 'EUR';

type BalanceView = {
  currency: CurrencyCode;
  amount: number;
  accountsCount: number;
  accountNames: string;
};

function asCurrency(value: string): CurrencyCode | null {
  return value === 'RUB' || value === 'USD' || value === 'EUR' ? value : null;
}

function getCurrencyLabel(currency: CurrencyCode) {
  if (currency === 'RUB') return 'RUB счета';
  if (currency === 'USD') return 'USD счета';
  return 'EUR счета';
}

export function AICoreBalanceHero() {
  const accounts = useAccountsStore((state) => state.items);
  const mainCurrency = useSettingsStore((state) => state.mainCurrency) as CurrencyCode;
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
  const secondaryCurrency = useSettingsStore((state) => state.secondaryCurrency) as CurrencyCode;
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const balanceViews = useMemo<BalanceView[]>(() => {
    const currencies = new Set<CurrencyCode>();
    const primary = asCurrency(mainCurrency) ?? 'RUB';

    currencies.add(primary);
    if (secondaryCurrencyEnabled && asCurrency(secondaryCurrency)) currencies.add(secondaryCurrency);

    for (const account of accounts) {
      const currency = asCurrency(account.currency);
      if (currency) currencies.add(currency);
    }

    const supportedCurrencies: CurrencyCode[] = ['RUB', 'USD', 'EUR'];
    const ordered = supportedCurrencies.filter((currency) => currencies.has(currency));
    const sorted = ordered.sort((a, b) => (a === primary ? -1 : b === primary ? 1 : 0));

    return sorted.map((currency) => {
      const currencyAccounts = accounts.filter((account) => account.currency === currency && account.showInTotalBalance !== false);
      return {
        currency,
        amount: currencyAccounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0),
        accountsCount: currencyAccounts.length,
        accountNames: currencyAccounts.map((account) => account.name).slice(0, 2).join(' · '),
      };
    });
  }, [accounts, mainCurrency, secondaryCurrency, secondaryCurrencyEnabled]);

  const primaryAccount = useMemo(() => {
    return accounts.find((account) => account.id === primaryAccountId) ?? null;
  }, [accounts, primaryAccountId]);

  const safeIndex = Math.min(activeIndex, Math.max(balanceViews.length - 1, 0));
  const activeView = balanceViews[safeIndex] ?? {
    currency: (asCurrency(mainCurrency) ?? 'RUB') as CurrencyCode,
    amount: 0,
    accountsCount: 0,
    accountNames: '',
  };

  const secondaryValue = useMemo(() => {
    if (!secondaryCurrencyEnabled) return null;
    if (activeView.currency !== 'RUB') return null;

    const rate = secondaryCurrency === 'USD' ? rubToUsdRate : rubToEurRate;
    if (!Number.isFinite(rate) || rate <= 0) return null;

    return activeView.amount / rate;
  }, [activeView.amount, activeView.currency, rubToEurRate, rubToUsdRate, secondaryCurrency, secondaryCurrencyEnabled]);

  const changeIndex = (nextIndex: number, direction: 'left' | 'right') => {
    if (nextIndex < 0 || nextIndex >= balanceViews.length || nextIndex === safeIndex) return;
    setSwipeDirection(direction);
    setActiveIndex(nextIndex);
    window.setTimeout(() => setSwipeDirection(null), 260);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;
    if (Math.abs(deltaX) < 42 || Math.abs(deltaY) > 56) return;
    changeIndex(deltaX < 0 ? safeIndex + 1 : safeIndex - 1, deltaX < 0 ? 'left' : 'right');
  };

  return (
    <section
      className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_45%),rgba(255,255,255,0.045)] p-4 shadow-[0_0_50px_rgba(0,0,0,0.25)]"
      data-no-swipe="true"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <div
        key={activeView.currency}
        className={cn(
          'min-h-[138px] transition-all duration-300 ease-out',
          swipeDirection === 'left' && 'animate-[aiPageInLeft_260ms_ease-out]',
          swipeDirection === 'right' && 'animate-[aiPageInRight_260ms_ease-out]',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
              {primaryAccount && primaryAccount.currency === activeView.currency ? 'Основной счёт' : 'Баланс'}
            </div>

            <div className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {formatMoney(activeView.amount, activeView.currency)}
            </div>

            {secondaryValue !== null ? (
              <div className="mt-1 text-sm text-white/38">
                ≈ {formatMoney(secondaryValue, secondaryCurrency)}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/62">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/12 px-2.5 py-1 text-emerald-100">
                AI готов
              </span>

              <span className="truncate">
                {getCurrencyLabel(activeView.currency)}
              </span>
            </div>
          </div>

          <div className="flex min-w-[86px] flex-col items-end text-right text-white/60">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-white/65">
              {activeView.accountsCount} сч.
            </div>
            <div className="mt-3 text-xs uppercase tracking-[0.16em] text-white/30">
              {balanceViews.map((view) => view.currency).join(' · ')}
            </div>
            {activeView.accountNames ? (
              <div className="mt-1 max-w-[120px] truncate text-xs text-white/38">
                {activeView.accountNames}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {balanceViews.length > 1 ? (
        <div className="mt-1 flex justify-center gap-1.5" aria-label="Свайп балансов">
          {balanceViews.map((view, index) => (
            <button
              key={view.currency}
              type="button"
              onClick={() => changeIndex(index, index > safeIndex ? 'left' : 'right')}
              className={cn(
                'h-2 rounded-full transition-all duration-200',
                index === safeIndex ? 'w-6 bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.5)]' : 'w-2 bg-white/20',
              )}
              aria-label={`Показать ${view.currency}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

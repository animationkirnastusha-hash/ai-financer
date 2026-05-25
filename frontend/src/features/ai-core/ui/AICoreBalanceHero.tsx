import { useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { convertCurrency, getCurrencyProfile, normalizeCurrency, type AppCurrencyCode } from '@/features/currency/lib/currency';
import { formatMoney } from '@/shared/lib/money';
import { cn } from '@/shared/lib/cn';

type BalanceAccountView = {
  id: string;
  name: string;
  currency: AppCurrencyCode;
  amount: number;
  type: string;
  exists: boolean;
};

function getAccountTypeLabel(type?: string | null) {
  if (type === 'cash') return 'Наличные';
  if (type === 'card') return 'Карта';
  if (type === 'savings') return 'Накопления';
  if (type === 'investment') return 'Инвестиции';
  return 'Счёт';
}

function fallbackAccountForCurrency(currency: AppCurrencyCode): BalanceAccountView {
  const profile = getCurrencyProfile(currency);
  return {
    id: `virtual-${currency}`,
    name: `${currency} счёт`,
    currency,
    amount: 0,
    type: profile.label,
    exists: false,
  };
}

export function AICoreBalanceHero() {
  const accounts = useAccountsStore((state) => state.items);
  const mainCurrency = normalizeCurrency(useSettingsStore((state) => state.mainCurrency));
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
  const secondaryCurrency = normalizeCurrency(useSettingsStore((state) => state.secondaryCurrency), 'USD');
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const accountViews = useMemo<BalanceAccountView[]>(() => {
    const real = accounts
      .filter((account) => account.showInTotalBalance !== false)
      .map((account) => ({
        id: account.id,
        name: account.name,
        currency: normalizeCurrency(account.currency, mainCurrency),
        amount: Number(account.balance) || 0,
        type: account.type,
        exists: true,
      }));

    const preferredCurrencies = [mainCurrency, secondaryCurrency, 'RUB', 'USD', 'EUR']
      .map((currency) => normalizeCurrency(currency))
      .filter((currency, index, arr) => arr.indexOf(currency) === index);

    const withVirtual = [...real];
    for (const currency of preferredCurrencies) {
      if (!withVirtual.some((item) => item.currency === currency)) withVirtual.push(fallbackAccountForCurrency(currency));
    }

    return withVirtual.sort((a, b) => {
      if (a.currency === mainCurrency && b.currency !== mainCurrency) return -1;
      if (b.currency === mainCurrency && a.currency !== mainCurrency) return 1;
      if (a.exists !== b.exists) return a.exists ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [accounts, mainCurrency, secondaryCurrency]);

  const safeIndex = Math.min(activeIndex, Math.max(accountViews.length - 1, 0));
  const activeView = accountViews[safeIndex] ?? fallbackAccountForCurrency(mainCurrency);

  const secondaryValue = useMemo(() => {
    if (!secondaryCurrencyEnabled) return null;
    if (activeView.currency === secondaryCurrency) return null;
    const overrides: Partial<Record<AppCurrencyCode, number>> = {
      USD: rubToUsdRate,
      EUR: rubToEurRate,
    };
    return convertCurrency(activeView.amount, activeView.currency, secondaryCurrency, overrides);
  }, [activeView.amount, activeView.currency, rubToEurRate, rubToUsdRate, secondaryCurrency, secondaryCurrencyEnabled]);

  const changeIndex = (nextIndex: number, direction: 'left' | 'right') => {
    if (nextIndex < 0 || nextIndex >= accountViews.length || nextIndex === safeIndex) return;
    setSwipeDirection(direction);
    setActiveIndex(nextIndex);
    window.setTimeout(() => setSwipeDirection(null), 220);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    startXRef.current = event.clientX;
    startYRef.current = event.clientY;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const deltaX = event.clientX - startXRef.current;
    const deltaY = event.clientY - startYRef.current;
    if (Math.abs(deltaX) < 30 || Math.abs(deltaY) > 64) return;
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
        key={activeView.id}
        className={cn(
          'min-h-[144px] transition-all duration-300 ease-out',
          swipeDirection === 'left' && 'animate-[aiPageInLeft_220ms_ease-out]',
          swipeDirection === 'right' && 'animate-[aiPageInRight_220ms_ease-out]',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
              {activeView.exists ? getAccountTypeLabel(activeView.type) : 'Будущий счёт'}
            </div>

            <div className="mt-2 truncate text-lg font-semibold tracking-[-0.02em] text-white/85">
              {activeView.name}
            </div>

            <div className="mt-2 text-4xl font-semibold tracking-tight text-white">
              {formatMoney(activeView.amount, activeView.currency)}
            </div>

            {secondaryValue !== null ? (
              <div className="mt-1 text-sm text-white/38">
                ≈ {formatMoney(secondaryValue, secondaryCurrency)}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/62">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/12 px-2.5 py-1 text-emerald-100">
                {activeView.currency}
              </span>
              <span className="truncate">
                {activeView.exists ? 'Свайпни, чтобы перейти к другому счёту' : 'Счёта пока нет, можно создать'}
              </span>
            </div>
          </div>

          <div className="flex min-w-[86px] flex-col items-end text-right text-white/60">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-white/65">
              {safeIndex + 1}/{accountViews.length}
            </div>
            <div className="mt-3 text-xs uppercase tracking-[0.16em] text-white/30">
              {accountViews.map((view) => view.currency).slice(0, 4).join(' · ')}
            </div>
          </div>
        </div>
      </div>

      {accountViews.length > 1 ? (
        <div className="mt-1 flex justify-center gap-1.5" aria-label="Свайп счетов">
          {accountViews.map((view, index) => (
            <button
              key={view.id}
              type="button"
              onClick={() => changeIndex(index, index > safeIndex ? 'left' : 'right')}
              className={cn(
                'h-2 rounded-full transition-all duration-200',
                index === safeIndex ? 'w-6 bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.5)]' : 'w-2 bg-white/20',
              )}
              aria-label={`Показать ${view.name}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

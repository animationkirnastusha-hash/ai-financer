import { useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { formatMoney } from '@/shared/lib/money';

const CURRENCIES = ['RUB', 'USD', 'EUR'] as const;
type Currency = (typeof CURRENCIES)[number];

function normalizeCurrency(value: string): Currency {
  return CURRENCIES.includes(value as Currency) ? (value as Currency) : 'RUB';
}

export function AICoreBalanceHero() {
  const accounts = useAccountsStore((state) => state.items);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const mainCurrency = normalizeCurrency(useSettingsStore((state) => state.mainCurrency));
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
  const secondaryCurrency = normalizeCurrency(useSettingsStore((state) => state.secondaryCurrency));
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  const [activeCurrency, setActiveCurrency] = useState<Currency>(mainCurrency);
  const startXRef = useRef(0);

  const availableCurrencies = useMemo(() => {
    const set = new Set<Currency>([mainCurrency]);
    for (const account of accounts) set.add(normalizeCurrency(account.currency));
    return CURRENCIES.filter((currency) => set.has(currency));
  }, [accounts, mainCurrency]);

  const primaryAccount = useMemo(() => {
    return accounts.find((account) => account.id === primaryAccountId) ?? null;
  }, [accounts, primaryAccountId]);

  const displayCurrency = availableCurrencies.includes(activeCurrency) ? activeCurrency : mainCurrency;

  const displayAccounts = useMemo(() => {
    return accounts.filter((account) => normalizeCurrency(account.currency) === displayCurrency);
  }, [accounts, displayCurrency]);

  const displayAmount = useMemo(() => {
    return displayAccounts.reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
  }, [displayAccounts]);

  const featuredAccount = displayAccounts.find((account) => account.id === primaryAccountId) ?? displayAccounts[0] ?? primaryAccount;

  const secondaryValue = useMemo(() => {
    if (!secondaryCurrencyEnabled) return null;
    if (displayCurrency !== 'RUB') return null;

    const rate = secondaryCurrency === 'USD' ? rubToUsdRate : rubToEurRate;
    if (!Number.isFinite(rate) || rate <= 0) return null;

    return displayAmount / rate;
  }, [displayAmount, displayCurrency, rubToEurRate, rubToUsdRate, secondaryCurrency, secondaryCurrencyEnabled]);

  const switchCurrency = (direction: 1 | -1) => {
    if (availableCurrencies.length <= 1) return;
    const index = availableCurrencies.indexOf(displayCurrency);
    const nextIndex = (index + direction + availableCurrencies.length) % availableCurrencies.length;
    setActiveCurrency(availableCurrencies[nextIndex]);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    startXRef.current = event.touches[0]?.clientX ?? 0;
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const endX = event.changedTouches[0]?.clientX ?? startXRef.current;
    const delta = endX - startXRef.current;
    if (Math.abs(delta) < 48) return;
    switchCurrency(delta < 0 ? 1 : -1);
  };

  return (
    <section
      className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_45%),rgba(255,255,255,0.045)] p-4 shadow-[0_0_50px_rgba(0,0,0,0.25)]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-no-swipe="true"
    >
      <button type="button" onClick={() => navigateTo('accounts')} className="block w-full text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
              {featuredAccount ? 'Счета' : 'Баланс'}
            </div>

            <div className="mt-3 text-4xl font-semibold tracking-tight text-white">
              {formatMoney(displayAmount, displayCurrency)}
            </div>

            {secondaryValue !== null ? (
              <div className="mt-1 text-sm text-white/38">
                ≈ {formatMoney(secondaryValue, secondaryCurrency)}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/62">
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/12 px-2.5 py-1 text-emerald-100">
                AI active
              </span>

              <span className="truncate">
                {displayAccounts.length > 0
                  ? `${displayCurrency} · ${displayAccounts.length} сч.`
                  : `${displayCurrency} счета`}
              </span>
            </div>
          </div>

          <div className="flex min-w-[92px] flex-col items-end gap-2 text-right">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/55">
              Свайп
            </div>
            <div className="max-w-[120px] truncate text-sm font-medium text-white/75">
              {featuredAccount?.name ?? 'Счета'}
            </div>
            <div className="text-xs text-white/35">
              {availableCurrencies.join(' · ')}
            </div>
          </div>
        </div>
      </button>
    </section>
  );
}

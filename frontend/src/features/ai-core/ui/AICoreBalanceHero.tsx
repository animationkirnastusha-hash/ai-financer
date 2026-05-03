import { useMemo } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { formatMoney } from '@/shared/lib/money';

export function AICoreBalanceHero() {
  const accounts = useAccountsStore((state) => state.items);
  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const secondaryCurrencyEnabled = useSettingsStore(
    (state) => state.secondaryCurrencyEnabled,
  );
  const secondaryCurrency = useSettingsStore((state) => state.secondaryCurrency);
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  const primaryAccount = useMemo(() => {
    return accounts.find((account) => account.id === primaryAccountId) ?? null;
  }, [accounts, primaryAccountId]);

  const mainCurrencyTotal = useMemo(() => {
    return accounts
      .filter((account) => account.currency === mainCurrency)
      .reduce((sum, account) => sum + (Number(account.balance) || 0), 0);
  }, [accounts, mainCurrency]);

  const displayCurrency = primaryAccount?.currency || mainCurrency;
  const displayAmount = primaryAccount
    ? Number(primaryAccount.balance) || 0
    : mainCurrencyTotal;

  const secondaryValue = useMemo(() => {
    if (!secondaryCurrencyEnabled) return null;
    if (displayCurrency !== 'RUB') return null;

    const rate = secondaryCurrency === 'USD' ? rubToUsdRate : rubToEurRate;

    if (!Number.isFinite(rate) || rate <= 0) return null;

    return displayAmount / rate;
  }, [
    displayAmount,
    displayCurrency,
    rubToEurRate,
    rubToUsdRate,
    secondaryCurrency,
    secondaryCurrencyEnabled,
  ]);

  return (
    <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_45%),rgba(255,255,255,0.045)] p-4 shadow-[0_0_50px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
            {primaryAccount ? 'Основной счёт' : 'Баланс'}
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
              {primaryAccount
                ? `${primaryAccount.name} · ${primaryAccount.currency}`
                : `${mainCurrency} счета`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigateTo('accounts')}
          className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.06] text-white/80"
        >
          <div className="text-2xl">▣</div>
          <div className="mt-1 text-xs">Счета</div>
        </button>
      </div>
    </section>
  );
}
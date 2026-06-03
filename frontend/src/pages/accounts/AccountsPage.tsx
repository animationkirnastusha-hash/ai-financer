import { useEffect, useMemo } from 'react';

import type { AccountDto } from '@/features/accounts/api/accounts.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAppModalStore } from '@/features/modals/model/appModal.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { AccountsSummary } from '@/features/accounts/ui/AccountsSummary';
import { AccountCard } from '@/features/accounts/ui/AccountCard';
import { EmptyAccountsState } from '@/features/accounts/ui/EmptyAccountsState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { PageHeader } from '@/shared/ui/PageHeader';
import { formatMoney } from '@/shared/lib/money';

type CurrencyGroup = {
  currency: string;
  total: number;
  accounts: AccountDto[];
};

function accountTypeLabel(type?: string | null) {
  if (type === 'cash') return 'Наличные';
  if (type === 'card') return 'Карта';
  if (type === 'savings') return 'Накопления';
  if (type === 'credit') return 'Кредит';
  return 'Счёт';
}

export default function AccountsPage() {
  const openAIWithCommand = useNavigationStore((s) => s.openAIWithCommand);
  const openModal = useAppModalStore((state) => state.openModal);

  const items = useAccountsStore((state) => state.items);
  const isLoading = useAccountsStore((state) => state.isLoading);
  const error = useAccountsStore((state) => state.error);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);

  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const incomeAccountId = useSettingsStore((state) => state.incomeAccountId);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);


  const grouped = useMemo<CurrencyGroup[]>(() => {
    const map = new Map<string, CurrencyGroup>();

    for (const account of items) {
      const currency = account.currency || 'RUB';
      const current = map.get(currency) ?? ({ currency, total: 0, accounts: [] } satisfies CurrencyGroup);
      if (account.showInTotalBalance !== false) current.total += Number(account.balance) || 0;
      current.accounts.push(account);
      map.set(currency, current);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.currency === mainCurrency) return -1;
      if (b.currency === mainCurrency) return 1;
      return a.currency.localeCompare(b.currency);
    });
  }, [items, mainCurrency]);

  const mainGroup = grouped.find((group) => group.currency === mainCurrency);
  const primaryAccount = items.find((item) => item.id === primaryAccountId);
  const incomeAccount = items.find((item) => item.id === incomeAccountId);
  const totalAccounts = items.length;

  return (
    <div className="app-page app-accounts-page text-white">
      <div className="app-page__inner space-y-4">
        <PageHeader title="Счета" subtitle="Баланс и структура" />

        <header className="app-card app-card--hero app-accounts-hero">
          <div className="app-eyebrow">Кошелёк</div>
          <div className="app-accounts-hero__top">
            <div className="min-w-0">
              <h1 className="app-hero-title">Все деньги по местам</h1>
              <p className="app-hero-caption">Счета, наличные, карты и накопления без лишнего шума.</p>
            </div>
            <button type="button" onClick={() => openModal({ type: 'accounts-tools' })} className="app-icon-button app-icon-button--lg" aria-label="Настройки счетов">⚙</button>
          </div>

          <div className="mt-4">
            <AccountsSummary total={formatMoney(mainGroup?.total ?? 0, mainCurrency)} />
          </div>

          <div className="app-accounts-stats">
            <div><span>{totalAccounts}</span><small>счетов</small></div>
            <div><span>{primaryAccount?.name || '—'}</span><small>главный</small></div>
            <div><span>{incomeAccount?.name || primaryAccount?.name || '—'}</span><small>доходы</small></div>
          </div>
        </header>

        <section className="app-card app-accounts-actions">
          <button type="button" onClick={() => openModal({ type: 'account-create', prefill: { type: 'card', currency: mainCurrency === 'USD' || mainCurrency === 'EUR' ? mainCurrency : 'RUB' } })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">＋</span>
            <span><b>Создать счёт</b><small>Карта, наличные или цель</small></span>
          </button>
          <button type="button" disabled={items.length < 2} onClick={() => openModal({ type: 'account-transfer', fromAccountId: primaryAccount?.id ?? items[0]?.id ?? '' })} className="app-action-card app-action-card--wide disabled:opacity-40">
            <span className="app-action-card__icon">⇄</span>
            <span><b>Перевод</b><small>Между своими счетами</small></span>
          </button>
        </section>

        {error && items.length === 0 ? (
          <ErrorState title="Счета не загрузились" message={error} onRetry={() => void loadAccounts(true)} onOpenAI={() => openAIWithCommand()} />
        ) : isLoading ? (
          <div className="app-card p-5 text-sm text-white/60">Загружаю счета...</div>
        ) : items.length === 0 ? (
          <EmptyAccountsState onCreate={() => openModal({ type: 'account-create' })} />
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <section key={group.currency} className="app-card app-accounts-group">
                <div className="app-accounts-group__head">
                  <div>
                    <div className="app-section-title">{group.currency}</div>
                    <div className="mt-1 text-xs text-white/42">{group.accounts.length} счетов · {formatMoney(group.total, group.currency)}</div>
                  </div>
                  {group.currency === mainCurrency ? <span className="app-badge app-badge--green">главная валюта</span> : null}
                </div>

                <div className="mt-3 grid gap-3">
                  {group.accounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      name={account.name}
                      balance={formatMoney(Number(account.balance) || 0, account.currency)}
                      currency={account.currency}
                      hint={accountTypeLabel(account.type)}
                      isPrimary={account.id === primaryAccountId}
                      isIncomeDefault={account.id === incomeAccountId}
                      lockRename={account.lockRename}
                      lockSpending={account.lockSpending}
                      lockTransfers={account.lockTransfers}
                      onClick={() => openModal({ type: 'account-details', accountId: account.id })}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

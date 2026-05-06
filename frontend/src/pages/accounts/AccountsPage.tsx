import { useEffect, useMemo, useState } from 'react';

import type { AccountDto } from '@/features/accounts/api/accounts.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { AccountsSummary } from '@/features/accounts/ui/AccountsSummary';
import { AccountCard } from '@/features/accounts/ui/AccountCard';
import { AccountDetailsSheet } from '@/features/accounts/ui/AccountDetailsSheet';
import { EditAccountModal } from '@/features/accounts/ui/EditAccountModal';
import { EmptyAccountsState } from '@/features/accounts/ui/EmptyAccountsState';
import { PageHeader } from '@/shared/ui/PageHeader';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  onBack: () => void;
};

type CurrencyGroup = {
  currency: string;
  total: number;
  accounts: AccountDto[];
};

export default function AccountsPage({ onBack }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const navigateTo = useNavigationStore((s) => s.navigateTo);

  const items = useAccountsStore((state) => state.items);
  const isLoading = useAccountsStore((state) => state.isLoading);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);

  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const incomeAccountId = useSettingsStore((state) => state.incomeAccountId);
  const setPrimaryAccountId = useSettingsStore((state) => state.setPrimaryAccountId);
  const setIncomeAccountId = useSettingsStore((state) => state.setIncomeAccountId);
  const setMainCurrency = useSettingsStore((state) => state.setMainCurrency);

  const deleteAccount = useAccountsStore((state) => state.deleteAccount);
  const updateAccount = useAccountsStore((state) => state.updateAccount);
  const openEdit = useAccountsStore((state) => state.openEdit);
  const closeEdit = useAccountsStore((state) => state.closeEdit);
  const editing = useAccountsStore((state) => state.editing);
  const isDeleting = useAccountsStore((state) => state.isDeleting);
  const isUpdating = useAccountsStore((state) => state.isUpdating);
  
  const openCreateAccount = useAccountFlowStore(
    (state) => state.openCreateAccount,
  );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const selectedAccount = useMemo(() => {
    return items.find((item) => item.id === selectedAccountId) ?? null;
  }, [items, selectedAccountId]);

  const grouped = useMemo<CurrencyGroup[]>(() => {
    const map = new Map<string, CurrencyGroup>();

    for (const account of items) {
      const currency = account.currency || 'RUB';

      const current =
        map.get(currency) ??
        ({
          currency,
          total: 0,
          accounts: [],
        } satisfies CurrencyGroup);

      current.total += Number(account.balance) || 0;
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

  return (
    <div className="flex h-dvh flex-col bg-[linear-gradient(180deg,#0b1016_0%,#090d13_100%)] text-white">
      <PageHeader title="Accounts" onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 pb-28">
        <div className="mx-auto max-w-[560px] space-y-4">
          <AccountsSummary
            total={formatMoney(mainGroup?.total ?? 0, mainCurrency)}
          />

          <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              Account rules
            </div>

            <div className="mt-3 grid gap-3">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="text-xs text-white/42">Основная валюта</div>
                <div className="mt-2 flex gap-2">
                  {(['RUB', 'USD', 'EUR'] as const).map((currency) => (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => setMainCurrency(currency)}
                      className={`rounded-xl border px-3 py-2 text-xs transition ${
                        mainCurrency === currency
                          ? 'border-emerald-300/25 bg-emerald-300/12 text-white'
                          : 'border-white/10 bg-white/5 text-white/55'
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="text-xs text-white/42">Главный счёт</div>
                  <div className="mt-1 truncate text-sm text-white">
                    {primaryAccount?.name || 'Не выбран'}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="text-xs text-white/42">Доходы по умолчанию</div>
                  <div className="mt-1 truncate text-sm text-white">
                    {incomeAccount?.name || primaryAccount?.name || 'Не выбран'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/8 bg-white/[0.04] p-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
              AI Actions
            </div>

            <div className="mt-3 text-sm leading-6 text-white/60">
              Валюты не смешиваются. Основная сумма показывается отдельно, а USD/EUR идут своими группами.
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  openCreateAccount({
                    type: 'savings',
                    currency: mainCurrency,
                  })
                }
                className="rounded-2xl border border-emerald-400/20 bg-emerald-400/12 px-4 py-2 text-sm text-white transition hover:bg-emerald-400/18"
              >
                Создать счёт
              </button>

              <button
                type="button"
                onClick={() => navigateTo('ai-core')}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15"
              >
                Открыть AI
              </button>
            </div>
          </section>

          {isLoading ? (
            <div className="rounded-[28px] border border-white/8 bg-white/[0.04] p-5 text-sm text-white/60">
              Загружаю счета...
            </div>
          ) : items.length === 0 ? (
            <EmptyAccountsState onCreate={() => openCreateAccount()} />
          ) : (
            <div className="space-y-4">
              {grouped.map((group) => (
                <section
                  key={group.currency}
                  className="rounded-[28px] border border-white/8 bg-white/[0.035] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                        {group.currency === mainCurrency
                          ? 'Main currency'
                          : 'Other currency'}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {group.currency}
                      </div>
                    </div>

                    <div className="text-right text-sm font-medium text-white">
                      {formatMoney(group.total, group.currency)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.accounts.map((acc) => (
                      <AccountCard
                        key={acc.id}
                        name={acc.name}
                        balance={formatMoney(Number(acc.balance || 0), acc.currency)}
                        hint={acc.type}
                        currency={acc.currency}
                        isPrimary={acc.id === primaryAccountId}
                        isIncomeDefault={acc.id === incomeAccountId}
                        lockRename={acc.lockRename}
                        lockSpending={acc.lockSpending}
                        lockTransfers={acc.lockTransfers}
                        onClick={() => setSelectedAccountId(acc.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <AccountDetailsSheet
        open={!!selectedAccount}
        account={selectedAccount}
        isPrimary={selectedAccount?.id === primaryAccountId}
        isIncomeDefault={selectedAccount?.id === incomeAccountId}
        onClose={() => setSelectedAccountId(null)}
        onSetPrimary={(accountId) => setPrimaryAccountId(accountId)}
        onSetIncomeDefault={(accountId) => setIncomeAccountId(accountId)}
        onEdit={(account) => {
          openEdit(account);
        }}
        onAskAI={() => {
          setSelectedAccountId(null);
          navigateTo('ai-core');
        
        }}
        isDeleting={isDeleting}
onDelete={async (accountId) => {
  try {
    await deleteAccount(accountId);

    if (primaryAccountId === accountId) {
      setPrimaryAccountId(null);
    }

    if (incomeAccountId === accountId) {
      setIncomeAccountId(null);
    }

    setSelectedAccountId(null);
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : 'Не удалось удалить счёт',
    );
  }
}}
      />

      <EditAccountModal
        open={!!editing}
        account={editing}
        isSaving={isUpdating}
        onClose={closeEdit}
        onSave={async (accountId, payload) => {
          await updateAccount(accountId, payload);
        }}
      />
    </div>
  );
}
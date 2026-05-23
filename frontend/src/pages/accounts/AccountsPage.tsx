import { useEffect, useMemo, useState } from 'react';

import type { AccountDto } from '@/features/accounts/api/accounts.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { AccountsSummary } from '@/features/accounts/ui/AccountsSummary';
import { AccountCard } from '@/features/accounts/ui/AccountCard';
import { AccountDetailsSheet } from '@/features/accounts/ui/AccountDetailsSheet';
import { AccountTransferSheet } from '@/features/accounts/ui/AccountTransferSheet';
import { EditAccountModal } from '@/features/accounts/ui/EditAccountModal';
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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transferFromAccountId, setTransferFromAccountId] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const openAIWithCommand = useNavigationStore((s) => s.openAIWithCommand);

  const items = useAccountsStore((state) => state.items);
  const isLoading = useAccountsStore((state) => state.isLoading);
  const error = useAccountsStore((state) => state.error);
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

  const createTransfer = useTransactionsStore((state) => state.createTransfer);
  const isTransferSaving = useTransactionsStore((state) => state.isMutating);

  const openCreateAccount = useAccountFlowStore((state) => state.openCreateAccount);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const selectedAccount = useMemo(() => items.find((item) => item.id === selectedAccountId) ?? null, [items, selectedAccountId]);
  const transferFromAccount = useMemo(() => items.find((item) => item.id === transferFromAccountId) ?? null, [items, transferFromAccountId]);

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

  const handleCreateTransfer = async (payload: { fromAccountId: string; toAccountId: string; amount: number; description?: string | null }) => {
    await createTransfer(payload);
    await loadAccounts(true);
    setTransferFromAccountId(null);
    setSelectedAccountId(payload.fromAccountId);
  };

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
            <button type="button" onClick={() => setToolsOpen(true)} className="app-icon-button app-icon-button--lg" aria-label="Настройки счетов">⚙</button>
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
          <button type="button" onClick={() => openCreateAccount({ type: 'card', currency: mainCurrency })} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">＋</span>
            <span><b>Создать счёт</b><small>Карта, наличные или цель</small></span>
          </button>
          <button type="button" disabled={items.length < 2} onClick={() => setTransferFromAccountId(primaryAccount?.id ?? items[0]?.id ?? null)} className="app-action-card app-action-card--wide disabled:opacity-40">
            <span className="app-action-card__icon">⇄</span>
            <span><b>Перевод</b><small>Между своими счетами</small></span>
          </button>
        </section>

        {error && items.length === 0 ? (
          <ErrorState title="Счета не загрузились" message={error} onRetry={() => void loadAccounts(true)} onOpenAI={() => openAIWithCommand()} />
        ) : isLoading ? (
          <div className="app-card p-5 text-sm text-white/60">Загружаю счета...</div>
        ) : items.length === 0 ? (
          <EmptyAccountsState onCreate={() => openCreateAccount()} />
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
                      onClick={() => setSelectedAccountId(account.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {toolsOpen ? (
        <div className="app-modal-backdrop" data-no-swipe="true" onClick={() => setToolsOpen(false)}>
          <div className="app-modal-sheet app-accounts-tools" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div>
                <div className="app-eyebrow">Настройки счетов</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">Правила кошелька</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">Здесь только служебные настройки. Основные действия вынесены на страницу.</p>
              </div>

              <section className="app-settings-grid">
                <div className="app-settings-tile">
                  <div className="text-xs text-white/42">Основная валюта</div>
                  <div className="mt-3 flex gap-2">
                    {(['RUB', 'USD', 'EUR'] as const).map((currency) => (
                      <button key={currency} type="button" onClick={() => setMainCurrency(currency)} className={mainCurrency === currency ? 'app-choice app-choice--active' : 'app-choice'}>{currency}</button>
                    ))}
                  </div>
                </div>
                <div className="app-settings-tile"><small>Главный счёт</small><b>{primaryAccount?.name || 'Не выбран'}</b></div>
                <div className="app-settings-tile"><small>Доходы по умолчанию</small><b>{incomeAccount?.name || primaryAccount?.name || 'Не выбран'}</b></div>
              </section>

              <div className="grid gap-2">
                <button type="button" onClick={() => openAIWithCommand('сделай наличку основной')} className="app-list-button"><span>Сказать Фине</span><small>“сделай наличку основной”</small></button>
                <button type="button" onClick={() => openAIWithCommand('создай счет наличка')} className="app-list-button"><span>Создать голосом</span><small>“создай счет наличка”</small></button>
              </div>
            </div>
            <footer className="app-modal-footer"><button type="button" onClick={() => setToolsOpen(false)} className="app-secondary-button w-full">Готово</button></footer>
          </div>
        </div>
      ) : null}

      <AccountDetailsSheet
        account={selectedAccount}
        open={!!selectedAccount}
        isPrimary={selectedAccount?.id === primaryAccountId}
        isIncomeDefault={selectedAccount?.id === incomeAccountId}
        isDeleting={isDeleting}
        onClose={() => setSelectedAccountId(null)}
        onEdit={(account) => openEdit(account)}
        onDelete={async (accountId) => {
          await deleteAccount(accountId);
          setSelectedAccountId(null);
        }}
        onSetPrimary={(accountId) => setPrimaryAccountId(accountId)}
        onSetIncomeDefault={(accountId) => setIncomeAccountId(accountId)}
        onTransfer={(account) => setTransferFromAccountId(account.id)}
        onAskAI={() => selectedAccount ? openAIWithCommand(`покажи счет ${selectedAccount.name}`) : openAIWithCommand()}
      />

      <AccountTransferSheet
        open={!!transferFromAccount}
        fromAccount={transferFromAccount}
        accounts={items}
        isSaving={isTransferSaving}
        onClose={() => setTransferFromAccountId(null)}
        onSubmit={handleCreateTransfer}
      />

      <EditAccountModal open={!!editing} account={editing} isSaving={isUpdating} onClose={closeEdit} onSave={async (id, payload) => {
          await updateAccount(id, payload);
        }} />
    </div>
  );
}

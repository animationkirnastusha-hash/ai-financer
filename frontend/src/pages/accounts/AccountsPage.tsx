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
import { SettingsGearIcon } from '@/shared/ui/AppIcons';
import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';

type CurrencyGroup = {
  currency: string;
  total: number;
  accounts: AccountDto[];
};

export default function AccountsPage() {
  const { t } = useI18n();
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

  const openCreateAccountWithFina = () => {
    openModal({
      type: 'ai-text-overlay',
      initialAssistantMessage: t('accounts.ai.create.message'),
      hiddenCommandPrefix: t('accounts.ai.create.prefix'),
      autoSubmitInitialCommand: false,
    });
  };

  const openTransferWithFina = (account?: AccountDto | null) => {
    const source = account ?? primaryAccount ?? items[0] ?? null;

    openModal({
      type: 'ai-text-overlay',
      initialAssistantMessage: source
        ? t('accounts.ai.transfer.message', { name: source.name })
        : t('accounts.ai.transfer.message.empty'),
      hiddenCommandPrefix: source
        ? t('accounts.ai.transfer.prefix', { name: source.name })
        : t('accounts.ai.transfer.prefix.empty'),
      autoSubmitInitialCommand: false,
    });
  };

  const accountTypeLabel = (type?: string | null) => {
    if (type === 'cash') return t('accounts.type.cash');
    if (type === 'card') return t('accounts.type.card');
    if (type === 'savings') return t('accounts.type.savings');
    if (type === 'credit') return t('accounts.type.credit');
    return t('accounts.type.default');
  };

  return (
    <div className="app-page app-accounts-page text-white">
      <div className="app-page__inner">
        <PageHeader title={t('accounts.title')} subtitle={t('accounts.subtitle')} />

        <header className="app-card app-card--hero app-accounts-hero app-accounts-hero--compact">
          <div className="app-accounts-hero__top">
            <div className="min-w-0">
              <div className="app-eyebrow">{t('accounts.eyebrow')}</div>
              <h1 className="app-hero-title">{t('accounts.hero.title')}</h1>
              <p className="app-hero-caption">{t('accounts.hero.caption')}</p>
            </div>
            <button type="button" onClick={() => openModal({ type: 'accounts-tools' })} className="app-icon-button app-icon-button--lg" aria-label={t('accounts.settingsLabel')}>
              <SettingsGearIcon className="app-icon-button__svg" />
            </button>
          </div>

          <AccountsSummary total={formatMoney(mainGroup?.total ?? 0, mainCurrency)} />

          <div className="app-accounts-stats">
            <div><span>{totalAccounts}</span><small>{t('accounts.stats.count')}</small></div>
            <div><span>{primaryAccount?.name || '—'}</span><small>{t('accounts.stats.primary')}</small></div>
            <div><span>{incomeAccount?.name || primaryAccount?.name || '—'}</span><small>{t('accounts.stats.income')}</small></div>
          </div>
        </header>

        <section className="app-card app-accounts-actions" aria-label={t('accounts.actions.title')}>
          <button type="button" onClick={openCreateAccountWithFina} className="app-action-card app-action-card--wide">
            <span className="app-action-card__icon">＋</span>
            <span><b>{t('accounts.actions.create')}</b><small>{t('accounts.actions.create.caption')}</small></span>
          </button>
          <button type="button" disabled={items.length < 2} onClick={() => openTransferWithFina()} className="app-action-card app-action-card--wide disabled:opacity-40">
            <span className="app-action-card__icon">⇄</span>
            <span><b>{t('accounts.actions.transfer')}</b><small>{t('accounts.actions.transfer.caption')}</small></span>
          </button>
        </section>

        {error && items.length === 0 ? (
          <ErrorState title={t('accounts.error.title')} message={error} onRetry={() => void loadAccounts(true)} onOpenAI={() => openAIWithCommand()} />
        ) : isLoading ? (
          <div className="app-card app-accounts-loading">{t('accounts.loading')}</div>
        ) : items.length === 0 ? (
          <EmptyAccountsState onCreate={openCreateAccountWithFina} />
        ) : (
          <div className="app-accounts-groups">
            {grouped.map((group) => (
              <section key={group.currency} className="app-card app-accounts-group">
                <div className="app-accounts-group__head">
                  <div className="min-w-0">
                    <div className="app-section-title">{group.currency}</div>
                    <div className="app-accounts-group__meta">{t('accounts.group.count', { count: group.accounts.length })} · {formatMoney(group.total, group.currency)}</div>
                  </div>
                  {group.currency === mainCurrency ? <span className="app-badge app-badge--green">{t('accounts.mainCurrency')}</span> : null}
                </div>

                <div className="app-accounts-group__list">
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

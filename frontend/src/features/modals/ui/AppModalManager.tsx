import { useEffect, useMemo } from 'react';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { AccountDetailsSheet } from '@/features/accounts/ui/AccountDetailsSheet';
import { AccountTransferSheet } from '@/features/accounts/ui/AccountTransferSheet';
import { CreateAccountSheet } from '@/features/accounts/ui/CreateAccountSheet';
import { EditAccountModal } from '@/features/accounts/ui/EditAccountModal';
import { HomeCategoryOperationsModal } from '@/features/dashboard/ui/HomeCategoryOperationsModal';
import { HomeChartDetailsModal } from '@/features/dashboard/ui/HomeChartDetailsModal';
import { goalsApi } from '@/features/goals/api/goals.api';
import { GoalEditSheet } from '@/features/goals/ui/GoalEditSheet';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { CategoryEditSheet } from '@/features/sections/ui/CategoryEditSheet';
import { SectionEditSheet } from '@/features/sections/ui/SectionEditSheet';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useTransactionsStore } from '@/features/transactions/model/transactions.store';
import { TransactionCreateSheet } from '@/features/transactions/ui/TransactionCreateSheet';
import { TransactionEditSheet } from '@/features/transactions/ui/TransactionEditSheet';
import { useAppModalStore, type AppModalDescriptor } from '@/features/modals/model/appModal.store';

function pickModal<T extends AppModalDescriptor['type']>(stack: AppModalDescriptor[], type: T) {
  return [...stack].reverse().find((modal): modal is Extract<AppModalDescriptor, { type: T }> => modal.type === type) ?? null;
}

export function AppModalManager() {
  const stack = useAppModalStore((state) => state.stack);
  const openModal = useAppModalStore((state) => state.openModal);
  const closeModal = useAppModalStore((state) => state.closeModal);
  const closeAllModals = useAppModalStore((state) => state.closeAllModals);

  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const createAccount = useAccountsStore((state) => state.createAccount);
  const updateAccount = useAccountsStore((state) => state.updateAccount);
  const deleteAccount = useAccountsStore((state) => state.deleteAccount);
  const isDeletingAccount = useAccountsStore((state) => state.isDeleting);
  const isUpdatingAccount = useAccountsStore((state) => state.isUpdating);

  const setPrimaryAccountId = useSettingsStore((state) => state.setPrimaryAccountId);
  const setIncomeAccountId = useSettingsStore((state) => state.setIncomeAccountId);
  const primaryAccountId = useSettingsStore((state) => state.primaryAccountId);
  const incomeAccountId = useSettingsStore((state) => state.incomeAccountId);
  const setMainCurrency = useSettingsStore((state) => state.setMainCurrency);
  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  const transactions = useTransactionsStore((state) => state.items);
  const loadTransactions = useTransactionsStore((state) => state.loadTransactions);
  const createTransaction = useTransactionsStore((state) => state.createItem);
  const createTransfer = useTransactionsStore((state) => state.createTransfer);
  const updateTransaction = useTransactionsStore((state) => state.updateItem);
  const deleteTransaction = useTransactionsStore((state) => state.deleteItem);
  const isTransactionSaving = useTransactionsStore((state) => state.isMutating);

  const sections = useSectionsStore((state) => state.sections);
  const categories = useSectionsStore((state) => state.categories);
  const loadTaxonomy = useSectionsStore((state) => state.loadAll);
  const createSection = useSectionsStore((state) => state.createSection);
  const updateSection = useSectionsStore((state) => state.updateSection);
  const deleteSection = useSectionsStore((state) => state.deleteSection);
  const createCategory = useSectionsStore((state) => state.createCategory);
  const updateCategory = useSectionsStore((state) => state.updateCategory);
  const deleteCategory = useSectionsStore((state) => state.deleteCategory);
  const isCreatingTaxonomy = useSectionsStore((state) => state.isCreating);
  const isTaxonomySaving = useSectionsStore((state) => state.isMutating);

  const accountCreateModal = pickModal(stack, 'account-create');
  const accountDetailsModal = pickModal(stack, 'account-details');
  const accountEditModal = pickModal(stack, 'account-edit');
  const accountTransferModal = pickModal(stack, 'account-transfer');
  const transactionCreateModal = pickModal(stack, 'transaction-create');
  const transactionEditModal = pickModal(stack, 'transaction-edit');
  const categoryEditModal = pickModal(stack, 'category-edit');
  const sectionEditModal = pickModal(stack, 'section-edit');
  const goalEditModal = pickModal(stack, 'goal-edit');
  const chartDetailsModal = pickModal(stack, 'home-chart-details');
  const categoryOperationsModal = pickModal(stack, 'home-category-operations');
  const accountsToolsModal = pickModal(stack, 'accounts-tools');
  const taxonomyToolsModal = pickModal(stack, 'taxonomy-tools');
  const taxonomySectionModal = pickModal(stack, 'taxonomy-section');

  const updateAccountDraft = useAccountFlowStore((state) => state.updateDraft);
  const resetAccountDraft = useAccountFlowStore((state) => state.resetDraft);

  useEffect(() => {
    if (!accountCreateModal) return;
    updateAccountDraft(accountCreateModal.prefill ?? {});
  }, [accountCreateModal, updateAccountDraft]);

  useEffect(() => {
    if (accountDetailsModal || accountTransferModal || accountEditModal) void loadAccounts();
  }, [accountDetailsModal, accountEditModal, accountTransferModal, loadAccounts]);

  useEffect(() => {
    if (categoryEditModal || sectionEditModal || taxonomySectionModal || taxonomyToolsModal) void loadTaxonomy();
  }, [categoryEditModal, loadTaxonomy, sectionEditModal, taxonomySectionModal, taxonomyToolsModal]);

  useEffect(() => {
    if (chartDetailsModal || categoryOperationsModal || transactionEditModal) void loadTransactions(true);
  }, [categoryOperationsModal, chartDetailsModal, loadTransactions, transactionEditModal]);

  const rates = useMemo(() => ({ usd: rubToUsdRate || 90, eur: rubToEurRate || 100 }), [rubToEurRate, rubToUsdRate]);
  const accountDetails = accountDetailsModal ? accounts.find((account) => account.id === accountDetailsModal.accountId) ?? null : null;
  const transferFromAccount = accountTransferModal ? accounts.find((account) => account.id === accountTransferModal.fromAccountId) ?? null : null;
  const categoryModalCategory = categoryEditModal?.category ?? null;
  const sectionModalSection = sectionEditModal?.section ?? null;
  const taxonomyModalCategories = useMemo(() => {
    if (!taxonomySectionModal) return [];
    const section = taxonomySectionModal.section;
    if (section === 'ungrouped') return categories.filter((category) => !category.sectionId);
    return categories.filter((category) => category.sectionId === section.id);
  }, [categories, taxonomySectionModal]);

  async function refreshFinance() {
    await Promise.allSettled([loadAccounts(true), loadTransactions(true), loadTaxonomy(true)]);
  }

  useEffect(() => {
    if (stack.length <= 0) return;
    document.body.classList.add('ai-any-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');

    return () => {
      document.body.classList.remove('ai-any-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
    };
  }, [stack.length]);


  return (
    <>
      <CreateAccountSheet
        open={Boolean(accountCreateModal)}
        onClose={() => {
          resetAccountDraft();
          closeModal('account-create');
        }}
        onSubmit={async (payload) => {
          await createAccount(payload);
          resetAccountDraft();
          closeModal('account-create');
          await loadAccounts(true);
        }}
      />

      <AccountDetailsSheet
        account={accountDetails}
        open={Boolean(accountDetails)}
        isPrimary={accountDetails?.id === primaryAccountId}
        isIncomeDefault={accountDetails?.id === incomeAccountId}
        isDeleting={isDeletingAccount}
        onClose={() => closeModal('account-details')}
        onEdit={(account) => openModal({ type: 'account-edit', account })}
        onDelete={async (accountId) => {
          await deleteAccount(accountId);
          closeModal('account-details');
          await refreshFinance();
        }}
        onSetPrimary={(accountId) => setPrimaryAccountId(accountId)}
        onSetIncomeDefault={(accountId) => setIncomeAccountId(accountId)}
        onTransfer={(account) => openModal({ type: 'account-transfer', fromAccountId: account.id })}
        onAskAI={() => navigateTo('ai-core')}
      />

      <AccountTransferSheet
        open={Boolean(transferFromAccount)}
        fromAccount={transferFromAccount}
        accounts={accounts}
        isSaving={isTransactionSaving}
        onClose={() => closeModal('account-transfer')}
        onSubmit={async (payload) => {
          await createTransfer(payload);
          closeModal('account-transfer');
          await refreshFinance();
        }}
      />

      <EditAccountModal
        open={Boolean(accountEditModal)}
        account={accountEditModal?.account ?? null}
        isSaving={isUpdatingAccount}
        onClose={() => closeModal('account-edit')}
        onSave={async (id, payload) => {
          await updateAccount(id, payload);
          closeModal('account-edit');
          await refreshFinance();
        }}
      />

      <TransactionCreateSheet
        open={Boolean(transactionCreateModal)}
        initialType={transactionCreateModal?.initialType}
        isSaving={isTransactionSaving}
        onClose={() => closeModal('transaction-create')}
        onSave={async (payload) => {
          closeModal('transaction-create');
          await createTransaction(payload);
          await refreshFinance();
        }}
      />

      <TransactionEditSheet
        open={Boolean(transactionEditModal)}
        transaction={transactionEditModal?.transaction ?? null}
        isSaving={isTransactionSaving}
        onClose={() => closeModal('transaction-edit')}
        onSave={async (payload) => {
          if (!transactionEditModal) return;
          const transactionId = transactionEditModal.transaction.id;
          closeModal('transaction-edit');
          await updateTransaction(transactionId, payload);
          await refreshFinance();
        }}
        onDelete={async (transaction) => {
          closeModal('transaction-edit');
          await deleteTransaction(transaction);
          await refreshFinance();
        }}
      />

      <CategoryEditSheet
        open={Boolean(categoryEditModal)}
        category={categoryModalCategory}
        sections={sections}
        initialType={categoryEditModal?.initialType}
        initialSectionId={categoryEditModal?.sectionId ?? null}
        isSaving={isCreatingTaxonomy || isTaxonomySaving}
        onClose={() => closeModal('category-edit')}
        onSave={async (payload) => {
          const saved = categoryEditModal?.category
            ? await updateCategory(categoryEditModal.category.id, payload)
            : await createCategory({ ...payload, sectionId: payload.sectionId ?? categoryEditModal?.sectionId ?? null });
          categoryEditModal?.onSavedCategory?.(saved);
          closeModal('category-edit');
          await loadTaxonomy(true);
        }}
        onDelete={async (category) => {
          await deleteCategory(category.id);
          closeModal('category-edit');
          await loadTaxonomy(true);
        }}
      />

      <SectionEditSheet
        open={Boolean(sectionEditModal)}
        section={sectionModalSection}
        isSaving={isCreatingTaxonomy || isTaxonomySaving}
        onClose={() => closeModal('section-edit')}
        onSave={async (payload) => {
          if (sectionEditModal?.section) await updateSection(sectionEditModal.section.id, payload);
          else await createSection(payload);
          closeModal('section-edit');
          await loadTaxonomy(true);
        }}
        onDelete={async (section) => {
          await deleteSection(section.id);
          closeModal('section-edit');
          await loadTaxonomy(true);
        }}
      />

      <GoalEditSheet
        open={Boolean(goalEditModal)}
        goal={goalEditModal?.goal ?? null}
        isSaving={false}
        onClose={() => closeModal('goal-edit')}
        onSave={async (payload) => {
          if (goalEditModal?.goal) await goalsApi.update(goalEditModal.goal.id, payload);
          else await goalsApi.create(payload);
          goalEditModal?.onAfterSave?.();
          closeModal('goal-edit');
        }}
        onDelete={async (goal) => {
          await goalsApi.delete(goal.id);
          goalEditModal?.onAfterSave?.();
          closeModal('goal-edit');
        }}
      />

      <HomeChartDetailsModal
        open={Boolean(chartDetailsModal)}
        transactions={transactions}
        mode={chartDetailsModal?.mode ?? 'expense'}
        period={chartDetailsModal?.period ?? 'month'}
        rates={rates}
        onClose={() => closeModal('home-chart-details')}
        onOpenAnalytics={() => {
          closeAllModals();
          navigateTo('analytics');
        }}
        onOpenGroup={(group) => openModal({ type: 'home-category-operations', group })}
      />

      <HomeCategoryOperationsModal
        group={categoryOperationsModal?.group ?? null}
        onClose={() => closeModal('home-category-operations')}
        onEdit={(transaction) => openModal({ type: 'transaction-edit', transaction })}
      />

      {accountsToolsModal ? (
        <div className="app-modal-backdrop" data-no-swipe="true" onClick={() => closeModal('accounts-tools')}>
          <div className="app-modal-sheet app-accounts-tools" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div>
                <div className="app-eyebrow">Счета</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">Правила кошелька</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">Выбери основную валюту и быстро проверь важные счета.</p>
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
                <div className="app-settings-tile"><small>Главный счёт</small><b>{accounts.find((item) => item.id === primaryAccountId)?.name || 'Не выбран'}</b></div>
                <div className="app-settings-tile"><small>Доходы</small><b>{accounts.find((item) => item.id === incomeAccountId)?.name || 'Не выбран'}</b></div>
              </section>
            </div>
            <footer className="app-modal-footer"><button type="button" onClick={() => closeModal('accounts-tools')} className="app-secondary-button w-full">Готово</button></footer>
          </div>
        </div>
      ) : null}

      {taxonomyToolsModal ? (
        <div className="app-modal-backdrop" data-no-swipe="true" onClick={() => closeModal('taxonomy-tools')}>
          <div className="app-modal-sheet app-taxonomy-tools" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div>
                <div className="app-eyebrow">Категории</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">Порядок для расходов и доходов</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">Разделы объединяют категории и помогают видеть, куда уходят деньги.</p>
              </div>
            </div>
            <footer className="app-modal-footer">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => closeModal('taxonomy-tools')} className="app-secondary-button">Закрыть</button>
                <button type="button" onClick={() => openModal({ type: 'section-edit', section: null })} className="app-primary-button">Новый раздел</button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {taxonomySectionModal ? (
        <div className="app-modal-backdrop" data-no-swipe="true" onClick={() => closeModal('taxonomy-section')}>
          <div className="app-modal-sheet app-taxonomy-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
            <div className="app-modal-handle" />
            <div className="app-modal-body space-y-4">
              <div className="app-taxonomy-modal__head">
                <div>
                  <div className="app-eyebrow">Категории</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-white">
                    {taxonomySectionModal.section === 'ungrouped' ? 'Без раздела' : taxonomySectionModal.section.name}
                  </h2>
                </div>
                {(() => {
                  const section = taxonomySectionModal.section;
                  if (section === 'ungrouped') return null;
                  return <button type="button" onClick={() => openModal({ type: 'section-edit', section })} className="app-secondary-button">Править</button>;
                })()}
              </div>

              <div className="grid gap-2">
                {taxonomyModalCategories.length === 0 ? <div className="app-empty-inline">Категорий пока нет.</div> : null}
                {taxonomyModalCategories.map((category) => (
                  <button key={category.id} type="button" onClick={() => openModal({ type: 'category-edit', category })} className="app-list-button">
                    <span>{category.icon ? `${category.icon} ` : ''}{category.name}</span>
                    <small>{category.type === 'income' ? 'Доходы' : category.type === 'both' ? 'Расходы и доходы' : 'Расходы'}</small>
                  </button>
                ))}
              </div>
            </div>
            <footer className="app-modal-footer">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => closeModal('taxonomy-section')} className="app-secondary-button">Закрыть</button>
                <button type="button" onClick={() => openModal({ type: 'category-edit', sectionId: taxonomySectionModal.section === 'ungrouped' ? null : taxonomySectionModal.section.id })} className="app-primary-button">Категория</button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}

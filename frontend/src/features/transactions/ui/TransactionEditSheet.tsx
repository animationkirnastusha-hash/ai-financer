import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import type { DeleteTransactionBalanceMode, TransactionDto } from '@/features/transactions/api/transactions.api';
import { formatMoney } from '@/shared/lib/money';

type TransactionType = 'income' | 'expense' | 'transfer';

type Props = {
  open: boolean;
  transaction: TransactionDto | null;
  isSaving?: boolean;
  modalLayer?: number;
  onClose: () => void;
  onSave: (payload: {
    amount?: number;
    title?: string | null;
    description?: string | null;
    date?: string;
    accountId?: string;
    categoryId?: string | null;
    type?: TransactionType;
    toAccountId?: string | null;
  }) => Promise<void> | void;
  onDelete: (transaction: TransactionDto, balanceMode?: DeleteTransactionBalanceMode) => Promise<void> | void;
};

function toDateInput(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function getTransactionTitle(transaction: TransactionDto | null) {
  if (!transaction) return 'Операция';
  if (transaction.title?.trim()) return transaction.title.trim();
  if (transaction.description?.trim()) return transaction.description.trim();
  if (transaction.category?.name) return transaction.category.name;
  if (transaction.type === 'income') return 'Доход';
  if (transaction.type === 'transfer') return 'Перевод';
  return 'Расход';
}

function Badge({ children, muted = false, tone }: { children: ReactNode; muted?: boolean; tone?: 'violet' }) {
  const className = tone === 'violet'
    ? 'border-violet-300/20 bg-violet-300/10 text-violet-50'
    : muted
      ? 'border-white/8 bg-white/[0.04] text-white/42'
      : 'border-white/10 bg-white/[0.07] text-white/70';

  return <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>{children}</span>;
}

export function TransactionEditSheet({
  open,
  transaction,
  isSaving = false,
  modalLayer,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const categories = useSectionsStore((state) => state.categories);
  const sections = useSectionsStore((state) => state.sections);
  const loadTaxonomy = useSectionsStore((state) => state.loadAll);

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toDateInput(null));
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadAccounts();
    void loadTaxonomy();
  }, [loadAccounts, loadTaxonomy, open]);

  useEffect(() => {
    if (!transaction || !open) return;

    setType(transaction.type);
    setAmount(String(transaction.amount ?? ''));
    setTitle(transaction.title ?? '');
    setDescription(transaction.description ?? '');
    setDate(toDateInput(transaction.date));
    setAccountId(transaction.accountId ?? '');
    setToAccountId(transaction.toAccountId ?? null);
    setLocalError(null);
  }, [open, transaction]);

  const selectedAccount = accounts.find((account) => account.id === accountId) ?? transaction?.account ?? null;
  const selectedCategory = useMemo(() => {
    if (!transaction?.categoryId) return transaction?.category ?? null;
    return categories.find((category) => category.id === transaction.categoryId) ?? transaction.category ?? null;
  }, [categories, transaction]);
  const selectedSection = selectedCategory?.sectionId
    ? sections.find((section) => section.id === selectedCategory.sectionId) ?? selectedCategory.section ?? transaction?.section ?? null
    : transaction?.section ?? null;
  const parsedAmount = Number(amount.replace(',', '.'));
  const canSave = Number.isFinite(parsedAmount) && parsedAmount > 0 && Boolean(accountId) && !isSaving;

  if (!open || !transaction) return null;

  const currentTransaction = transaction;

  async function submit() {
    setLocalError(null);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setLocalError('Введи сумму больше нуля.');
      return;
    }

    if (!accountId) {
      setLocalError('Выбери счёт.');
      return;
    }

    if (type !== 'transfer' && title.trim().length < 2) {
      setLocalError('Напиши название операции. По нему Фина обновит категорию и иконку.');
      return;
    }

    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setLocalError('Для перевода нужен другой счёт получателя.');
      return;
    }

    await onSave({
      amount: Math.round(parsedAmount),
      title: title.trim() || null,
      description: description.trim() || null,
      date: new Date(`${date}T12:00:00`).toISOString(),
      accountId,
      categoryId: undefined,
      type,
      toAccountId: type === 'transfer' ? toAccountId : null,
    });
  }

  async function remove() {
    const titleText = getTransactionTitle(currentTransaction);
    const shouldRevertBalance = window.confirm(
      `Удалить операцию «${titleText}» и вернуть деньги на счёт?\n\nОК — удалить и пересчитать баланс.\nОтмена — выбрать следующий вариант.`,
    );

    if (shouldRevertBalance) {
      await onDelete(currentTransaction, 'revert');
      return;
    }

    const shouldKeepBalance = window.confirm(
      `Удалить только запись «${titleText}», не меняя баланс счёта?`,
    );

    if (!shouldKeepBalance) return;
    await onDelete(currentTransaction, 'keep');
  }

  return (
    <div
      className="app-modal-backdrop app-transaction-edit-backdrop"
      style={{ zIndex: modalLayer ?? 420 }}
      data-no-swipe="true"
      onClick={onClose}
    >
      <div className="app-modal-sheet app-transaction-edit-sheet" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />

        <div className="app-modal-body mx-auto max-w-[560px] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="app-eyebrow">Операция</div>
              <h2 className="mt-1 truncate text-2xl font-semibold">{getTransactionTitle(transaction)}</h2>
              <div className="mt-2 text-sm text-white/45">
                {selectedAccount ? selectedAccount.name : 'Счёт'} · {selectedAccount?.currency || 'RUB'}
              </div>
            </div>
            <button type="button" onClick={onClose} className="app-icon-button" aria-label="Закрыть">×</button>
          </div>

          <section className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.14),transparent_42%),rgba(255,255,255,0.04)] p-4">
            <div className="text-xs text-white/42">Сумма</div>
            <div className="mt-2 text-2xl font-semibold">
              {formatMoney(Number(transaction.amount) || 0, selectedAccount?.currency || transaction.account?.currency || 'RUB', {
                sign: transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none',
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSection ? <Badge>{selectedSection.icon ? `${selectedSection.icon} ` : ''}{selectedSection.name}</Badge> : <Badge muted>Раздел появится автоматически</Badge>}
              {selectedCategory ? <Badge>{selectedCategory.icon ? `${selectedCategory.icon} ` : ''}{selectedCategory.name}</Badge> : <Badge muted>Категория появится автоматически</Badge>}
              {transaction.isAIGenerated ? <Badge tone="violet">Фина</Badge> : null}
            </div>
          </section>

          <div className="grid grid-cols-3 gap-2">
            {(['expense', 'income', 'transfer'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setType(item);
                  if (item === 'transfer') setToAccountId(null);
                }}
                className={type === item ? 'app-choice app-choice--active' : 'app-choice'}
              >
                {item === 'expense' ? 'Расход' : item === 'income' ? 'Доход' : 'Перевод'}
              </button>
            ))}
          </div>

          {type !== 'transfer' ? (
            <label className="app-field">
              <span>Название</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: колбаса" />
            </label>
          ) : null}

          <label className="app-field">
            <span>Сумма</span>
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Например 350" />
          </label>

          {type !== 'transfer' ? (
            <label className="app-field">
              <span>Описание</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Необязательно: магазин, детали покупки, комментарий" />
            </label>
          ) : null}

          <label className="app-field">
            <span>Дата</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="[color-scheme:dark]" />
          </label>

          <section className="rounded-[24px] border border-white/8 bg-white/[0.035] p-3">
            <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">Счёт</div>
            <div className="grid gap-2">
              {accounts.map((account) => (
                <button key={account.id} type="button" onClick={() => setAccountId(account.id)} className={accountId === account.id ? 'app-list-button app-list-button--active' : 'app-list-button'}>
                  <span>{account.name}</span>
                  <small>{formatMoney(Number(account.balance) || 0, account.currency)}</small>
                </button>
              ))}
            </div>
          </section>

          {type === 'transfer' ? (
            <section className="rounded-[24px] border border-white/8 bg-white/[0.035] p-3">
              <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">Куда</div>
              <div className="grid gap-2">
                {accounts.filter((account) => account.id !== accountId).map((account) => (
                  <button key={account.id} type="button" onClick={() => setToAccountId(account.id)} className={toAccountId === account.id ? 'app-list-button app-list-button--active' : 'app-list-button'}>
                    <span>{account.name}</span>
                    <small>{account.currency}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="app-inline-hint">После сохранения Фина пересоберёт категорию, раздел, цвет и иконку по названию и описанию.</div>
          )}

          {localError ? <div className="app-error-box">{localError}</div> : null}
        </div>

        <footer className="app-modal-footer">
          <div className="grid gap-3 min-[420px]:grid-cols-[1fr_auto]">
            <button type="button" disabled={!canSave} onClick={() => void submit()} className="app-primary-button">
              {isSaving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button type="button" onClick={() => void remove()} className="app-secondary-button text-red-100">
              Удалить
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

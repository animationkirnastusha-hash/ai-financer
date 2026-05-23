import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { useSectionsStore } from '@/features/sections/model/sections.store';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { formatMoney } from '@/shared/lib/money';

type TransactionType = 'income' | 'expense' | 'transfer';

type Props = {
  open: boolean;
  transaction: TransactionDto | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: {
    amount?: number;
    description?: string | null;
    date?: string;
    accountId?: string;
    categoryId?: string | null;
    type?: TransactionType;
    toAccountId?: string | null;
  }) => Promise<void> | void;
  onDelete: (transaction: TransactionDto) => Promise<void> | void;
  onOpenAI?: () => void;
};

function toDateInput(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function getTransactionTitle(transaction: TransactionDto | null) {
  if (!transaction) return 'Операция';
  if (transaction.description?.trim()) return transaction.description.trim();
  if (transaction.category?.name) return transaction.category.name;
  if (transaction.type === 'income') return 'Доход';
  if (transaction.type === 'transfer') return 'Перевод';
  return 'Расход';
}

export function TransactionEditSheet({
  open,
  transaction,
  isSaving = false,
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
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toDateInput(null));
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
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
    setDescription(transaction.description ?? '');
    setDate(toDateInput(transaction.date));
    setAccountId(transaction.accountId ?? '');
    setCategoryId(transaction.categoryId ?? null);
    setToAccountId(transaction.toAccountId ?? null);
    setLocalError(null);
  }, [open, transaction]);

  const filteredCategories = useMemo(() => {
    if (type === 'transfer') return [];
    return categories.filter((category) => {
      if (!category.type || category.type === 'both') return true;
      return category.type === type;
    });
  }, [categories, type]);

  const selectedCategory = filteredCategories.find((category) => category.id === categoryId) ?? null;
  const selectedSection = selectedCategory?.sectionId
    ? sections.find((section) => section.id === selectedCategory.sectionId) ?? null
    : null;
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? transaction?.account ?? null;
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

    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setLocalError('Для перевода нужен другой счёт получателя.');
      return;
    }

    await onSave({
      amount: Math.round(parsedAmount),
      description: description.trim() || null,
      date: new Date(`${date}T12:00:00`).toISOString(),
      accountId,
      categoryId: type === 'transfer' ? null : categoryId,
      type,
      toAccountId: type === 'transfer' ? toAccountId : null,
    });
  }

  async function remove() {
    const confirmed = window.confirm(`Удалить операцию «${getTransactionTitle(currentTransaction)}»?`);
    if (!confirmed) return;
    await onDelete(currentTransaction);
  }

  return (
    <div className="fixed inset-0 z-[112] flex items-end bg-black/70 backdrop-blur-sm" data-no-swipe="true">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Операция</div>
              <h2 className="mt-1 truncate text-2xl font-semibold">{getTransactionTitle(transaction)}</h2>
              <div className="mt-2 text-sm text-white/45">
                {selectedAccount ? selectedAccount.name : 'Счёт'} · {selectedAccount?.currency || 'RUB'}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm"
            >
              Закрыть
            </button>
          </div>

          <section className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.14),transparent_42%),rgba(255,255,255,0.04)] p-4">
            <div className="text-xs text-white/42">Сумма</div>
            <div className="mt-2 text-2xl font-semibold">
              {formatMoney(Number(transaction.amount) || 0, selectedAccount?.currency || transaction.account?.currency || 'RUB', {
                sign: transaction.type === 'income' ? 'plus' : transaction.type === 'expense' ? 'minus' : 'none',
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSection ? <Badge>{selectedSection.icon ? `${selectedSection.icon} ` : ''}{selectedSection.name}</Badge> : <Badge muted>Без раздела</Badge>}
              {selectedCategory ? <Badge>{selectedCategory.icon ? `${selectedCategory.icon} ` : ''}{selectedCategory.name}</Badge> : null}
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
                  if (item === 'transfer') setCategoryId(null);
                }}
                className={`rounded-2xl border px-3 py-3 text-sm transition active:scale-[0.99] ${
                  type === item
                    ? 'border-emerald-300/25 bg-emerald-300/12 text-emerald-50'
                    : 'border-white/10 bg-white/[0.04] text-white/45'
                }`}
              >
                {item === 'expense' ? 'Расход' : item === 'income' ? 'Доход' : 'Перевод'}
              </button>
            ))}
          </div>

          <label className="block rounded-[22px] border border-white/8 bg-black/20 px-4 py-3">
            <div className="mb-2 text-xs text-white/42">Сумма</div>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full bg-transparent text-base outline-none placeholder:text-white/25"
              placeholder="Например 350"
            />
          </label>

          <label className="block rounded-[22px] border border-white/8 bg-black/20 px-4 py-3">
            <div className="mb-2 text-xs text-white/42">Описание</div>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full bg-transparent text-base outline-none placeholder:text-white/25"
              placeholder="Например: кофе"
            />
          </label>

          <label className="block rounded-[22px] border border-white/8 bg-black/20 px-4 py-3">
            <div className="mb-2 text-xs text-white/42">Дата</div>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full bg-transparent text-base outline-none [color-scheme:dark]"
            />
          </label>

          <section className="rounded-[24px] border border-white/8 bg-white/[0.035] p-3">
            <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">Счёт</div>
            <div className="grid gap-2">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setAccountId(account.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                    accountId === account.id
                      ? 'border-emerald-300/25 bg-emerald-300/12'
                      : 'border-white/8 bg-black/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">{account.name}</div>
                      <div className="mt-1 text-xs text-white/42">{account.type} · {account.currency}</div>
                    </div>
                    <div className="shrink-0 text-xs text-white/60">{formatMoney(Number(account.balance) || 0, account.currency)}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {type === 'transfer' ? (
            <section className="rounded-[24px] border border-white/8 bg-white/[0.035] p-3">
              <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">Куда</div>
              <div className="grid gap-2">
                {accounts.filter((account) => account.id !== accountId).map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setToAccountId(account.id)}
                    className={`rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                      toAccountId === account.id
                        ? 'border-sky-300/25 bg-sky-300/12'
                        : 'border-white/8 bg-black/20'
                    }`}
                  >
                    <div className="text-sm text-white">{account.name}</div>
                    <div className="mt-1 text-xs text-white/42">{account.currency}</div>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-[24px] border border-white/8 bg-white/[0.035] p-3">
              <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">Категория</div>
              <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
                <button
                  type="button"
                  onClick={() => setCategoryId(null)}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs ${
                    categoryId === null
                      ? 'border-white/30 bg-white/12 text-white'
                      : 'border-white/10 bg-white/[0.04] text-white/45'
                  }`}
                >
                  Без категории
                </button>
                {filteredCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-xs ${
                      categoryId === category.id
                        ? 'border-emerald-300/25 bg-emerald-300/12 text-emerald-50'
                        : 'border-white/10 bg-white/[0.04] text-white/45'
                    }`}
                  >
                    {category.icon ? `${category.icon} ` : ''}{category.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="app-transaction-ai-advice">
            <div className="app-eyebrow">Совет Фины</div>
            <div className="app-transaction-ai-advice__title">Эту операцию можно уточнить голосом</div>
            <p>
              Скажи Фине, что именно изменить: описание, сумму, дату, счёт, категорию или раздел.
              Фина подготовит изменение существующей операции, а не создаст новую.
            </p>
          </section>

          {localError ? (
            <div className="rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-50">
              {localError}
            </div>
          ) : null}

          <div className="grid gap-3 min-[420px]:grid-cols-[1fr_auto]">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void submit()}
              className="rounded-[24px] bg-emerald-400 px-5 py-4 text-base font-semibold text-black transition active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? 'Сохраняю…' : 'Сохранить'}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void remove()}
              className="rounded-[24px] border border-red-300/15 bg-red-300/10 px-5 py-4 text-base font-semibold text-red-100 transition active:scale-[0.98] disabled:opacity-50"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({
  children,
  muted = false,
  tone = 'green',
}: {
  children: ReactNode;
  muted?: boolean;
  tone?: 'green' | 'violet';
}) {
  const className = muted
    ? 'border-white/8 bg-white/[0.04] text-white/42'
    : tone === 'violet'
      ? 'border-violet-300/15 bg-violet-300/10 text-violet-100/80'
      : 'border-emerald-300/15 bg-emerald-300/10 text-emerald-100/85';

  return <span className={`rounded-full border px-3 py-1.5 text-xs ${className}`}>{children}</span>;
}

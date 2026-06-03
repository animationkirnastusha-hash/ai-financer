import { useEffect, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';

type TransactionType = 'income' | 'expense' | 'transfer';

type Props = {
  open: boolean;
  isSaving?: boolean;
  initialType?: TransactionType;
  onClose: () => void;
  onSave: (payload: {
    accountId: string;
    toAccountId?: string | null;
    amount: number;
    type: TransactionType;
    description?: string | null;
    date?: string;
    isAIGenerated?: boolean;
  }) => Promise<void> | void;
};

export function TransactionCreateSheet({ open, isSaving = false, initialType = 'expense', onClose, onSave }: Props) {
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadAccounts();
  }, [open, loadAccounts]);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setAmount('');
    setDescription('');
    setAccountId(accounts[0]?.id ?? '');
    setToAccountId(null);
    setError(null);
  }, [open, accounts, initialType]);

  const parsedAmount = Number(amount.replace(',', '.'));
  const canSave = Number.isFinite(parsedAmount) && parsedAmount > 0 && Boolean(accountId) && !isSaving;

  const submit = async () => {
    setError(null);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Введи сумму больше нуля.');
      return;
    }
    if (!accountId) {
      setError('Выбери счёт.');
      return;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setError('Для перевода нужен другой счёт получателя.');
      return;
    }

    const payload = {
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      amount: Math.round(parsedAmount),
      type,
      description: description.trim() || null,
      date: new Date().toISOString(),
      isAIGenerated: false,
    };

    onClose();
    await onSave(payload);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Новая операция"
      subtitle="Опиши покупку или доход. Фина сама выберет категорию, раздел, цвет и иконку."
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Отмена</Button>
          <Button onClick={submit} disabled={!canSave}>{isSaving ? 'Сохраняю...' : 'Сохранить'}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(['expense', 'income', 'transfer'] as const).map((item) => (
            <button key={item} type="button" onClick={() => setType(item)} className={type === item ? 'app-choice app-choice--active' : 'app-choice'}>
              {item === 'expense' ? 'Расход' : item === 'income' ? 'Доход' : 'Перевод'}
            </button>
          ))}
        </div>

        <label className="app-field">
          <span>Сумма</span>
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="350" />
        </label>

        <label className="app-field">
          <span>Описание</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Например: колбаса, кофе, зарплата" />
        </label>

        <label className="app-field">
          <span>Счёт</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Выбери счёт</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
          </select>
        </label>

        {type === 'transfer' ? (
          <label className="app-field">
            <span>Куда</span>
            <select value={toAccountId ?? ''} onChange={(event) => setToAccountId(event.target.value || null)}>
              <option value="">Выбери счёт</option>
              {accounts.filter((account) => account.id !== accountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
            </select>
          </label>
        ) : (
          <div className="app-inline-hint">Категория и раздел подставятся автоматически после сохранения.</div>
        )}

        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}

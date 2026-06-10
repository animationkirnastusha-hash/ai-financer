import { useEffect, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { TransactionTaxonomyPicker } from '@/features/transactions/ui/TransactionTaxonomyPicker';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';
import { useI18n } from '@/shared/lib/i18n';

type TransactionType = 'income' | 'expense' | 'transfer';

type Props = {
  open: boolean;
  isSaving?: boolean;
  initialType?: TransactionType;
  modalLayer?: number;
  onClose: () => void;
  onSave: (payload: {
    accountId: string;
    toAccountId?: string | null;
    categoryId?: string | null;
    amount: number;
    type: TransactionType;
    title?: string | null;
    description?: string | null;
    date?: string;
    isAIGenerated?: boolean;
  }) => Promise<void> | void;
};

export function TransactionCreateSheet({ open, isSaving = false, initialType = 'expense', modalLayer, onClose, onSave }: Props) {
  const { t } = useI18n();
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);

  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void loadAccounts();
  }, [open, loadAccounts]);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setAmount('');
    setTitle('');
    setDescription('');
    setAccountId(accounts[0]?.id ?? '');
    setToAccountId(null);
    setCategoryId('');
    setError(null);
  }, [open, accounts, initialType]);

  const parsedAmount = Number(amount.replace(',', '.'));
  const canSave = Number.isFinite(parsedAmount) && parsedAmount > 0 && Boolean(accountId) && !isSaving;

  const submit = async () => {
    setError(null);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(t('transaction.create.error.amount'));
      return;
    }
    if (!accountId) {
      setError(t('transaction.create.error.account'));
      return;
    }
    if (type !== 'transfer' && title.trim().length < 2) {
      setError(t('transaction.create.error.title'));
      return;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setError(t('transaction.create.error.transferAccount'));
      return;
    }

    const payload = {
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type !== 'transfer' ? categoryId || null : null,
      amount: Math.round(parsedAmount),
      type,
      title: title.trim() || null,
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
      title={t('transaction.create.title')}
      subtitle={t('transaction.create.subtitle')}
      layer={modalLayer}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>{t('goal.edit.cancel')}</Button>
          <Button onClick={submit} disabled={!canSave}>{isSaving ? t('goal.edit.saving') : t('goal.edit.save')}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(['expense', 'income', 'transfer'] as const).map((item) => (
            <button key={item} type="button" onClick={() => { setType(item); setToAccountId(null); if (item === 'transfer') setCategoryId(''); }} className={type === item ? 'app-choice app-choice--active' : 'app-choice'}>
              {item === 'expense' ? t('transaction.type.expense') : item === 'income' ? t('transaction.type.income') : t('transaction.type.transfer')}
            </button>
          ))}
        </div>

        {type !== 'transfer' ? (
          <label className="app-field">
            <span>{t('transaction.create.name')}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('transaction.create.namePlaceholder')} autoFocus />
          </label>
        ) : null}

        <label className="app-field">
          <span>{t('transaction.create.amount')}</span>
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="350" />
        </label>

        {type !== 'transfer' ? (
          <label className="app-field">
            <span>{t('transaction.create.description')}</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('transaction.create.descriptionPlaceholder')} />
          </label>
        ) : null}

        <label className="app-field">
          <span>{t('transaction.create.account')}</span>
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">{t('transaction.create.selectAccount')}</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
          </select>
        </label>

        {type === 'transfer' ? (
          <label className="app-field">
            <span>{t('transaction.create.toAccount')}</span>
            <select value={toAccountId ?? ''} onChange={(event) => setToAccountId(event.target.value || null)}>
              <option value="">{t('transaction.create.selectAccount')}</option>
              {accounts.filter((account) => account.id !== accountId).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}
            </select>
          </label>
        ) : (
          <TransactionTaxonomyPicker
            type={type}
            title={title}
            description={description}
            categoryId={categoryId}
            onCategoryIdChange={setCategoryId}
          />
        )}

        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}

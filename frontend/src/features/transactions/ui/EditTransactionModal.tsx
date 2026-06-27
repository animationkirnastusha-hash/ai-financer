import { useEffect, useState } from 'react';
import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';

type Props = {
  open: boolean;
  transaction: TransactionDto | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: { amount: number; description?: string | null }) => Promise<void> | void;
};

export function EditTransactionModal({ open, transaction, isSaving = false, onClose, onSave }: Props) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transaction || !open) return;
    setAmount(String(transaction.amount));
    setDescription(transaction.description ?? transaction.category?.name ?? '');
    setError(null);
  }, [open, transaction]);

  const handleSave = async () => {
    const parsedAmount = Number(amount.replace(',', '.').trim());

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Введите сумму больше нуля');
      return;
    }

    await onSave({
      amount: Math.round(parsedAmount),
      description: description.trim() || null,
    });
  };

  return (
    <Drawer open={open} onClose={onClose} title="Изменить операцию" className="max-h-[86dvh] overflow-y-auto">
      <div className="space-y-3">
        <label className="block">
          <span className="mb-2 block text-xs text-white/45">Сумма</span>
          <input
            className="h-12 w-full rounded-2xl border border-white/10 bg-black/24 px-4 text-base text-white outline-none focus:border-emerald-300/35"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="300"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs text-white/45">Описание</span>
          <TextField
            className="transaction-edit-modal__description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Кофе"
          />
        </label>

        {error ? <div className="rounded-2xl bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            Сохранить
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

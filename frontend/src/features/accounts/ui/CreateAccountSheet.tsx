import { useMemo, useState } from 'react';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import type { AccountType } from '@/features/accounts/model/accountFlow.types';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (payload: {
    name: string;
    type: AccountType;
    currency: 'RUB' | 'USD' | 'EUR';
    initialBalance: number;
  }) => void | Promise<void>;
};

const typeOptions: Array<{ value: AccountType; label: string }> = [
  { value: 'card', label: 'Карта' },
  { value: 'cash', label: 'Наличные' },
  { value: 'savings', label: 'Накопительный' },
  { value: 'investment', label: 'Инвестиционный' },
];

const currencyOptions: Array<'RUB' | 'USD' | 'EUR'> = ['RUB', 'USD', 'EUR'];

export function CreateAccountSheet({ open, onClose, onSubmit }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = useAccountFlowStore((state) => state.draft);
  const updateDraft = useAccountFlowStore((state) => state.updateDraft);
  const resetDraft = useAccountFlowStore((state) => state.resetDraft);

  const parsedBalance = useMemo(() => {
    const normalized = draft.initialBalance.replace(',', '.').trim();
    if (!normalized) return 0;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : NaN;
  }, [draft.initialBalance]);

  const isValid = draft.name.trim().length > 0 && Number.isFinite(parsedBalance) && parsedBalance >= 0;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) {
      setError('Укажи название и стартовый баланс.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit?.({
        name: draft.name.trim(),
        type: draft.type,
        currency: draft.currency,
        initialBalance: parsedBalance,
      });

      resetDraft();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetDraft();
    setError(null);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="Новый счёт"
      subtitle="Минимальная форма. Можно также сказать: “создай счёт отпуск”."
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>{isSubmitting ? 'Создаю...' : 'Создать'}</Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <label className="app-field">
          <span>Название</span>
          <input value={draft.name} disabled={isSubmitting} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="Например, Накопительный" />
        </label>

        <div>
          <div className="mb-2 text-xs text-white/42">Тип</div>
          <div className="grid grid-cols-2 gap-2">
            {typeOptions.map((option) => (
              <button key={option.value} type="button" disabled={isSubmitting} onClick={() => updateDraft({ type: option.value })} className={draft.type === option.value ? 'app-choice app-choice--active' : 'app-choice'}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs text-white/42">Валюта</div>
          <div className="grid grid-cols-3 gap-2">
            {currencyOptions.map((currency) => (
              <button key={currency} type="button" disabled={isSubmitting} onClick={() => updateDraft({ currency })} className={draft.currency === currency ? 'app-choice app-choice--active' : 'app-choice'}>
                {currency}
              </button>
            ))}
          </div>
        </div>

        <label className="app-field">
          <span>Стартовый баланс</span>
          <input inputMode="decimal" value={draft.initialBalance} disabled={isSubmitting} onChange={(event) => updateDraft({ initialBalance: event.target.value })} placeholder="0" />
        </label>

        {error ? <div className="app-error-box">{error}</div> : null}
      </div>
    </Drawer>
  );
}

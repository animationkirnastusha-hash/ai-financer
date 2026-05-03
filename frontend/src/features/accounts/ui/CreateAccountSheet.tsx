import { useMemo, useState } from 'react';
import { useAccountFlowStore } from '@/features/accounts/model/accountFlow.store';
import type { AccountType } from '@/features/accounts/model/accountFlow.types';

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

  const draft = useAccountFlowStore((state) => state.draft);
  const updateDraft = useAccountFlowStore((state) => state.updateDraft);
  const resetDraft = useAccountFlowStore((state) => state.resetDraft);

  const parsedBalance = useMemo(() => {
    const normalized = draft.initialBalance.replace(',', '.').trim();
    if (!normalized) return 0;
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : NaN;
  }, [draft.initialBalance]);

  const isValid =
    draft.name.trim().length > 0 &&
    Number.isFinite(parsedBalance) &&
    parsedBalance >= 0;

  if (!open) return null;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end bg-black/60 backdrop-blur-sm">
      <div className="flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-white/10 bg-[#0b1016] text-white shadow-2xl">
        <div className="shrink-0 px-4 pb-3 pt-4">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                Create account
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                Создать счёт
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
            <div className="text-sm leading-6 text-white/60">
              Создай счёт один раз — кнопка блокируется во время сохранения, чтобы не появлялись дубли.
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-white/75">
                Название счёта
              </label>
              <input
                value={draft.name}
                disabled={isSubmitting}
                onChange={(event) => updateDraft({ name: event.target.value })}
                placeholder="Например, Накопительный"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 disabled:opacity-50"
              />
            </div>

            <div>
              <div className="mb-2 block text-sm text-white/75">Тип счёта</div>
              <div className="grid grid-cols-2 gap-2">
                {typeOptions.map((option) => {
                  const active = draft.type === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => updateDraft({ type: option.value })}
                      className={`rounded-2xl border px-4 py-3 text-sm transition disabled:opacity-50 ${
                        active
                          ? 'border-emerald-400/25 bg-emerald-400/10 text-white'
                          : 'border-white/10 bg-black/20 text-white/70'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 block text-sm text-white/75">Валюта</div>
              <div className="flex gap-2">
                {currencyOptions.map((currency) => {
                  const active = draft.currency === currency;

                  return (
                    <button
                      key={currency}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => updateDraft({ currency })}
                      className={`rounded-2xl border px-4 py-3 text-sm transition disabled:opacity-50 ${
                        active
                          ? 'border-emerald-400/25 bg-emerald-400/10 text-white'
                          : 'border-white/10 bg-black/20 text-white/70'
                      }`}
                    >
                      {currency}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/75">
                Стартовый баланс
              </label>
              <input
                inputMode="decimal"
                value={draft.initialBalance}
                disabled={isSubmitting}
                onChange={(event) =>
                  updateDraft({
                    initialBalance: event.target.value.replace(/[^\d.,]/g, ''),
                  })
                }
                placeholder="0"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/8 px-4 pb-6 pt-4">
          <div className="flex gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClose}
              className="flex-1 rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:opacity-40"
            >
              Отмена
            </button>

            <button
              type="button"
              disabled={!isValid || isSubmitting}
              onClick={handleSubmit}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm text-white transition ${
                isValid && !isSubmitting
                  ? 'border border-emerald-400/20 bg-emerald-400/15 hover:bg-emerald-400/20'
                  : 'cursor-not-allowed border border-white/10 bg-white/6 text-white/35'
              }`}
            >
              {isSubmitting ? 'Создаю...' : 'Создать счёт'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
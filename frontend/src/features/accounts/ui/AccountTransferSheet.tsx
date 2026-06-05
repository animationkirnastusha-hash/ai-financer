import { useEffect, useMemo, useState } from 'react';

import type { AccountDto } from '@/features/accounts/api/accounts.api';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  open: boolean;
  fromAccount: AccountDto | null;
  accounts: AccountDto[];
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string | null;
  }) => Promise<void> | void;
};

export function AccountTransferSheet({
  open,
  fromAccount,
  accounts,
  isSaving = false,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useI18n();

  useEffect(() => {
    document.body.classList.toggle('ai-modal-open', open);
    return () => document.body.classList.remove('ai-modal-open');
  }, [open]);

  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const availableAccounts = useMemo(() => {
    if (!fromAccount) return [];
    return accounts.filter((account) => account.id !== fromAccount.id);
  }, [accounts, fromAccount]);

  if (!open || !fromAccount) return null;

  const selectedToAccount = availableAccounts.find((account) => account.id === toAccountId) ?? null;
  const parsedAmount = Number(amount.replace(',', '.'));
  const canSubmit = Boolean(selectedToAccount && Number.isFinite(parsedAmount) && parsedAmount > 0 && !isSaving);

  const submit = async () => {
    setLocalError(null);

    if (!selectedToAccount) {
      setLocalError(t('accounts.transfer.chooseDestination'));
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setLocalError(t('accounts.transfer.amountError'));
      return;
    }

    try {
      await onSubmit({
        fromAccountId: fromAccount.id,
        toAccountId: selectedToAccount.id,
        amount: Math.round(parsedAmount),
        description: description.trim() || null,
      });
      setAmount('');
      setDescription('');
      setToAccountId('');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : t('accounts.transfer.failed'));
    }
  };

  return (
    <div data-no-swipe="true" data-ai-core-modal="true" className="fixed inset-0 z-[120] flex items-end bg-black/70 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />

        <div className="mx-auto max-w-[560px] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">{t('accounts.transfer.eyebrow')}</div>
              <h2 className="mt-1 text-2xl font-semibold">{t('accounts.transfer.title')}</h2>
              <div className="mt-2 text-sm text-white/45">
                {t('common.from')}: {fromAccount.name} · {formatMoney(Number(fromAccount.balance) || 0, fromAccount.currency)}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm"
            >
              {t('common.close')}
            </button>
          </div>

          {fromAccount.lockTransfers ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100/80">
              {t('accounts.transfer.locked')}
            </div>
          ) : null}

          <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">{t('common.to')}</div>
            <div className="mt-3 grid gap-2">
              {availableAccounts.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-sm text-white/55">
                  {t('accounts.transfer.noDestination')}
                </div>
              ) : (
                availableAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setToAccountId(account.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${toAccountId === account.id ? 'border-emerald-300/35 bg-emerald-300/12' : 'border-white/8 bg-black/20'}`}
                  >
                    <div className="text-sm font-medium text-white">{account.name}</div>
                    <div className="mt-1 text-xs text-white/45">{formatMoney(Number(account.balance) || 0, account.currency)}</div>
                  </button>
                ))
              )}
            </div>
          </section>

          <label className="block rounded-[22px] border border-white/8 bg-black/20 px-4 py-3">
            <div className="mb-2 text-xs text-white/42">{t('common.amount')}</div>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={t('accounts.transfer.amountPlaceholder')}
              className="w-full bg-transparent text-base outline-none"
            />
          </label>

          <label className="block rounded-[22px] border border-white/8 bg-black/20 px-4 py-3">
            <div className="mb-2 text-xs text-white/42">{t('common.comment')}</div>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('accounts.transfer.commentPlaceholder')}
              className="w-full bg-transparent text-base outline-none"
            />
          </label>

          <div className="rounded-2xl border border-sky-300/15 bg-sky-300/10 p-3 text-xs leading-5 text-sky-100/75">
            {t('accounts.transfer.baseCaption')}
          </div>

          {localError ? <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100">{localError}</div> : null}

          <button
            type="button"
            disabled={!canSubmit || Boolean(fromAccount.lockTransfers)}
            onClick={submit}
            className="w-full rounded-[24px] bg-emerald-400 px-5 py-4 text-base font-semibold text-black transition active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? t('accounts.transfer.saving') : t('accounts.transfer.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

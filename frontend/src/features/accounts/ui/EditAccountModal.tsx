import { useEffect, useState } from 'react';

type AccountLike = {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  balance?: number;
  icon?: string | null;
  color?: string | null;
  showInTotalBalance?: boolean;
  aiCanRename?: boolean;
  aiCanSpend?: boolean;
  aiCanTransferFrom?: boolean;
  aiCanChangeBalanceVisibility?: boolean;
};

type Props = {
  account: AccountLike | null;
  open?: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (id: string, data: Partial<AccountLike>) => Promise<void> | void;
};

export const EditAccountModal = ({ account, open = true, isSaving, onClose, onSave }: Props) => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('0');
  const [showInTotalBalance, setShowInTotalBalance] = useState(true);
  const [aiCanRename, setAiCanRename] = useState(true);
  const [aiCanSpend, setAiCanSpend] = useState(true);
  const [aiCanTransferFrom, setAiCanTransferFrom] = useState(true);
  const [aiCanChangeBalanceVisibility, setAiCanChangeBalanceVisibility] = useState(true);

  useEffect(() => {
    if (!account) return;

    setName(account.name ?? '');
    setBalance(String(account.balance ?? 0));
    setShowInTotalBalance(account.showInTotalBalance ?? true);
    setAiCanRename(account.aiCanRename ?? true);
    setAiCanSpend(account.aiCanSpend ?? true);
    setAiCanTransferFrom(account.aiCanTransferFrom ?? true);
    setAiCanChangeBalanceVisibility(account.aiCanChangeBalanceVisibility ?? true);
  }, [account]);

  if (!open || !account) return null;

  const handleSave = async () => {
    await onSave(account.id, {
      name: name.trim(),
      balance: Number(balance) || 0,
      showInTotalBalance,
      aiCanRename,
      aiCanSpend,
      aiCanTransferFrom,
      aiCanChangeBalanceVisibility,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 pb-4 backdrop-blur-sm">
      <div className="w-full rounded-[28px] border border-white/10 bg-[#101820] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/40">Счёт</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Редактирование</h2>
          </div>
          <button className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/70" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-2 block text-sm text-white/60">Название</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-2 block text-sm text-white/60">Баланс</span>
          <input
            value={balance}
            inputMode="decimal"
            onChange={(event) => setBalance(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"
          />
        </label>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 text-sm font-medium text-white">Защита от AI-действий</div>
          {[
            ['AI может переименовывать счёт', aiCanRename, setAiCanRename],
            ['AI может создавать траты с этого счёта', aiCanSpend, setAiCanSpend],
            ['AI может переводить с этого счёта', aiCanTransferFrom, setAiCanTransferFrom],
            ['AI может менять видимость в балансе', aiCanChangeBalanceVisibility, setAiCanChangeBalanceVisibility],
            ['Показывать в общем балансе', showInTotalBalance, setShowInTotalBalance],
          ].map(([label, checked, setter]) => (
            <label key={String(label)} className="mb-3 flex items-center justify-between gap-3 text-sm text-white/70 last:mb-0">
              <span>{String(label)}</span>
              <input
                type="checkbox"
                checked={Boolean(checked)}
                onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
              />
            </label>
          ))}
        </div>

        <button
          disabled={isSaving}
          onClick={handleSave}
          className="w-full rounded-2xl bg-emerald-400 px-5 py-4 text-base font-semibold text-black disabled:opacity-50"
        >
          {isSaving ? 'Сохраняю...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
};

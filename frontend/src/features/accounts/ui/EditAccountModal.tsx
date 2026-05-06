import { useEffect, useState, type ReactNode } from 'react';
import type { AccountDto, UpdateAccountPayload } from '@/features/accounts/api/accounts.api';

const ACCOUNT_TYPES = ['card', 'cash', 'savings', 'investment'];
const CURRENCIES = ['RUB', 'USD', 'EUR'];

type Props = {
  account: AccountDto | null;
  open: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (accountId: string, payload: UpdateAccountPayload) => Promise<void> | void;
};

export function EditAccountModal({ account, open, isSaving = false, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('card');
  const [currency, setCurrency] = useState('RUB');
  const [balance, setBalance] = useState('0');
  const [showInTotalBalance, setShowInTotalBalance] = useState(true);
  const [lockRename, setLockRename] = useState(false);
  const [lockSpending, setLockSpending] = useState(false);
  const [lockTransfers, setLockTransfers] = useState(false);
  const [lockBalance, setLockBalance] = useState(false);
  const [lockVisibility, setLockVisibility] = useState(false);

  useEffect(() => {
    if (!account) return;
    setName(account.name ?? '');
    setType(account.type ?? 'card');
    setCurrency(account.currency ?? 'RUB');
    setBalance(String(account.balance ?? 0));
    setShowInTotalBalance(Boolean(account.showInTotalBalance));
    setLockRename(Boolean(account.lockRename));
    setLockSpending(Boolean(account.lockSpending));
    setLockTransfers(Boolean(account.lockTransfers));
    setLockBalance(Boolean(account.lockBalance));
    setLockVisibility(Boolean(account.lockVisibility));
  }, [account]);

  if (!open || !account) return null;

  const handleSubmit = async () => {
    const parsedBalance = Number(balance);

    await onSave(account.id, {
      name,
      type,
      currency,
      balance: Number.isFinite(parsedBalance) ? Math.round(parsedBalance) : account.balance,
      showInTotalBalance,
      lockRename,
      lockSpending,
      lockTransfers,
      lockBalance,
      lockVisibility,
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/70 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[30px] border border-white/10 bg-[#0b1016] px-4 pb-6 pt-4 text-white shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />
        <div className="mx-auto max-w-[560px] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Edit account</div>
              <h2 className="mt-1 text-2xl font-semibold">{account.name}</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm">
              Закрыть
            </button>
          </div>

          <Field label="Название">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent text-base outline-none" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Тип">
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-transparent text-base outline-none">
                {ACCOUNT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
            <Field label="Валюта">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-transparent text-base outline-none">
                {CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Баланс">
            <input inputMode="numeric" value={balance} onChange={(e) => setBalance(e.target.value)} className="w-full bg-transparent text-base outline-none" />
          </Field>

          <section className="rounded-[26px] border border-white/8 bg-white/[0.035] p-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Защита счёта</div>
            <div className="mt-3 grid gap-3">
              <Toggle label="Показывать в общем балансе" checked={showInTotalBalance} onChange={setShowInTotalBalance} />
              <Toggle label="Запретить переименование" checked={lockRename} onChange={setLockRename} />
              <Toggle label="Запретить траты" checked={lockSpending} onChange={setLockSpending} />
              <Toggle label="Запретить переводы с этого счёта" checked={lockTransfers} onChange={setLockTransfers} />
              <Toggle label="Запретить ручное изменение баланса" checked={lockBalance} onChange={setLockBalance} />
              <Toggle label="Запретить скрытие из общего баланса" checked={lockVisibility} onChange={setLockVisibility} />
            </div>
          </section>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit}
            className="w-full rounded-[24px] bg-emerald-400 px-5 py-4 text-base font-semibold text-black transition active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block rounded-[22px] border border-white/8 bg-black/20 px-4 py-3">
      <div className="mb-2 text-xs text-white/42">{label}</div>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-left">
      <span className="text-sm text-white/75">{label}</span>
      <span className={`h-7 w-12 rounded-full p-1 transition ${checked ? 'bg-emerald-400' : 'bg-white/12'}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}

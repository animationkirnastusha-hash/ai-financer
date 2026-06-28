import { useEffect, useState, type ReactNode } from 'react';
import type { AccountDto, UpdateAccountPayload } from '@/features/accounts/api/accounts.api';
import { useI18n } from '@/shared/lib/i18n';
import { Drawer } from '@/shared/ui/Drawer';

const ACCOUNT_TYPES = ['card', 'cash', 'savings', 'investment'];
const ACCOUNT_TYPE_KEYS: Record<string, string> = {
  card: 'accounts.type.card',
  cash: 'accounts.type.cash',
  savings: 'accounts.type.savings',
  investment: 'accounts.type.investment',
};
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
  const { t } = useI18n();

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
    <Drawer open={open} onClose={onClose} className="app-account-edit-sheet" bodyClassName="app-account-edit-sheet__body" showFloatingClose={false}>
      <div className="app-account-edit-shell">
        <header className="app-account-edit-head">
          <div className="min-w-0">
            <div className="app-eyebrow">{t('accounts.edit.eyebrow')}</div>
            <h2>{account.name}</h2>
            <p>{t('accounts.edit.caption')}</p>
          </div>
          <button type="button" onClick={onClose} className="app-icon-button" aria-label={t('common.close')}>
            ×
          </button>
        </header>

        <Field label={t('common.name')}>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>

        <div className="app-account-edit-grid app-account-edit-grid--two">
          <Field label={t('common.type')}>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {ACCOUNT_TYPES.map((item) => (
                <option key={item} value={item}>{t(ACCOUNT_TYPE_KEYS[item])}</option>
              ))}
            </select>
          </Field>
          <Field label={t('common.currency')}>
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
        </div>

        <Field label={t('common.balance')}>
          <input inputMode="numeric" value={balance} onChange={(event) => setBalance(event.target.value)} />
        </Field>

        <section className="app-account-edit-protection">
          <div className="app-account-edit-protection__title">{t('accounts.edit.protection')}</div>
          <Toggle label={t('accounts.edit.showInTotal')} checked={showInTotalBalance} onChange={setShowInTotalBalance} />
          <Toggle label={t('accounts.edit.lockRename')} checked={lockRename} onChange={setLockRename} />
          <Toggle label={t('accounts.edit.lockSpending')} checked={lockSpending} onChange={setLockSpending} />
          <Toggle label={t('accounts.edit.lockTransfers')} checked={lockTransfers} onChange={setLockTransfers} />
          <Toggle label={t('accounts.edit.lockBalance')} checked={lockBalance} onChange={setLockBalance} />
          <Toggle label={t('accounts.edit.lockVisibility')} checked={lockVisibility} onChange={setLockVisibility} />
        </section>

        <button type="button" disabled={isSaving} onClick={handleSubmit} className="app-account-edit-save">
          {isSaving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="app-account-edit-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="app-account-edit-toggle">
      <span className="app-account-edit-toggle__label">{label}</span>
      <span className="app-account-edit-toggle__track" data-on={checked ? 'true' : 'false'}>
        <span className="app-account-edit-toggle__thumb" />
      </span>
    </button>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useAccountsStore } from '@/features/accounts/model/accounts.store';
import { financialCycleApi, type FinancialCycleDto } from '@/features/financial-cycle/api/financialCycle.api';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

function getInitialDay(settings: FinancialCycleDto | null) {
  return settings?.salaryDay ? String(settings.salaryDay) : '';
}

function getInitialAmount(settings: FinancialCycleDto | null) {
  return settings?.salaryAmount ? String(settings.salaryAmount) : '';
}

export function FinancialCycleCard() {
  const { t } = useI18n();
  const accounts = useAccountsStore((state) => state.items);
  const loadAccounts = useAccountsStore((state) => state.loadAccounts);
  const [settings, setSettings] = useState<FinancialCycleDto | null>(null);
  const [salaryDay, setSalaryDay] = useState('');
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryAccountId, setSalaryAccountId] = useState('');
  const [salaryPeriod, setSalaryPeriod] = useState('monthly');
  const [remindBeforeDays, setRemindBeforeDays] = useState('0');
  const [autoDistributeGoals, setAutoDistributeGoals] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        await loadAccounts(false);
        const next = await financialCycleApi.get();
        if (!isMounted) return;
        setSettings(next);
        setSalaryDay(getInitialDay(next));
        setSalaryAmount(getInitialAmount(next));
        setSalaryAccountId(next.salaryAccountId ?? '');
        setSalaryPeriod(next.salaryPeriod ?? 'monthly');
        setRemindBeforeDays(String(next.remindBeforeDays ?? 0));
        setAutoDistributeGoals(Boolean(next.autoDistributeGoals));
      } catch (loadError) {
        console.error(loadError);
        if (isMounted) setError(t('financialCycle.error.load'));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    return () => { isMounted = false; };
  }, [loadAccounts, t]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === salaryAccountId) ?? null,
    [accounts, salaryAccountId],
  );

  const summary = useMemo(() => {
    if (!settings?.salaryDay) return t('financialCycle.summary.empty');
    const amount = settings.salaryAmount > 0 ? formatMoney(settings.salaryAmount, settings.salaryCurrency) : t('financialCycle.summary.noAmount');
    const accountName = selectedAccount?.name ?? t('financialCycle.summary.noAccount');
    return t('financialCycle.summary.ready', { day: settings.salaryDay, amount, account: accountName });
  }, [settings, selectedAccount, t]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setStatus(null);

    try {
      const next = await financialCycleApi.update({
        salaryDay: salaryDay.trim() || null,
        salaryAmount: salaryAmount.trim() || 0,
        salaryAccountId: salaryAccountId || null,
        salaryPeriod,
        remindBeforeDays: remindBeforeDays.trim() || 0,
        autoCreateIncome: false,
        autoDistributeGoals,
      });
      setSettings(next);
      setStatus(t('financialCycle.saved'));
      setIsOpen(false);
    } catch (saveError) {
      console.error(saveError);
      setError(t('financialCycle.error.save'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="app-card app-financial-cycle-card">
      <div className="app-financial-cycle-card__head">
        <div className="min-w-0">
          <div className="app-eyebrow">{t('financialCycle.eyebrow')}</div>
          <h2>{t('financialCycle.title')}</h2>
          <p>{t('financialCycle.caption')}</p>
        </div>
        <button type="button" className="app-secondary-button" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? t('financialCycle.hide') : t('financialCycle.edit')}
        </button>
      </div>

      <div className="app-financial-cycle-summary">
        <strong>{isLoading ? t('financialCycle.loading') : summary}</strong>
        <span>{t('financialCycle.automationHint')}</span>
      </div>

      {isOpen ? (
        <div className="app-financial-cycle-form">
          <div className="app-financial-cycle-form__grid">
            <label className="app-field">
              <span>{t('financialCycle.salaryDay')}</span>
              <input inputMode="numeric" value={salaryDay} onChange={(event) => setSalaryDay(event.target.value)} placeholder="25" />
            </label>
            <label className="app-field">
              <span>{t('financialCycle.salaryAmount')}</span>
              <input inputMode="decimal" value={salaryAmount} onChange={(event) => setSalaryAmount(event.target.value)} placeholder="80000" />
            </label>
          </div>

          <div className="app-financial-cycle-form__grid">
            <label className="app-field">
              <span>{t('financialCycle.period')}</span>
              <select value={salaryPeriod} onChange={(event) => setSalaryPeriod(event.target.value)}>
                <option value="monthly">{t('financialCycle.period.monthly')}</option>
                <option value="biweekly">{t('financialCycle.period.biweekly')}</option>
                <option value="manual">{t('financialCycle.period.manual')}</option>
              </select>
            </label>
            <label className="app-field">
              <span>{t('financialCycle.remindBefore')}</span>
              <input inputMode="numeric" value={remindBeforeDays} onChange={(event) => setRemindBeforeDays(event.target.value)} placeholder="1" />
            </label>
          </div>

          <label className="app-field">
            <span>{t('financialCycle.account')}</span>
            <select value={salaryAccountId} onChange={(event) => setSalaryAccountId(event.target.value)}>
              <option value="">{t('financialCycle.account.empty')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>

          <label className="app-check-row app-financial-cycle-check">
            <input type="checkbox" checked={autoDistributeGoals} onChange={(event) => setAutoDistributeGoals(event.target.checked)} />
            <span>
              <strong>{t('financialCycle.distribute.title')}</strong>
              <small>{t('financialCycle.distribute.caption')}</small>
            </span>
          </label>

          <div className="app-financial-cycle-note">
            <strong>{t('financialCycle.safe.title')}</strong>
            <span>{t('financialCycle.safe.caption')}</span>
          </div>

          <button type="button" className="app-primary-button app-financial-cycle-save" onClick={save} disabled={isSaving || isLoading}>
            {isSaving ? t('financialCycle.saving') : t('financialCycle.save')}
          </button>
        </div>
      ) : null}

      {status ? <div className="app-success-box">{status}</div> : null}
      {error ? <div className="app-error-box">{error}</div> : null}
    </section>
  );
}

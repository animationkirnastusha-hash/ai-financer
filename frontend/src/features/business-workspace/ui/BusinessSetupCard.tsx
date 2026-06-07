import { useEffect, useMemo, useState } from 'react';
import type { BusinessWorkspaceAccountDto, BusinessWorkspaceDto, BusinessProfileType } from '@/features/business-workspace/api/businessWorkspace.api';
import { useBusinessWorkspaceStore } from '@/features/business-workspace/model/businessWorkspace.store';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  workspace: BusinessWorkspaceDto | null;
  accounts: BusinessWorkspaceAccountDto[];
};

const profileTypes: BusinessProfileType[] = ['self_employed', 'ip', 'small_business'];

function profileLabel(type: BusinessProfileType, t: (key: string) => string) {
  if (type === 'ip') return t('business.profile.ip.short');
  if (type === 'small_business') return t('business.profile.small.short');
  return t('business.profile.self.short');
}

export function BusinessSetupCard({ workspace, accounts }: Props) {
  const { t } = useI18n();
  const save = useBusinessWorkspaceStore((state) => state.save);
  const isSaving = useBusinessWorkspaceStore((state) => state.isSaving);
  const [profileType, setProfileType] = useState<BusinessProfileType>('self_employed');
  const [displayName, setDisplayName] = useState('');
  const [taxMode, setTaxMode] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [monthlyIncomePlan, setMonthlyIncomePlan] = useState('');
  const [monthlyExpensePlan, setMonthlyExpensePlan] = useState('');
  const [reminderDay, setReminderDay] = useState('');

  useEffect(() => {
    if (!workspace) return;
    setProfileType(workspace.profileType);
    setDisplayName(workspace.displayName ?? '');
    setTaxMode(workspace.taxMode ?? '');
    setIncomeAccountId(workspace.incomeAccountId ?? '');
    setExpenseAccountId(workspace.expenseAccountId ?? '');
    setMonthlyIncomePlan(workspace.monthlyIncomePlan ? String(workspace.monthlyIncomePlan) : '');
    setMonthlyExpensePlan(workspace.monthlyExpensePlan ? String(workspace.monthlyExpensePlan) : '');
    setReminderDay(workspace.reminderDay ? String(workspace.reminderDay) : '');
  }, [workspace]);

  const hasAccounts = accounts.length > 0;
  const profileButtons = useMemo(() => profileTypes.map((type) => ({ type, label: profileLabel(type, t) })), [t]);

  const handleSave = async () => {
    await save({
      profileType,
      displayName: displayName.trim() || null,
      taxMode: taxMode.trim() || null,
      incomeAccountId: incomeAccountId || null,
      expenseAccountId: expenseAccountId || null,
      monthlyIncomePlan: monthlyIncomePlan ? Number(monthlyIncomePlan) : 0,
      monthlyExpensePlan: monthlyExpensePlan ? Number(monthlyExpensePlan) : 0,
      reminderDay: reminderDay ? Number(reminderDay) : null,
    });
  };

  return (
    <section className="app-card business-setup-card">
      <div className="business-section-head">
        <div>
          <div className="app-eyebrow">{t('business.setup.eyebrow')}</div>
          <h2>{t('business.setup.title')}</h2>
        </div>
      </div>

      <div className="business-profile-toggle" role="group" aria-label={t('business.setup.profile')}>
        {profileButtons.map((item) => (
          <button key={item.type} type="button" className={profileType === item.type ? 'is-active' : undefined} onClick={() => setProfileType(item.type)}>{item.label}</button>
        ))}
      </div>

      <div className="business-form-grid">
        <label>
          <span>{t('business.setup.name')}</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t('business.setup.namePlaceholder')} />
        </label>
        <label>
          <span>{t('business.setup.taxMode')}</span>
          <input value={taxMode} onChange={(event) => setTaxMode(event.target.value)} placeholder={t('business.setup.taxPlaceholder')} />
        </label>
        <label>
          <span>{t('business.setup.incomeAccount')}</span>
          <select value={incomeAccountId} onChange={(event) => setIncomeAccountId(event.target.value)} disabled={!hasAccounts}>
            <option value="">{t('business.setup.noAccount')}</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label>
          <span>{t('business.setup.expenseAccount')}</span>
          <select value={expenseAccountId} onChange={(event) => setExpenseAccountId(event.target.value)} disabled={!hasAccounts}>
            <option value="">{t('business.setup.noAccount')}</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label>
          <span>{t('business.setup.incomePlan')}</span>
          <input inputMode="numeric" value={monthlyIncomePlan} onChange={(event) => setMonthlyIncomePlan(event.target.value)} placeholder="150000" />
        </label>
        <label>
          <span>{t('business.setup.expensePlan')}</span>
          <input inputMode="numeric" value={monthlyExpensePlan} onChange={(event) => setMonthlyExpensePlan(event.target.value)} placeholder="70000" />
        </label>
        <label>
          <span>{t('business.setup.reminderDay')}</span>
          <input inputMode="numeric" value={reminderDay} onChange={(event) => setReminderDay(event.target.value)} placeholder="25" />
        </label>
      </div>

      <button type="button" className="app-primary-button business-setup-submit" disabled={isSaving} onClick={handleSave}>
        {isSaving ? t('common.saving') : t('business.setup.save')}
      </button>
    </section>
  );
}

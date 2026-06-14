import { FormEvent, useEffect, useMemo, useState } from 'react';
import { fetchAccounts, type AccountDto } from '@/features/accounts/api/accounts.api';
import { fetchCategories, type CategoryDto } from '@/features/sections/api/sections.api';
import {
  createSpendingLimit,
  deleteSpendingLimit,
  fetchSpendingLimits,
  updateSpendingLimit,
  type SpendingLimitDto,
  type SpendingLimitPeriod,
  type SpendingLimitTargetType,
} from '@/features/spending-limits/api/spendingLimits.api';
import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';
import { FinaCommandBar } from '@/features/fina/ui/FinaCommandBar';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

type LimitFormState = {
  targetType: SpendingLimitTargetType;
  accountId: string;
  categoryId: string;
  amount: string;
  period: SpendingLimitPeriod;
  notifyAt: string;
};

const defaultForm: LimitFormState = {
  targetType: 'account',
  accountId: '',
  categoryId: '',
  amount: '',
  period: 'monthly',
  notifyAt: '80',
};

export default function SpendingLimitsPage() {
  const { t } = useI18n();
  const [limits, setLimits] = useState<SpendingLimitDto[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [form, setForm] = useState<LimitFormState>(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense' || category.type === 'both' || !category.type),
    [categories],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [nextLimits, nextAccounts, nextCategories] = await Promise.all([
          fetchSpendingLimits(),
          fetchAccounts(),
          fetchCategories(),
        ]);
        if (cancelled) return;
        setLimits(nextLimits);
        setAccounts(nextAccounts);
        setCategories(nextCategories);
        setForm((current) => ({
          ...current,
          accountId: current.accountId || nextAccounts[0]?.id || '',
          categoryId: current.categoryId || nextCategories.find((category) => category.type === 'expense')?.id || '',
        }));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить лимиты');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeLimits = limits.filter((limit) => limit.isActive).length;

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...defaultForm,
      accountId: accounts[0]?.id || '',
      categoryId: expenseCategories[0]?.id || '',
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(',', '.'));
    const notifyAt = Number(form.notifyAt || 80);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t('limits.error.amount'));
      return;
    }

    const payload = {
      targetType: form.targetType,
      accountId: form.targetType === 'account' ? form.accountId : null,
      categoryId: form.targetType === 'category' ? form.categoryId : null,
      amount,
      period: form.period,
      notifyAt,
      isActive: true,
    };

    setIsSaving(true);
    setError(null);
    try {
      const saved = editingId
        ? await updateSpendingLimit(editingId, payload)
        : await createSpendingLimit(payload);
      setLimits((current) => {
        const withoutSaved = current.filter((limit) => limit.id !== saved.id);
        return [saved, ...withoutSaved];
      });
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('limits.error.save'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (limit: SpendingLimitDto) => {
    setEditingId(limit.id);
    setForm({
      targetType: limit.targetType,
      accountId: limit.accountId || accounts[0]?.id || '',
      categoryId: limit.categoryId || expenseCategories[0]?.id || '',
      amount: String(limit.amount),
      period: limit.period,
      notifyAt: String(limit.notifyAt || 80),
    });
  };

  const handleToggle = async (limit: SpendingLimitDto) => {
    const saved = await updateSpendingLimit(limit.id, { isActive: !limit.isActive });
    setLimits((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  };

  const handleDelete = async (limit: SpendingLimitDto) => {
    const ok = window.confirm(t('limits.delete.confirm'));
    if (!ok) return;
    await deleteSpendingLimit(limit.id);
    setLimits((current) => current.filter((item) => item.id !== limit.id));
  };

  return (
    <div className="app-page spending-limits-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('screen.limits')} left="back" right={['home', 'settings']} />

        <header className="limits-hero app-card app-card--hero">
          <div className="app-eyebrow">{t('limits.hero.eyebrow')}</div>
          <h1>{t('limits.hero.title')}</h1>
          <p>{t('limits.hero.caption')}</p>
          <div className="limits-hero__stats">
            <article>
              <strong>{t('limits.hero.active', { count: activeLimits })}</strong>
              <span>{t('limits.hero.mode')}</span>
            </article>
          </div>
        </header>

        <FinaCommandBar
          titleKey="limits.command.title"
          captionKey="limits.command.caption"
          placeholderKey="limits.command.placeholder"
          suggestions={[
            { key: 'limits.command.create', command: 'установи лимит на продукты 20000 рублей' },
            { key: 'limits.command.left', command: 'сколько осталось по кафе' },
            { key: 'limits.command.raise', command: 'подними лимит на транспорт на 10 процентов' },
          ]}
        />

        <section className="limits-guide-grid">
          <article className="app-card limits-guide-card">
            <b>{t('limits.guide.account.title')}</b>
            <span>{t('limits.guide.account.caption')}</span>
          </article>
          <article className="app-card limits-guide-card">
            <b>{t('limits.guide.category.title')}</b>
            <span>{t('limits.guide.category.caption')}</span>
          </article>
          <article className="app-card limits-guide-card">
            <b>{t('limits.guide.total.title')}</b>
            <span>{t('limits.guide.total.caption')}</span>
          </article>
        </section>

        <section className="app-card limits-form-card">
          <div className="limits-section-head">
            <div>
              <div className="app-eyebrow">{editingId ? t('limits.form.editEyebrow') : t('limits.form.eyebrow')}</div>
              <h2>{editingId ? t('limits.form.editTitle') : t('limits.form.title')}</h2>
            </div>
            {editingId ? <button type="button" className="app-secondary-button app-secondary-button--compact" onClick={resetForm}>{t('common.cancel')}</button> : null}
          </div>

          <form className="limits-form" onSubmit={handleSubmit}>
            <label>
              <span>{t('limits.form.target')}</span>
              <select value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value as SpendingLimitTargetType })}>
                <option value="account">{t('limits.target.account')}</option>
                <option value="category">{t('limits.target.category')}</option>
                <option value="total">{t('limits.target.total')}</option>
              </select>
            </label>

            {form.targetType === 'account' ? (
              <label>
                <span>{t('limits.form.account')}</span>
                <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
            ) : null}

            {form.targetType === 'category' ? (
              <label>
                <span>{t('limits.form.category')}</span>
                <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                  {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
            ) : null}

            <div className="limits-form__row">
              <label>
                <span>{t('limits.form.amount')}</span>
                <input inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="50000" />
              </label>
              <label>
                <span>{t('limits.form.period')}</span>
                <select value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value as SpendingLimitPeriod })}>
                  <option value="daily">{t('limits.period.daily')}</option>
                  <option value="weekly">{t('limits.period.weekly')}</option>
                  <option value="monthly">{t('limits.period.monthly')}</option>
                </select>
              </label>
            </div>

            <label>
              <span>{t('limits.form.notifyAt')}</span>
              <select value={form.notifyAt} onChange={(event) => setForm({ ...form, notifyAt: event.target.value })}>
                <option value="50">50%</option>
                <option value="80">80%</option>
                <option value="100">100%</option>
              </select>
            </label>

            {error ? <div className="limits-error">{error}</div> : null}

            <button type="submit" className="app-primary-button" disabled={isSaving || (form.targetType === 'account' && !form.accountId) || (form.targetType === 'category' && !form.categoryId)}>
              {isSaving ? t('common.saving') : editingId ? t('limits.form.save') : t('limits.form.create')}
            </button>
          </form>
        </section>

        <section className="limits-list-section">
          <div className="limits-section-head">
            <div>
              <div className="app-eyebrow">{t('limits.list.eyebrow')}</div>
              <h2>{t('limits.list.title')}</h2>
            </div>
          </div>

          {isLoading ? <div className="app-card limits-empty">{t('common.loading')}</div> : null}
          {!isLoading && limits.length === 0 ? <div className="app-card limits-empty">{t('limits.empty')}</div> : null}

          <div className="limits-list">
            {limits.map((limit) => (
              <LimitCard
                key={limit.id}
                limit={limit}
                onEdit={() => handleEdit(limit)}
                onToggle={() => void handleToggle(limit)}
                onDelete={() => void handleDelete(limit)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function LimitCard({ limit, onEdit, onToggle, onDelete }: { limit: SpendingLimitDto; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const { t } = useI18n();
  const usage = limit.usage;
  const percent = Math.min(Math.max(Number(usage?.percent ?? 0), 0), 160);
  const title = limit.targetType === 'account'
    ? limit.account?.name || t('limits.target.account')
    : limit.targetType === 'category'
      ? limit.category?.name || t('limits.target.category')
      : t('limits.target.total');

  return (
    <article className="limits-card app-card" data-inactive={!limit.isActive}>
      <div className="limits-card__top">
        <div>
          <div className="limits-card__type">{targetLabel(limit.targetType, t)} · {periodLabel(limit.period, t)}</div>
          <h3>{title}</h3>
        </div>
        <span className="limits-card__badge">{limit.isActive ? t('common.active') : t('common.off')}</span>
      </div>

      <div className="limits-card__amounts">
        <span>{formatMoney(Number(usage?.spent ?? 0))}</span>
        <small>{t('limits.card.from')} {formatMoney(Number(limit.amount))}</small>
      </div>
      <div className="limits-progress" aria-hidden="true">
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <div className="limits-card__footer">
        <small>{t('limits.card.notify', { percent: limit.notifyAt })}</small>
        <div>
          <button type="button" onClick={onToggle}>{limit.isActive ? t('common.pause') : t('common.enable')}</button>
          <button type="button" onClick={onEdit}>{t('common.edit')}</button>
          <button type="button" onClick={onDelete}>{t('common.delete')}</button>
        </div>
      </div>
    </article>
  );
}

function targetLabel(targetType: SpendingLimitTargetType, t: (key: any, params?: Record<string, string | number>) => string) {
  if (targetType === 'account') return t('limits.target.account');
  if (targetType === 'category') return t('limits.target.category');
  return t('limits.target.total');
}

function periodLabel(period: SpendingLimitPeriod, t: (key: any) => string) {
  if (period === 'daily') return t('limits.period.daily');
  if (period === 'weekly') return t('limits.period.weekly');
  return t('limits.period.monthly');
}

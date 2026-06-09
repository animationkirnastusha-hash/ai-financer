import { useEffect, useMemo, useState } from 'react';
import { aiSettingsApi } from '@/features/ai-settings/api/aiSettings.api';
import type {
  AISettingsDto,
  AISettingsPreset,
  AISettingsSnapshot,
} from '@/features/ai-settings/model/aiSettings.types';

type Translate = (key: string, params?: Record<string, string | number>) => string;

type Props = {
  t: Translate;
  textInputEnabled: boolean;
  aiInsightsEnabled: boolean;
  onTextInputChange: (value: boolean) => void;
  onAIInsightsChange: (value: boolean) => void;
};

type QuickMode = 'careful' | 'balanced' | 'fast';

const FAST_EXPENSE_LIMIT = 1_000_000;
const FAST_INCOME_LIMIT = 5_000_000;

function getQuickMode(settings: AISettingsDto | null | undefined): QuickMode {
  if (!settings) return 'balanced';
  if (
    settings.requireConfirmForAccountActions === false
    && Number(settings.autoConfirmExpenseLimit ?? 0) >= FAST_EXPENSE_LIMIT
    && Number(settings.autoConfirmIncomeLimit ?? 0) >= FAST_INCOME_LIMIT
  ) {
    return 'fast';
  }
  if (
    Number(settings.autoConfirmExpenseLimit ?? 0) <= 0
    && Number(settings.autoConfirmIncomeLimit ?? 0) <= 0
    && settings.requireConfirmForAccountActions !== false
  ) {
    return 'careful';
  }
  return 'balanced';
}

function parseLimit(value: string, fallback: number) {
  const number = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

export function AISettingsPanel({
  t,
  textInputEnabled,
  aiInsightsEnabled,
  onTextInputChange,
  onAIInsightsChange,
}: Props) {
  const [snapshot, setSnapshot] = useState<AISettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expenseLimit, setExpenseLimit] = useState('500');
  const [incomeLimit, setIncomeLimit] = useState('100000');

  const settings = snapshot?.settings ?? null;
  const quickMode = useMemo(() => getQuickMode(settings), [settings]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    aiSettingsApi.get(controller.signal)
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot);
        setExpenseLimit(String(nextSnapshot.settings?.autoConfirmExpenseLimit ?? 500));
        setIncomeLimit(String(nextSnapshot.settings?.autoConfirmIncomeLimit ?? 100000));
      })
      .catch((nextError) => {
        if (!controller.signal.aborted) {
          setError(nextError instanceof Error ? nextError.message : t('settings.ai.error.load'));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [t]);

  const applyPreset = async (preset: AISettingsPreset) => {
    setSaving(true);
    setError(null);

    try {
      const nextSnapshot = await aiSettingsApi.applyPreset(preset);
      setSnapshot(nextSnapshot);
      setExpenseLimit(String(nextSnapshot.settings?.autoConfirmExpenseLimit ?? 500));
      setIncomeLimit(String(nextSnapshot.settings?.autoConfirmIncomeLimit ?? 100000));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('settings.ai.error.save'));
    } finally {
      setSaving(false);
    }
  };

  const saveLimits = async () => {
    const currentExpenseLimit = settings?.autoConfirmExpenseLimit ?? 500;
    const currentIncomeLimit = settings?.autoConfirmIncomeLimit ?? 100000;

    setSaving(true);
    setError(null);

    try {
      const nextSnapshot = await aiSettingsApi.update({
        preset: 'balanced',
        autoConfirmExpenseLimit: parseLimit(expenseLimit, currentExpenseLimit),
        autoConfirmIncomeLimit: parseLimit(incomeLimit, currentIncomeLimit),
      });
      setSnapshot(nextSnapshot);
      setExpenseLimit(String(nextSnapshot.settings?.autoConfirmExpenseLimit ?? currentExpenseLimit));
      setIncomeLimit(String(nextSnapshot.settings?.autoConfirmIncomeLimit ?? currentIncomeLimit));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('settings.ai.error.save'));
    } finally {
      setSaving(false);
    }
  };

  const saveDefaultAccount = async (field: 'defaultExpenseAccountId' | 'defaultIncomeAccountId', value: string) => {
    setSaving(true);
    setError(null);

    try {
      const nextSnapshot = await aiSettingsApi.update({ [field]: value || null });
      setSnapshot(nextSnapshot);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('settings.ai.error.save'));
    } finally {
      setSaving(false);
    }
  };

  const accounts = snapshot?.accounts ?? [];

  return (
    <div className="ai-settings-panel">
      {loading ? <div className="app-status-box">{t('settings.ai.loading')}</div> : null}
      {error ? <div className="app-status-box app-status-box--error">{error}</div> : null}

      <section className="ai-settings-group">
        <div className="ai-settings-group__head">
          <div>
            <h3>{t('settings.ai.confirm.title')}</h3>
            <p>{t('settings.ai.confirm.caption')}</p>
          </div>
          <span data-mode={quickMode}>{t(`settings.ai.confirm.mode.${quickMode}`)}</span>
        </div>

        <div className="ai-confirm-mode-grid">
          <button type="button" data-active={quickMode === 'careful'} disabled={saving} onClick={() => void applyPreset('strict')}>
            <b>{t('settings.ai.mode.careful.title')}</b>
            <small>{t('settings.ai.mode.careful.caption')}</small>
          </button>
          <button type="button" data-active={quickMode === 'balanced'} disabled={saving} onClick={() => void applyPreset('balanced')}>
            <b>{t('settings.ai.mode.balanced.title')}</b>
            <small>{t('settings.ai.mode.balanced.caption')}</small>
          </button>
          <button type="button" data-active={quickMode === 'fast'} disabled={saving} onClick={() => void applyPreset('fast')}>
            <b>{t('settings.ai.mode.fast.title')}</b>
            <small>{t('settings.ai.mode.fast.caption')}</small>
          </button>
        </div>
      </section>

      <section className="ai-settings-group">
        <div className="ai-settings-group__head">
          <div>
            <h3>{t('settings.ai.limits.title')}</h3>
            <p>{t('settings.ai.limits.caption')}</p>
          </div>
        </div>

        <div className="ai-settings-fields">
          <label>
            <span>{t('settings.ai.limits.expense')}</span>
            <input inputMode="numeric" value={expenseLimit} onChange={(event) => setExpenseLimit(event.target.value)} onBlur={() => void saveLimits()} />
          </label>
          <label>
            <span>{t('settings.ai.limits.income')}</span>
            <input inputMode="numeric" value={incomeLimit} onChange={(event) => setIncomeLimit(event.target.value)} onBlur={() => void saveLimits()} />
          </label>
        </div>
      </section>

      <section className="ai-settings-group">
        <div className="ai-settings-group__head">
          <div>
            <h3>{t('settings.ai.accounts.title')}</h3>
            <p>{t('settings.ai.accounts.caption')}</p>
          </div>
        </div>

        <div className="ai-settings-fields">
          <label>
            <span>{t('settings.ai.accounts.expense')}</span>
            <select
              value={settings?.defaultExpenseAccountId ?? ''}
              disabled={saving || accounts.length === 0}
              onChange={(event) => void saveDefaultAccount('defaultExpenseAccountId', event.target.value)}
            >
              <option value="">{t('settings.ai.accounts.auto')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t('settings.ai.accounts.income')}</span>
            <select
              value={settings?.defaultIncomeAccountId ?? ''}
              disabled={saving || accounts.length === 0}
              onChange={(event) => void saveDefaultAccount('defaultIncomeAccountId', event.target.value)}
            >
              <option value="">{t('settings.ai.accounts.auto')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="ai-settings-group">
        <div className="ai-settings-group__head">
          <div>
            <h3>{t('settings.ai.interface.title')}</h3>
            <p>{t('settings.ai.interface.caption')}</p>
          </div>
        </div>

        <label className="app-toggle-row app-toggle-row--compact">
          <span><span>{t('settings.ai.interface.text.title')}</span><small>{t('settings.ai.interface.text.caption')}</small></span>
          <input type="checkbox" checked={textInputEnabled} onChange={(event) => onTextInputChange(event.target.checked)} />
        </label>
        <label className="app-toggle-row app-toggle-row--compact">
          <span><span>{t('settings.ai.interface.insights.title')}</span><small>{t('settings.ai.interface.insights.caption')}</small></span>
          <input type="checkbox" checked={aiInsightsEnabled} onChange={(event) => onAIInsightsChange(event.target.checked)} />
        </label>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { reportsApi, type ReportFormat, type ReportMode, type ReportPreviewDto, type ReportType } from '@/features/reports/api/reports.api';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { hasRealBusinessAccess, hasRealPremiumAccess } from '@/features/subscription/lib/entitlements';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { Drawer } from '@/shared/ui/Drawer';
import { formatMoney } from '@/shared/lib/money';

type PeriodPreset = 'month' | 'quarter' | 'year' | 'all' | 'custom';

type Props = {
  open: boolean;
  mode?: ReportMode;
  layer?: number;
  onClose: () => void;
};

const modeCopy: Record<ReportMode, { title: string; caption: string; badge: string }> = {
  base: {
    title: 'Экспорт операций',
    caption: 'Простая выгрузка доходов, расходов и переводов за выбранный период.',
    badge: 'База',
  },
  premium: {
    title: 'Расширенный отчёт',
    caption: 'Подробный финансовый отчёт с категориями, счетами, целями и обязательствами.',
    badge: 'Premium',
  },
  business: {
    title: 'Бизнес-отчёт',
    caption: 'Сводка для себя, партнёра или бухгалтера: доходы, расходы и итог периода.',
    badge: 'Бизнес',
  },
};

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPeriodRange(preset: PeriodPreset) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (preset === 'all' || preset === 'custom') return { startDate: '', endDate: '' };
  if (preset === 'year') return { startDate: toDateInput(new Date(now.getFullYear(), 0, 1)), endDate: toDateInput(end) };
  if (preset === 'quarter') return { startDate: toDateInput(new Date(now.getFullYear(), now.getMonth() - 2, 1)), endDate: toDateInput(end) };
  return { startDate: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toDateInput(end) };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-export-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ReportExportSheet({ open, mode = 'base', layer, onClose }: Props) {
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [transactionType, setTransactionType] = useState<ReportType>('all');
  const [period, setPeriod] = useState<PeriodPreset>('month');
  const initialRange = useMemo(() => getPeriodRange('month'), []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [preview, setPreview] = useState<ReportPreviewDto | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const subscription = useSubscriptionStore((state) => state.status);
  const loadSubscription = useSubscriptionStore((state) => state.load);

  useEffect(() => {
    if (open) void loadSubscription();
  }, [loadSubscription, open]);

  const copy = modeCopy[mode];
  const hasPremiumAccess = hasRealPremiumAccess(subscription);
  const hasBusinessAccess = hasRealBusinessAccess(subscription);
  const isLockedPremiumReport = mode === 'premium' && !hasPremiumAccess;
  const isLockedBusinessReport = mode === 'business' && !hasBusinessAccess;
  const isHeroClickable = isLockedPremiumReport || isLockedBusinessReport;

  function changePeriod(next: PeriodPreset) {
    setPeriod(next);
    const range = getPeriodRange(next);
    if (next !== 'custom') {
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  }

  const params = {
    mode,
    format,
    type: transactionType,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  async function loadPreview() {
    setIsLoadingPreview(true);
    setError(null);
    try {
      const result = await reportsApi.preview(params);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подготовить предварительный просмотр.');
    } finally {
      setIsLoadingPreview(false);
    }
  }

  function openModePage() {
    if (mode === 'premium') {
      onClose();
      navigateTo('premium');
      return;
    }
    if (mode === 'business') {
      onClose();
      navigateTo('store');
    }
  }

  async function download() {
    setIsDownloading(true);
    setError(null);
    try {
      await reportsApi.download(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать отчёт.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={copy.title} layer={layer}>
      <div className="report-export-sheet">
        <section
          className={`report-export-hero report-export-hero--${mode}${isHeroClickable ? ' report-export-hero--clickable' : ''}`}
          role={isHeroClickable ? 'button' : undefined}
          tabIndex={isHeroClickable ? 0 : undefined}
          onClick={isHeroClickable ? openModePage : undefined}
          onKeyDown={isHeroClickable ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openModePage();
            }
          } : undefined}
        >
          <div>
            <span>{copy.badge}</span>
            <h2>{copy.title}</h2>
            <p>{copy.caption}</p>
            {isHeroClickable ? <small>{mode === 'premium' ? 'Открыть Premium' : 'Скоро отдельный продукт'}</small> : null}
          </div>
          {isHeroClickable ? <i aria-hidden="true">›</i> : null}
        </section>

        <section className="report-export-section">
          <div className="report-export-label">Формат</div>
          <div className="report-export-segment">
            <button type="button" className={format === 'xlsx' ? 'is-active' : ''} onClick={() => setFormat('xlsx')}>Excel</button>
            <button type="button" className={format === 'pdf' ? 'is-active' : ''} onClick={() => setFormat('pdf')}>PDF</button>
          </div>
        </section>

        <section className="report-export-section">
          <div className="report-export-label">Период</div>
          <div className="report-export-chips">
            {[
              ['month', 'Месяц'],
              ['quarter', '3 месяца'],
              ['year', 'Год'],
              ['all', 'Всё'],
              ['custom', 'Свой'],
            ].map(([value, label]) => (
              <button key={value} type="button" className={period === value ? 'is-active' : ''} onClick={() => changePeriod(value as PeriodPreset)}>{label}</button>
            ))}
          </div>
          {period === 'custom' ? (
            <div className="report-export-dates">
              <label>
                <span>С</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                <span>По</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
            </div>
          ) : null}
        </section>

        <section className="report-export-section">
          <div className="report-export-label">Операции</div>
          <div className="report-export-chips">
            {[
              ['all', 'Все'],
              ['expense', 'Расходы'],
              ['income', 'Доходы'],
              ['transfer', 'Переводы'],
            ].map(([value, label]) => (
              <button key={value} type="button" className={transactionType === value ? 'is-active' : ''} onClick={() => setTransactionType(value as ReportType)}>{label}</button>
            ))}
          </div>
        </section>

        {preview ? (
          <section className="report-export-preview">
            <Metric label="Операций" value={String(preview.transactionsCount)} />
            <Metric label="Доходы" value={formatMoney(preview.summary.income, 'RUB')} />
            <Metric label="Расходы" value={formatMoney(preview.summary.expense, 'RUB')} />
            <Metric label="Итог" value={formatMoney(preview.summary.balance, 'RUB', { sign: 'auto' })} />
          </section>
        ) : null}

        {mode !== 'base' ? (
          <section className="report-export-note">
            В расширенный отчёт входят счета, категории, цели и обязательства. Для бизнес-режима добавляется отдельная сводка по прибыли.
          </section>
        ) : null}

        {error ? <div className="report-export-error">{error}</div> : null}

        <div className="report-export-actions">
          <button type="button" className="app-secondary-button" onClick={loadPreview} disabled={isLoadingPreview || isDownloading}>
            {isLoadingPreview ? 'Считаю…' : 'Предпросмотр'}
          </button>
          <button type="button" className="app-primary-button" onClick={download} disabled={isDownloading || isLoadingPreview}>
            {isDownloading ? 'Готовлю…' : 'Скачать'}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

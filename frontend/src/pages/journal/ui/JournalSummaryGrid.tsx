import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  count: number;
  income: number;
  expenses: number;
  currency: string;
};

export function JournalSummaryGrid({ count, income, expenses, currency }: Props) {
  const { t } = useI18n();

  return (
    <section className="journal-summary-grid">
      <article className="app-card"><span>{t('journal.summary.count')}</span><strong>{count}</strong></article>
      <article className="app-card"><span>{t('journal.summary.expenses')}</span><strong>{formatMoney(expenses, currency)}</strong></article>
      <article className="app-card"><span>{t('journal.summary.income')}</span><strong>{formatMoney(income, currency)}</strong></article>
    </section>
  );
}

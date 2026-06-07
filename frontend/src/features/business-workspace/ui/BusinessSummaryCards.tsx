import type { BusinessWorkspaceSummaryDto } from '@/features/business-workspace/api/businessWorkspace.api';
import { useI18n } from '@/shared/lib/i18n';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  summary: BusinessWorkspaceSummaryDto | null;
};

type SummaryCard = {
  title: string;
  value: string;
  caption: string;
  progress?: number;
};

function BusinessSummaryCard({ card }: { card: SummaryCard }) {
  return (
    <article className="business-summary-card">
      <span>{card.title}</span>
      <strong>{card.value}</strong>
      <small>{card.caption}</small>
      {typeof card.progress === 'number' ? <div className="business-summary-card__bar"><i style={{ width: `${card.progress}%` }} /></div> : null}
    </article>
  );
}

export function BusinessSummaryCards({ summary }: Props) {
  const { t } = useI18n();
  const safeSummary = summary ?? {
    monthIncome: 0,
    monthExpense: 0,
    profit: 0,
    incomePlan: 0,
    expensePlan: 0,
    incomeProgress: 0,
    expenseProgress: 0,
    activeLoans: 0,
    upcomingReminders: 0,
  };

  const cards: SummaryCard[] = [
    {
      title: t('business.summary.income'),
      value: formatMoney(safeSummary.monthIncome),
      caption: safeSummary.incomePlan > 0 ? t('business.summary.plan', { progress: safeSummary.incomeProgress }) : t('business.summary.noPlan'),
      progress: safeSummary.incomePlan > 0 ? safeSummary.incomeProgress : undefined,
    },
    {
      title: t('business.summary.expense'),
      value: formatMoney(safeSummary.monthExpense),
      caption: safeSummary.expensePlan > 0 ? t('business.summary.plan', { progress: safeSummary.expenseProgress }) : t('business.summary.noPlan'),
      progress: safeSummary.expensePlan > 0 ? safeSummary.expenseProgress : undefined,
    },
    {
      title: t('business.summary.profit'),
      value: formatMoney(safeSummary.profit, 'RUB', { sign: 'auto' }),
      caption: t('business.summary.month'),
    },
    {
      title: t('business.summary.reminders'),
      value: String(safeSummary.upcomingReminders),
      caption: t('business.summary.remindersCaption', { count: safeSummary.activeLoans }),
    },
  ];

  return <section className="business-summary-grid">{cards.map((card) => <BusinessSummaryCard key={card.title} card={card} />)}</section>;
}

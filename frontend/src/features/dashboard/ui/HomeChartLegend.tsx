import { formatMoney } from '@/shared/lib/money';
import { useI18n } from '@/shared/lib/i18n';

type HomeLegendGroup = {
  key: string;
  name: string;
  amount: number;
  color: string;
  icon?: string | null;
  percent: number;
  count: number;
};

type Props = {
  groups: HomeLegendGroup[];
  title?: string;
  limit?: number;
  compact?: boolean;
};

export function HomeChartLegend({ groups, title, limit = 4, compact = false }: Props) {
  const { t, rt } = useI18n();
  const visible = groups.filter((group) => group.amount > 0).slice(0, limit);
  const hiddenCount = Math.max(0, groups.length - visible.length);

  if (visible.length === 0) return null;

  return (
    <div className="app-home-chart-legend" data-compact={compact ? 'true' : 'false'}>
      {title ? <div className="app-home-chart-legend__title">{title}</div> : null}
      <div className="app-home-chart-legend__items">
        {visible.map((group) => (
          <div key={group.key} className="app-home-chart-legend__item">
            <i aria-hidden="true" style={{ background: group.color }}>{group.icon || ''}</i>
            <span>
              <b>{rt(group.name)}</b>
              <small>{group.percent}% · {formatMoney(group.amount, 'RUB')}</small>
            </span>
          </div>
        ))}
        {hiddenCount > 0 ? (
          <div className="app-home-chart-legend__more">{t('dashboard.chart.moreGroups', { count: hiddenCount })}</div>
        ) : null}
      </div>
    </div>
  );
}

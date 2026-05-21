import type { MonthlyStatsDto } from '@/features/transactions/api/transactions.api';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  stats: MonthlyStatsDto | null;
  compact?: boolean;
};

export function MonthlyStatsCard({ stats, compact = false }: Props) {
  if (!stats) return null;

  const shellClass = compact ? 'ai-page-card-compact min-h-[148px]' : 'app-card';

  if (compact) {
    const topCategory = stats.topCategories[0];

    return (
      <div className={shellClass}>
        <div className="app-eyebrow">Месяц</div>
        <div className="mt-3 text-sm text-white/60">{stats.count} операций</div>
        <div className={stats.balance >= 0 ? 'mt-2 break-words text-[24px] font-semibold leading-none tracking-[-0.06em] text-emerald-300' : 'mt-2 break-words text-[24px] font-semibold leading-none tracking-[-0.06em] text-white'}>
          {formatMoney(stats.balance, 'RUB', { sign: 'auto' })}
        </div>

        {topCategory ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-black/18 px-3 py-2">
            <div className="min-w-0 truncate text-xs text-white/70">{topCategory.icon ?? '📝'} {topCategory.name}</div>
            <div className="shrink-0 text-xs font-medium text-white/82">{formatMoney(topCategory.amount)}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="app-eyebrow">Месяц</div>
          <div className="mt-1 text-sm text-white/65">{stats.count} операций</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/42">Итог</div>
          <div className={stats.balance >= 0 ? 'text-lg font-semibold text-emerald-300' : 'text-lg font-semibold text-white'}>{formatMoney(stats.balance, 'RUB', { sign: 'auto' })}</div>
        </div>
      </div>

      {stats.topCategories.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {stats.topCategories.slice(0, 3).map((category) => (
            <div key={category.name} className="flex items-center justify-between rounded-2xl bg-black/18 px-3 py-2">
              <div className="truncate text-sm text-white/80">{category.icon ?? '📝'} {category.name}</div>
              <div className="shrink-0 text-sm font-medium text-white">{formatMoney(category.amount)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

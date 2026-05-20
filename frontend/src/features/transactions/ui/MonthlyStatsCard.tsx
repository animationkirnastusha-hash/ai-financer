import type { MonthlyStatsDto } from '@/features/transactions/api/transactions.api';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  stats: MonthlyStatsDto | null;
  compact?: boolean;
};

export function MonthlyStatsCard({ stats, compact = false }: Props) {
  if (!stats) return null;

  const shellClass = compact
    ? 'ai-page-card-compact h-full min-h-[148px]'
    : 'mx-4 mb-3 rounded-[24px] border border-white/8 bg-white/[0.035] p-4';
  const topCategory = stats.topCategories[0];

  if (compact) {
    return (
      <div className={shellClass}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">Месяц</div>
            <div className="mt-3 text-sm text-white/62">{stats.count} операций</div>
          </div>
          <div className={stats.balance >= 0 ? 'text-right text-xl font-semibold tracking-[-0.04em] text-emerald-300' : 'text-right text-xl font-semibold tracking-[-0.04em] text-white'}>
            {formatMoney(stats.balance, 'RUB', { sign: 'auto' })}
          </div>
        </div>

        {topCategory ? (
          <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl bg-black/18 px-3 py-2">
            <div className="min-w-0 truncate text-xs text-white/70">
              {topCategory.icon ?? '📝'} {topCategory.name}
            </div>
            <div className="shrink-0 text-xs font-medium text-white">
              {formatMoney(topCategory.amount)}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-black/18 px-3 py-2 text-xs text-white/42">
            Категории появятся после расходов
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">Месяц</div>
          <div className="mt-1 text-sm text-white/65">{stats.count} операций</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/42">Баланс месяца</div>
          <div className={stats.balance >= 0 ? 'text-lg font-semibold text-emerald-300' : 'text-lg font-semibold text-white'}>
            {formatMoney(stats.balance, 'RUB', { sign: 'auto' })}
          </div>
        </div>
      </div>

      {stats.topCategories.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {stats.topCategories.slice(0, 3).map((category) => (
            <div key={category.name} className="flex items-center justify-between rounded-2xl bg-black/18 px-3 py-2">
              <div className="truncate text-sm text-white/80">
                {category.icon ?? '📝'} {category.name}
              </div>
              <div className="shrink-0 text-sm font-medium text-white">
                {formatMoney(category.amount)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

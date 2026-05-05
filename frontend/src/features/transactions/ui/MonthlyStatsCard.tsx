import type { MonthlyStatsDto } from '@/features/transactions/api/transactions.api';
import { formatMoney } from '@/shared/lib/money';

type Props = {
  stats: MonthlyStatsDto | null;
};

export function MonthlyStatsCard({ stats }: Props) {
  if (!stats) return null;

  return (
    <div className="mx-4 mb-3 rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
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

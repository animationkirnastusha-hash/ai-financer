import type { TransactionDto } from '@/features/transactions/api/transactions.api';
import { TimelineEventCard } from '@/features/transactions/ui/TimelineEventCard';

type Props = {
  transactions: TransactionDto[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onOpenTransaction?: (transaction: TransactionDto) => void;
};

function getDayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().slice(0, 10);
}

function formatDayTitle(key: string) {
  if (key === 'unknown') return 'Без даты';
  const date = new Date(`${key}T12:00:00`);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}

function groupByDay(transactions: TransactionDto[]) {
  return transactions.reduce<Array<{ key: string; items: TransactionDto[] }>>((groups, transaction) => {
    const key = getDayKey(transaction.date);
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.items.push(transaction);
      return groups;
    }
    groups.push({ key, items: [transaction] });
    return groups;
  }, []);
}

export function TransactionsTimeline({ transactions, isLoading, error, onRefresh, onOpenTransaction }: Props) {
  const groups = groupByDay(transactions);

  return (
    <section className="app-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="app-eyebrow">История</div>
          <div className="mt-1 text-sm text-white/45">Живая лента операций</div>
        </div>
        <button type="button" onClick={onRefresh} className="app-secondary-button">Обновить</button>
      </div>

      <div className="mt-4 space-y-5">
        {isLoading ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-white/55">Загружаю операции...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/15 bg-red-400/10 p-4 text-sm text-red-100/80">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm leading-6 text-white/55">Пока нет операций. Скажи Фине: “кофе 300”.</div>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-[#0a0f15]/88 px-1 py-1">
                <div className="text-xs font-semibold text-white/58">{formatDayTitle(group.key)}</div>
                <div className="h-px flex-1 bg-white/8" />
              </div>
              {group.items.map((transaction) => <TimelineEventCard key={transaction.id} transaction={transaction} onClick={onOpenTransaction} />)}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

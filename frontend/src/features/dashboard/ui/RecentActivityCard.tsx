type Props = {
  title: string;
  subtitle: string;
  amount: string;
  time: string;
};

export function RecentActivityCard({
  title,
  subtitle,
  amount,
  time,
}: Props) {
  const isPositive = amount.trim().startsWith('+');

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-xs text-white/48">{subtitle}</div>
      </div>

      <div className="text-right">
        <div
          className={`text-sm font-medium ${
            isPositive ? 'text-emerald-300' : 'text-white'
          }`}
        >
          {amount}
        </div>
        <div className="mt-1 text-xs text-white/42">{time}</div>
      </div>
    </div>
  );
}
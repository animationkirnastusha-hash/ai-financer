export function formatMoney(
  amount: number,
  currency: string = 'RUB',
  options?: {
    sign?: 'auto' | 'plus' | 'minus' | 'none';
  },
) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const absAmount = Math.abs(safeAmount);

  const formatter = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  });

  const symbol =
    currency === 'RUB'
      ? '₽'
      : currency === 'USD'
        ? '$'
        : currency === 'EUR'
          ? '€'
          : currency;

  const sign =
    options?.sign === 'plus'
      ? '+'
      : options?.sign === 'minus'
        ? '-'
        : options?.sign === 'auto'
          ? safeAmount > 0
            ? '+'
            : safeAmount < 0
              ? '-'
              : ''
          : '';

  if (currency === 'USD') {
    return `${sign}${symbol}${formatter.format(absAmount)}`;
  }

  if (currency === 'EUR') {
    return `${sign}${symbol}${formatter.format(absAmount)}`;
  }

  return `${sign}${symbol} ${formatter.format(absAmount)}`;
}

export function formatTransactionDate(value: string | Date | undefined | null) {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  if (isYesterday) return 'вчера';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}
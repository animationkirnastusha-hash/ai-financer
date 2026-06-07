export function formatPaymentPrice(amount: number, currency: string) {
  if (currency === 'XTR') return `${amount.toLocaleString('ru-RU')} Stars`;
  if (currency === 'RUB') return `${Math.round(amount / 100).toLocaleString('ru-RU')} ₽`;
  return `${amount.toLocaleString('ru-RU')} ${currency}`;
}

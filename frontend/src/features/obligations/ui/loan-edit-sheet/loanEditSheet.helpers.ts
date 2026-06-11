export function toDateInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function toNumber(value: string) {
  if (!value.trim()) return undefined;
  const normalized = value.replace(',', '.').replace(/\s+/g, '');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : undefined;
}

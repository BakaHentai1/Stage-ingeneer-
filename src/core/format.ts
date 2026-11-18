import type { CalcValue } from '../calc/types';

/** Число в русском формате: запятая, неразрывный пробел между разрядами. */
export function fmtNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtValue(v: CalcValue): string {
  return typeof v.value === 'number' ? fmtNum(v.value, v.digits ?? 2) : v.value;
}

export function fmtDate(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000);
}

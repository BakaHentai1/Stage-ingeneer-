import { toCsv } from '../core/csv';
import type { Line } from './store';

/** Ведомость «что берём» для Excel: разделитель «;», UTF-8 с BOM. */
export function requestCsv(title: string, lines: Line[], packed: Record<string, boolean>): string {
  const rows: (string | number)[][] = [[title], ['Категория', 'Позиция', 'Нужно', 'Ед.', 'На складе', 'Не хватает', 'Погружено', 'Залы', 'Из заявки']];
  for (const l of lines) {
    rows.push([
      l.cat,
      l.name,
      l.need,
      l.unit,
      l.have ?? '?',
      l.have === null ? '?' : l.shortBy,
      packed[l.key] ? 'да' : '',
      [...new Set(l.sources.map((s) => s.zone).filter(Boolean))].join(', '),
      l.sources.map((s) => s.frag).join(' / '),
    ]);
  }
  return toCsv(rows);
}

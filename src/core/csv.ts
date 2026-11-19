import type { CalcResult, CalcValue } from '../calc/types';
import { fmtValue } from './format';

/** Экранирование поля CSV. */
export function csvCell(v: string | number): string {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV для русского Excel: разделитель «;», десятичная запятая, UTF-8 с BOM.
 */
export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

function valueRow(section: string, v: CalcValue): string[] {
  return [section, v.label, fmtValue(v), v.unit ?? ''];
}

export function calcRows(title: string, r: CalcResult): string[][] {
  const rows: string[][] = [[title, '', '', '']];
  rows.push(['Раздел', 'Параметр', 'Значение', 'Ед.']);
  r.inputs.forEach((v) => rows.push(valueRow('Исходные данные', v)));
  r.results.forEach((v) => rows.push(valueRow('Результат', v)));
  r.explain?.forEach((t) => rows.push(['Пояснение', t, '', '']));
  r.formulas.forEach((f) => rows.push(['Формула', f, '', '']));
  r.limits.forEach((l) => rows.push(['Ограничение', l, '', '']));
  r.warnings.forEach((w) => rows.push(['Предупреждение', w.text, '', '']));
  r.tables?.forEach((t) => {
    rows.push(['Таблица', t.title, '', '']);
    rows.push(t.head);
    t.rows.forEach((x) => rows.push(x.map((c) => (typeof c === 'number' ? String(Math.round(c * 100) / 100).replace('.', ',') : c))));
  });
  return rows;
}

export function calcToCsv(title: string, r: CalcResult): string {
  return toCsv(calcRows(title, r));
}

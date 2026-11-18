/**
 * Единый формат результата любого расчёта.
 * Интерфейс показывает его одной карточкой: формула, исходные данные,
 * результат, ограничения применимости, предупреждения.
 */

export type Level = 'ok' | 'warn' | 'crit' | 'info';

export interface CalcValue {
  label: string;
  value: number | string;
  unit?: string;
  /** Количество знаков после запятой для чисел. */
  digits?: number;
  /** Главный результат карточки (крупно). */
  primary?: boolean;
  level?: Level;
}

export interface CalcWarning {
  level: 'warn' | 'crit' | 'info';
  text: string;
}

export interface CalcResult {
  formulas: string[];
  inputs: CalcValue[];
  results: CalcValue[];
  limits: string[];
  warnings: CalcWarning[];
  /** Если задано — расчёт невозможен, показывается причина. */
  error?: string;
}

/** Описание поля ввода инструмента. */
export interface FieldDef {
  key: string;
  label: string;
  unit?: string;
  type: 'number' | 'select' | 'text';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  /** Показывать поле только при условии. */
  showIf?: (v: Values) => boolean;
}

export type Values = Record<string, string>;

export interface ToolDef {
  id: string;
  title: string;
  short: string;
  fields: FieldDef[];
  defaults: Values;
  compute: (v: Values) => CalcResult;
}

export const lg = Math.log10;

/** Читает число из строки поля (допускает запятую как разделитель). */
export function num(s: string | undefined): number {
  if (s === undefined) return NaN;
  const t = s.trim().replace(',', '.');
  if (t === '') return NaN;
  return Number(t);
}

export function fail(error: string, inputs: CalcValue[] = []): CalcResult {
  return { formulas: [], inputs, results: [], limits: [], warnings: [], error };
}

/** Проверка, что все значения — конечные числа; возвращает текст ошибки или null. */
export function requireFinite(pairs: [string, number][]): string | null {
  for (const [name, v] of pairs) {
    if (!Number.isFinite(v)) return `Введите число в поле «${name}».`;
  }
  return null;
}

/** Число для текста предупреждений: десятичная запятая. */
export function fx(n: number, digits = 1): string {
  return n.toFixed(digits).replace('.', ',');
}

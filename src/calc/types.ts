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

/** Таблица в карточке расчёта (сравнение вариантов, списки). Попадает в CSV и PDF. */
export interface CalcTable {
  title: string;
  head: string[];
  rows: (string | number)[][];
  /** Номер строки, которую выделить (рекомендуемый вариант). */
  mark?: number;
  note?: string;
}

/** Точка на схеме, м. */
export interface Pt { x: number; y: number }

/**
 * Рисунок в карточке расчёта. Только данные (без JSX), чтобы рисунок
 * сохранялся в проекте вместе с расчётом и печатался в PDF.
 */
export type Figure =
  | {
      kind: 'side';
      title: string;
      /** Кабинеты: центр, наклон оси вниз (°), высота и глубина, м. */
      boxes: { c: Pt; tilt: number; h: number; d: number; label?: string }[];
      /** Лучи (ось, границы покрытия). */
      rays: { from: Pt; to: Pt; tone: 'axis' | 'edge' | 'ok' | 'warn' }[];
      /** Зрительская зона: от x1 до x2 на высоте y (уши). */
      audience: { x1: number; x2: number; y: number };
      marks?: { x: number; y: number; text: string; tone?: 'ok' | 'warn' | 'crit' }[];
      floorTo: number;
      top: number;
    }
  | {
      kind: 'plan';
      title: string;
      room: { w: number; d: number };
      /** Источники (вид сверху): позиция, направление оси (° от оси зала, + вправо), угол раскрытия. */
      sources: { p: Pt; aim: number; spread: number; label: string; tone?: 'main' | 'sub' | 'delay' | 'fill' }[];
      lines?: { a: Pt; b: Pt; tone: 'warn' | 'crit' | 'ok' | 'muted'; label?: string }[];
      zones?: { p: Pt; r: number; tone: 'warn' | 'crit'; label?: string }[];
      marks?: { p: Pt; text: string; tone?: 'ok' | 'warn' | 'crit' }[];
      /** Не обрезать лучи стенами зала. */
      noClip?: boolean;
    }
  | {
      kind: 'chart';
      title: string;
      x: { label: string; log?: boolean; min: number; max: number };
      y: { label: string; min: number; max: number };
      series: { name: string; pts: [number, number][]; tone: 'accent' | 'info' | 'ok' | 'warn' | 'crit' | 'muted'; dash?: boolean }[];
      hlines?: { y: number; label: string; tone: 'warn' | 'crit' | 'ok' | 'muted' }[];
      vlines?: { x: number; label: string; tone: 'warn' | 'crit' | 'ok' | 'muted' }[];
    }
  | {
      kind: 'bars';
      title: string;
      unit: string;
      bars: { label: string; value: number; tone: 'accent' | 'info' | 'ok' | 'warn' | 'crit' | 'muted'; note?: string }[];
      /** Опорная линия (например, предел). */
      ref?: { value: number; label: string };
    }
  | {
      kind: 'wiring';
      title: string;
      /** Группы кабинетов: каждая группа — последовательная цепочка; группы между собой параллельно. */
      groups: string[][];
      amp: string;
    }
  | {
      kind: 'timeline';
      title: string;
      /** События прихода звука, мс. */
      events: { t: number; label: string; tone: 'accent' | 'info' | 'ok' | 'warn' }[];
      span: number;
    };

export interface CalcResult {
  formulas: string[];
  inputs: CalcValue[];
  results: CalcValue[];
  limits: string[];
  warnings: CalcWarning[];
  /** Простое объяснение результата (2–4 предложения). */
  explain?: string[];
  tables?: CalcTable[];
  figures?: Figure[];
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
  /** Варианты, которые зависят от данных (например, база акустики со своими моделями). */
  optionsFn?: (v: Values) => { value: string; label: string }[];
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
  /** Дополнительная панель под формой (например, список кабелей). */
  panel?: (p: { values: Values; set: (k: string, v: string) => void }) => preact.JSX.Element | null;
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

/** Введённое пользователем число в тексте: как ввёл, но с десятичной запятой. */
export function rn(n: number): string {
  return String(n).replace('.', ',');
}

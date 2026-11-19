/**
 * Модуль C. Калькуляторы для настройки звука: компрессор, темп дилэя, уровни сигнала.
 */
import { type CalcResult, type CalcWarning, type ToolDef, fail, num, requireFinite, fx } from '../types';

/* ---------- Компрессор: статическая характеристика (жёсткое колено) ---------- */

/** Выход компрессора: ниже порога out = in, выше out = T + (in − T)/R. */
export function compOut(inDb: number, thr: number, ratio: number): number {
  return inDb <= thr ? inDb : thr + (inDb - thr) / ratio;
}

export function compressor(i: { input: number; thr: number; ratio: number; makeup: number }): CalcResult {
  const err = requireFinite([['Пиковый уровень', i.input], ['Порог', i.thr], ['Ratio', i.ratio], ['Make-up', i.makeup]]);
  if (err) return fail(err);
  if (i.ratio < 1) return fail('Ratio должно быть не меньше 1 (1:1 — без сжатия).');
  const out = compOut(i.input, i.thr, i.ratio);
  const gr = i.input - out;
  const final = out + i.makeup;
  const w: CalcWarning[] = [];
  if (gr > 10) w.push({ level: 'warn', text: `Подавление ${fx(gr)} дБ — сильное сжатие. Для вокала обычно 3–6 дБ, иначе звук «плоский» и растёт риск обратной связи после make-up.` });
  if (i.makeup > gr + 0.05) w.push({ level: 'warn', text: 'Make-up больше подавления: громкость вырастет относительно исходной — следите за обратной связью.' });
  if (i.input <= i.thr) w.push({ level: 'info', text: 'Пик ниже порога — компрессор не работает. Опустите порог.' });
  return {
    formulas: ['При L_вх ≤ T:  L_вых = L_вх', 'При L_вх > T:  L_вых = T + (L_вх − T) / R', 'Подавление GR = L_вх − L_вых', 'Итог = L_вых + Make-up'],
    inputs: [
      { label: 'Пиковый уровень на входе L_вх', value: i.input, unit: 'дБ', digits: 1 },
      { label: 'Порог T', value: i.thr, unit: 'дБ', digits: 1 },
      { label: 'Ratio R', value: i.ratio, unit: ':1', digits: 1 },
      { label: 'Make-up', value: i.makeup, unit: 'дБ', digits: 1 },
    ],
    results: [
      { label: 'Подавление (GR)', value: gr, unit: 'дБ', digits: 1, primary: true },
      { label: 'Уровень после сжатия', value: out, unit: 'дБ', digits: 1 },
      { label: 'Уровень после make-up', value: final, unit: 'дБ', digits: 1 },
    ],
    limits: [
      'Статическая характеристика с жёстким коленом. Мягкое колено (Soft knee) сглаживает переход около порога, подавление там меньше.',
      'Атака и восстановление не учтены: на коротких пиках реальное подавление меньше расчётного.',
      'Уровни в дБ относительно одной шкалы (например, индикатор пульта).',
    ],
    warnings: w,
  };
}

export const compTool: ToolDef = {
  id: 'comp', title: 'Компрессор: сколько сожмёт', short: 'подавление по порогу и Ratio',
  fields: [
    { key: 'input', label: 'Пиковый уровень на входе', unit: 'дБ', type: 'number' },
    { key: 'thr', label: 'Порог (Threshold)', unit: 'дБ', type: 'number' },
    { key: 'ratio', label: 'Ratio', unit: ':1', type: 'number', step: 0.5 },
    { key: 'makeup', label: 'Make-up (Gain)', unit: 'дБ', type: 'number' },
  ],
  defaults: { input: '0', thr: '-12', ratio: '3', makeup: '4' },
  compute: (v) => compressor({ input: num(v.input), thr: num(v.thr), ratio: num(v.ratio), makeup: num(v.makeup) }),
};

/* ---------- Дилэй в темп ---------- */

export const NOTE_FACTORS: Record<string, [string, number]> = {
  '1/4': ['четверть', 1],
  '1/8': ['восьмая', 0.5],
  '1/8d': ['восьмая с точкой', 0.75],
  '1/4t': ['четвертная триоль', 2 / 3],
  '1/16': ['шестнадцатая', 0.25],
  '1/2': ['половинная', 2],
};

export function tempoDelay(bpm: number, note: string): CalcResult {
  const err = requireFinite([['Темп', bpm]]);
  if (err) return fail(err);
  if (bpm <= 0) return fail('Темп должен быть больше 0.');
  const [name, k] = NOTE_FACTORS[note] ?? NOTE_FACTORS['1/4'];
  const q = 60000 / bpm;
  const t = q * k;
  const w: CalcWarning[] = [];
  if (t > 2000) w.push({ level: 'info', text: 'Задержка больше 2 с: проверьте предел времени задержки в выбранном эффекте.' });
  return {
    formulas: ['t_четв = 60 000 / BPM  (мс)', `t = t_четв · k, k(${name}) = ${fx(k, 3)}`],
    inputs: [
      { label: 'Темп', value: bpm, unit: 'BPM', digits: 1 },
      { label: 'Длительность', value: name },
    ],
    results: [
      { label: 'Время задержки', value: t, unit: 'мс', digits: 1, primary: true },
      { label: 'Четверть', value: q, unit: 'мс', digits: 1 },
    ],
    limits: ['Темп берите у музыкантов или тап-темпом. Живой темп «плавает», дилэй в темп заметнее при стабильном темпе.'],
    warnings: w,
  };
}

export const tempoTool: ToolDef = {
  id: 'tempo', title: 'Дилэй в темп', short: 'мс по BPM и длительности',
  fields: [
    { key: 'bpm', label: 'Темп', unit: 'BPM', type: 'number' },
    { key: 'note', label: 'Длительность', type: 'select', options: Object.entries(NOTE_FACTORS).map(([v, [l]]) => ({ value: v, label: `${v.replace('d', ' с точкой').replace('t', ' триоль')} — ${l}` })) },
  ],
  defaults: { bpm: '120', note: '1/4' },
  compute: (v) => tempoDelay(num(v.bpm), v.note),
};

/* ---------- Уровни сигнала ---------- */

/** U = 0,7746 · 10^(dBu/20) В (0 dBu = √0,6 В). */
export const dbuToV = (dbu: number) => Math.sqrt(0.6) * Math.pow(10, dbu / 20);
/** dBV = dBu − 20·lg(0,7746) ≈ dBu − 2,218. */
export const dbuToDbv = (dbu: number) => dbu + 20 * Math.log10(Math.sqrt(0.6));

export function levels(dbu: number): CalcResult {
  const err = requireFinite([['Уровень', dbu]]);
  if (err) return fail(err);
  const v = dbuToV(dbu);
  return {
    formulas: ['U = 0,7746 · 10^(L_dBu / 20)  (В, действующее)', 'L_dBV = L_dBu − 2,218', 'U_пик = U · √2 (для синуса)'],
    inputs: [{ label: 'Уровень', value: dbu, unit: 'dBu', digits: 1 }],
    results: [
      { label: 'Напряжение (действующее)', value: v, unit: 'В', digits: 3, primary: true },
      { label: 'В dBV', value: dbuToDbv(dbu), unit: 'dBV', digits: 2 },
      { label: 'Пиковое (синус)', value: v * Math.SQRT2, unit: 'В', digits: 3 },
    ],
    limits: [
      'Ориентиры: профессиональная линия +4 dBu (1,23 В), бытовая −10 dBV (0,316 В), микрофон — милливольты (примерно −60…−40 dBu).',
      'Пиковое значение через √2 верно только для синуса; у музыки пик-фактор больше.',
    ],
    warnings: [],
  };
}

export const levelTool: ToolDef = {
  id: 'levels', title: 'Уровни: dBu, dBV, вольты', short: 'перевод уровней сигнала',
  fields: [{ key: 'dbu', label: 'Уровень', unit: 'dBu', type: 'number' }],
  defaults: { dbu: '4' },
  compute: (v) => levels(num(v.dbu)),
};

export const assistTools: ToolDef[] = [compTool, tempoTool, levelTool];

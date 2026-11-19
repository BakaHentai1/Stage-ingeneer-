import { CalcResult, CalcWarning, ToolDef, fail, lg, num, requireFinite, fx } from '../types';
import { deg } from './coverage';

export interface ConfigInput {
  /** Ширина зрительской зоны, м. */
  roomWidth: number;
  /** Расстояние от линии кабинетов до первого ряда, м. */
  dFirst: number;
  /** Расстояние от линии кабинетов до последнего ряда, м. */
  dLast: number;
  /** Смещение каждого портала от центральной оси зала, м (обычно половина ширины сцены). */
  offset: number;
  /** Угол раскрытия кабинета по горизонтали, °. */
  hAngle: number;
  /** Макс. длительный SPL одного кабинета на 1 м, дБ. */
  maxSpl: number;
  /** Нужный уровень на последнем ряду, дБ SPL. */
  target: number;
}

/**
 * Угол, который должен закрыть один портал (L или R): от боковой стены до центральной оси
 * на линии первого ряда: φ = arctg((W/2 − x) / d₁) + arctg(x / d₁).
 */
export function sideSpanDeg(roomWidth: number, offset: number, dFirst: number): number {
  return deg(Math.atan((roomWidth / 2 - offset) / dFirst) + Math.atan(offset / dFirst));
}

export function speakerConfig(i: ConfigInput): CalcResult {
  const err = requireFinite([
    ['Ширина зала', i.roomWidth], ['До первого ряда', i.dFirst], ['До последнего ряда', i.dLast],
    ['Смещение портала', i.offset], ['Угол кабинета', i.hAngle], ['Макс. SPL', i.maxSpl], ['Нужный уровень', i.target],
  ]);
  if (err) return fail(err);
  if (i.roomWidth <= 0 || i.dFirst <= 0) return fail('Ширина зала и расстояние до первого ряда должны быть больше 0.');
  if (i.dLast <= i.dFirst) return fail('Последний ряд должен быть дальше первого.');
  if (i.offset < 0 || i.offset > i.roomWidth / 2) return fail('Смещение портала — от 0 до половины ширины зала.');
  if (i.hAngle <= 0 || i.hAngle >= 180) return fail('Угол кабинета — от 1 до 179°.');

  const span = sideSpanDeg(i.roomWidth, i.offset, i.dFirst);
  const nSide = Math.max(1, Math.ceil(span / i.hAngle - 1e-9));
  // Самое дальнее место в зоне одного портала: угол у боковой стены или центр последнего ряда.
  const rFar = Math.max(Math.hypot(i.dLast, i.roomWidth / 2 - i.offset), Math.hypot(i.dLast, i.offset));
  const lFar = i.maxSpl - 20 * lg(rFar);
  const reserve = lFar - i.target;
  const dL = 20 * lg(rFar / i.dFirst);
  const rDelay = Math.pow(10, (i.maxSpl - i.target) / 20);
  const warnings: CalcWarning[] = [];
  let level: 'ok' | 'warn' | 'crit' = 'ok';

  if (reserve < 0) {
    level = 'crit';
    warnings.push({
      level: 'crit',
      text: `На последнем ряду не хватает ${fx(-reserve, 1)} дБ. Нужны более мощные кабинеты или delay-линия примерно в ${fx(rDelay, 0)} м от сцены.`,
    });
  } else if (reserve < 6) {
    level = 'warn';
    warnings.push({ level: 'warn', text: `Запас всего ${fx(reserve, 1)} дБ: система будет работать на пределе.` });
  }
  if (dL > 10) {
    warnings.push({
      level: 'warn',
      text: `Разница уровней между первым и последним рядом ${fx(dL, 1)} дБ. Рассмотрите delay-линию или линейный массив.`,
    });
  }
  if (nSide > 1) {
    warnings.push({
      level: 'info',
      text: `${nSide} кабинета на портал разводятся веером так, чтобы границы покрытия (−6 дБ) соседних кабинетов совпадали.`,
    });
  }
  warnings.push({
    level: 'warn',
    text: 'Установка кабинетов на стойки, стеки и подвес: проверьте устойчивость, нагрузку на конструкции и такелаж. Подвес — только по проекту и после проверки специалистом.',
  });

  return {
    formulas: [
      'φ = arctg((W/2 − x) / d₁) + arctg(x / d₁)',
      'N = ⌈φ / θ⌉ на портал',
      'r_макс = max(√(d₂² + (W/2 − x)²), √(d₂² + x²))',
      'L = L₁ − 20·lg r_макс',
    ],
    inputs: [
      { label: 'Ширина зрительской зоны W', value: i.roomWidth, unit: 'м', digits: 1 },
      { label: 'До первого ряда d₁', value: i.dFirst, unit: 'м', digits: 1 },
      { label: 'До последнего ряда d₂', value: i.dLast, unit: 'м', digits: 1 },
      { label: 'Смещение портала от оси x', value: i.offset, unit: 'м', digits: 1 },
      { label: 'Угол кабинета по горизонтали θ', value: i.hAngle, unit: '°', digits: 0 },
      { label: 'Макс. SPL кабинета L₁ (1 м)', value: i.maxSpl, unit: 'дБ', digits: 1 },
      { label: 'Нужный уровень на последнем ряду', value: i.target, unit: 'дБ SPL', digits: 1 },
    ],
    results: [
      { label: 'Кабинетов на портал (L и R)', value: nSide, unit: 'шт', digits: 0, primary: true },
      { label: 'Всего кабинетов', value: nSide * 2, unit: 'шт', digits: 0 },
      { label: 'Нужный угол покрытия портала', value: span, unit: '°', digits: 0 },
      { label: 'Уровень на самом дальнем месте', value: lFar, unit: 'дБ SPL', digits: 1, level },
      { label: 'Запас относительно цели', value: reserve, unit: 'дБ', digits: 1, level },
      { label: 'Разница первый/последний ряд', value: dL, unit: 'дБ', digits: 1, level: dL > 10 ? 'warn' : 'ok' },
    ],
    limits: [
      'Модель для схемы «левый и правый портал из точечных кабинетов». Для линейных массивов нужен расчёт в ПО производителя.',
      'Каждый портал закрывает свою половину зала; в центре порталы перекрываются и дают до +3 дБ, это в расчёт уровня не включено (оценка снизу).',
      'Уровень — по закону обратных квадратов в свободном поле; отражения зала его повышают, направленность кабинета вне оси снижает.',
      'Расстояния считаются в горизонтальной плоскости; высота подвеса не учтена (см. расчёт покрытия).',
      'Сабвуферы считаются отдельно.',
    ],
    warnings,
  };
}

export const configTool: ToolDef = {
  id: 'config',
  title: 'Конфигурация акустики',
  short: 'сколько кабинетов на портал',
  fields: [
    { key: 'roomWidth', label: 'Ширина зрительской зоны', unit: 'м', type: 'number' },
    { key: 'dFirst', label: 'До первого ряда', unit: 'м', type: 'number', step: 0.5 },
    { key: 'dLast', label: 'До последнего ряда', unit: 'м', type: 'number', step: 0.5 },
    { key: 'offset', label: 'Смещение портала от центра', unit: 'м', type: 'number', step: 0.5, hint: 'Обычно половина ширины сцены' },
    { key: 'hAngle', label: 'Угол кабинета по горизонтали', unit: '°', type: 'number' },
    { key: 'maxSpl', label: 'Макс. SPL кабинета на 1 м', unit: 'дБ', type: 'number' },
    { key: 'target', label: 'Нужный уровень на последнем ряду', unit: 'дБ SPL', type: 'number' },
  ],
  defaults: { roomWidth: '20', dFirst: '3', dLast: '24', offset: '5', hAngle: '90', maxSpl: '128', target: '98' },
  compute: (v) =>
    speakerConfig({
      roomWidth: num(v.roomWidth), dFirst: num(v.dFirst), dLast: num(v.dLast), offset: num(v.offset),
      hAngle: num(v.hAngle), maxSpl: num(v.maxSpl), target: num(v.target),
    }),
};

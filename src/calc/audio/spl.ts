import { CalcResult, ToolDef, fail, lg, num, requireFinite, fx, rn } from '../types';

export interface SplInput {
  /** Чувствительность, дБ SPL (1 Вт / 1 м). */
  sens: number;
  /** Подводимая мощность, Вт. */
  power: number;
  /** Расстояние до слушателя, м. */
  distance: number;
  /** Количество одинаковых кабинетов, работающих на точку. */
  count: number;
  /** Суммирование нескольких кабинетов. */
  sum: 'incoherent' | 'coherent';
  /** Модель распространения. */
  model: 'point' | 'line';
  /** Паспортный максимальный SPL одного кабинета на 1 м (0 — не задан). */
  maxSpl: number;
}

/** Уровень одного кабинета на 1 м от мощности: L1 = S + 10·lg(P / 1 Вт). */
export function splAt1m(sens: number, power: number): number {
  return sens + 10 * lg(power);
}

/** Затухание с расстоянием относительно 1 м. */
export function distanceLoss(distance: number, model: 'point' | 'line' = 'point'): number {
  return (model === 'point' ? 20 : 10) * lg(distance);
}

/** Прибавка от N одинаковых источников. */
export function sumGain(count: number, sum: 'incoherent' | 'coherent'): number {
  return (sum === 'incoherent' ? 10 : 20) * lg(count);
}

export function splAtDistance(i: SplInput): CalcResult {
  const err = requireFinite([
    ['Чувствительность', i.sens],
    ['Мощность', i.power],
    ['Расстояние', i.distance],
    ['Количество', i.count],
  ]);
  if (err) return fail(err);
  if (i.power <= 0) return fail('Мощность должна быть больше 0 Вт.');
  if (i.distance <= 0) return fail('Расстояние должно быть больше 0 м.');
  if (i.count < 1 || !Number.isInteger(i.count)) return fail('Количество кабинетов — целое число от 1.');

  const warnings: CalcResult['warnings'] = [];
  let l1 = splAt1m(i.sens, i.power);
  const capped = i.maxSpl > 0 && l1 > i.maxSpl;
  if (capped) {
    warnings.push({
      level: 'warn',
      text: `При ${rn(i.power)} Вт расчётный уровень ${fx(l1, 1)} дБ выше паспортного максимума ${rn(i.maxSpl)} дБ. Взят паспортный максимум: колонка не выдаст больше, лишняя мощность приведёт к компрессии или перегрузке.`,
    });
    l1 = i.maxSpl;
  }
  const gain = sumGain(i.count, i.sum);
  const loss = distanceLoss(i.distance, i.model);
  const lr = l1 + gain - loss;

  if (i.distance < 1) {
    warnings.push({ level: 'info', text: 'Расстояние меньше 1 м: это ближняя зона, формула даёт лишь грубую оценку.' });
  }
  if (lr >= 100) {
    warnings.push({
      level: 'warn',
      text: 'Уровень от 100 дБ опасен для слуха при длительном воздействии. Соблюдайте нормы шумового воздействия на зрителей и персонал.',
    });
  }

  const formulas = [
    'L₁ = S + 10·lg(P / 1 Вт)',
    i.count > 1 ? `L₁ₙ = L₁ + ${i.sum === 'incoherent' ? 10 : 20}·lg(N)` : '',
    `L(r) = L₁${i.count > 1 ? 'ₙ' : ''} − ${i.model === 'point' ? 20 : 10}·lg(r / 1 м)`,
  ].filter(Boolean);

  return {
    formulas,
    inputs: [
      { label: 'Чувствительность S', value: i.sens, unit: 'дБ (1 Вт/1 м)', digits: 1 },
      { label: 'Мощность P', value: i.power, unit: 'Вт', digits: 0 },
      { label: 'Расстояние r', value: i.distance, unit: 'м', digits: 1 },
      { label: 'Кабинетов N', value: i.count, digits: 0 },
      { label: 'Суммирование', value: i.sum === 'incoherent' ? 'некогерентное (+3 дБ на удвоение)' : 'когерентное (+6 дБ на удвоение)' },
      { label: 'Модель', value: i.model === 'point' ? 'точечный источник (−6 дБ на удвоение r)' : 'линейный источник (−3 дБ на удвоение r)' },
      ...(i.maxSpl > 0 ? [{ label: 'Макс. SPL кабинета', value: i.maxSpl, unit: 'дБ', digits: 1 }] : []),
    ],
    results: [
      { label: 'Уровень на расстоянии r', value: lr, unit: 'дБ SPL', digits: 1, primary: true, level: lr >= 100 ? 'warn' : 'ok' },
      { label: 'Один кабинет на 1 м', value: l1, unit: 'дБ SPL', digits: 1 },
      { label: 'Прибавка от N кабинетов', value: gain, unit: 'дБ', digits: 1 },
      { label: 'Затухание до r', value: loss, unit: 'дБ', digits: 1 },
    ],
    limits: [
      'Свободное поле: отражения и реверберация помещения не учитываются, в зале реальный уровень на дальних местах будет выше.',
      'Точечная модель верна в дальней зоне (обычно дальше 2–3 размеров кабинета).',
      'Линейная модель (−3 дБ) верна только в ближней зоне линейного массива; дальше спад становится −6 дБ.',
      'Когерентное суммирование (+6 дБ) — только для близко стоящих кабинетов в фазе и на низких частотах. Для разнесённых кабинетов используйте некогерентное.',
      'Поглощение звука воздухом на высоких частотах не учтено.',
      'Чувствительность — паспортная, обычно в полупространстве или на оси; реальная АЧХ не учитывается.',
    ],
    warnings,
  };
}

export const splTool: ToolDef = {
  id: 'spl',
  title: 'SPL на дистанции',
  short: 'уровень на месте слушателя',
  fields: [
    { key: 'sens', label: 'Чувствительность', unit: 'дБ 1 Вт/1 м', type: 'number', step: 0.5 },
    { key: 'power', label: 'Мощность на кабинет', unit: 'Вт', type: 'number', min: 0 },
    { key: 'distance', label: 'Расстояние', unit: 'м', type: 'number', min: 0, step: 0.5 },
    { key: 'count', label: 'Кабинетов', unit: 'шт', type: 'number', min: 1, step: 1 },
    {
      key: 'sum', label: 'Суммирование', type: 'select',
      options: [
        { value: 'incoherent', label: 'Некогерентное (+3 дБ)' },
        { value: 'coherent', label: 'Когерентное (+6 дБ)' },
      ],
    },
    {
      key: 'model', label: 'Модель источника', type: 'select',
      options: [
        { value: 'point', label: 'Точечный (−6 дБ)' },
        { value: 'line', label: 'Линейный массив, ближняя зона (−3 дБ)' },
      ],
    },
    { key: 'maxSpl', label: 'Макс. SPL кабинета', unit: 'дБ, 0 = нет', type: 'number', min: 0 },
  ],
  defaults: { sens: '98', power: '500', distance: '20', count: '1', sum: 'incoherent', model: 'point', maxSpl: '0' },
  compute: (v) =>
    splAtDistance({
      sens: num(v.sens), power: num(v.power), distance: num(v.distance), count: num(v.count),
      sum: v.sum === 'coherent' ? 'coherent' : 'incoherent',
      model: v.model === 'line' ? 'line' : 'point',
      maxSpl: num(v.maxSpl) || 0,
    }),
};

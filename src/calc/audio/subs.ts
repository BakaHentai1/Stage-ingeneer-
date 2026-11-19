import { CalcResult, CalcWarning, ToolDef, fail, lg, num, requireFinite } from '../types';

export interface SubsInput {
  /** Паспортный макс. SPL одного сабвуфера на 1 м, дБ. */
  maxSpl: number;
  /** Нужный уровень НЧ у слушателя, дБ SPL. */
  target: number;
  /** Расстояние до слушателя, м. */
  distance: number;
  /** Запас, дБ. */
  headroom: number;
}

/** N = ⌈10^((L + H + 20·lg r − L₁) / k)⌉, k = 20 для когерентного, 10 для некогерентного суммирования. */
export function subsCount(maxSpl: number, target: number, distance: number, headroom: number, k: 10 | 20): number {
  const need = target + headroom + 20 * lg(distance) - maxSpl;
  const n = Math.pow(10, need / k);
  return Math.max(1, Math.ceil(n - 1e-9));
}

export function subwoofers(i: SubsInput): CalcResult {
  const err = requireFinite([
    ['Макс. SPL', i.maxSpl], ['Нужный уровень', i.target], ['Расстояние', i.distance], ['Запас', i.headroom],
  ]);
  if (err) return fail(err);
  if (i.distance <= 0) return fail('Расстояние должно быть больше 0 м.');
  if (i.headroom < 0) return fail('Запас не может быть отрицательным.');

  const loss = 20 * lg(i.distance);
  const nCoh = subsCount(i.maxSpl, i.target, i.distance, i.headroom, 20);
  const nInc = subsCount(i.maxSpl, i.target, i.distance, i.headroom, 10);
  const levelCoh = i.maxSpl + 20 * lg(nCoh) - loss;
  const warnings: CalcWarning[] = [];

  if (nCoh > 16) {
    warnings.push({ level: 'warn', text: 'Требуется очень много сабвуферов: проверьте исходные данные или уменьшите требования.' });
  }
  if (nCoh >= 4) {
    warnings.push({
      level: 'warn',
      text: 'Стек из нескольких сабвуферов: проверьте устойчивость, крепление и несущую способность пола или сцены. Подвес сабвуферов — только на сертифицированном оборудовании и после проверки специалистом.',
    });
  }

  return {
    formulas: [
      'N = ⌈10^((L + H + 20·lg r − L₁) / 20)⌉   (когерентно, связанный кластер)',
      'N = ⌈10^((L + H + 20·lg r − L₁) / 10)⌉   (некогерентно, оценка сверху)',
      'L(r) = L₁ + 20·lg N − 20·lg r',
    ],
    inputs: [
      { label: 'Макс. SPL сабвуфера L₁ (1 м)', value: i.maxSpl, unit: 'дБ', digits: 1 },
      { label: 'Нужный уровень НЧ L', value: i.target, unit: 'дБ SPL', digits: 1 },
      { label: 'Расстояние r', value: i.distance, unit: 'м', digits: 1 },
      { label: 'Запас H', value: i.headroom, unit: 'дБ', digits: 1 },
    ],
    results: [
      { label: 'Сабвуферов (связанный кластер)', value: nCoh, unit: 'шт', digits: 0, primary: true },
      { label: 'Уровень с этим количеством на r', value: levelCoh, unit: 'дБ SPL', digits: 1 },
      { label: 'Затухание до r', value: loss, unit: 'дБ', digits: 1 },
      { label: 'Сабвуферов, если разнесены', value: nInc, unit: 'шт', digits: 0 },
    ],
    limits: [
      'Когерентное сложение (+6 дБ на удвоение) работает, когда сабвуферы стоят вплотную в одной точке и в фазе (расстояние между центрами меньше ~¼ длины волны: 0,85 м на 100 Гц).',
      'Разнесённые левый и правый стеки дают интерференцию («power alley»): по центру прибавка, в других местах провалы.',
      'Используется паспортный максимальный SPL; для долгой работы берите уровень на 3–6 дБ ниже пикового значения из паспорта.',
      'Влияние пола и стен (полупространство) уже входит в паспортное значение, если оно измерено на земле. Комната на НЧ может добавить или убрать до 10 дБ.',
    ],
    warnings,
  };
}

export const subsTool: ToolDef = {
  id: 'subs',
  title: 'Количество сабвуферов',
  short: 'по нужному уровню НЧ',
  fields: [
    { key: 'maxSpl', label: 'Макс. SPL сабвуфера на 1 м', unit: 'дБ', type: 'number' },
    { key: 'target', label: 'Нужный уровень НЧ', unit: 'дБ SPL', type: 'number' },
    { key: 'distance', label: 'Расстояние до слушателя', unit: 'м', type: 'number', step: 0.5 },
    { key: 'headroom', label: 'Запас', unit: 'дБ', type: 'number', step: 1 },
  ],
  defaults: { maxSpl: '131', target: '110', distance: '25', headroom: '3' },
  compute: (v) =>
    subwoofers({ maxSpl: num(v.maxSpl), target: num(v.target), distance: num(v.distance), headroom: num(v.headroom) }),
};

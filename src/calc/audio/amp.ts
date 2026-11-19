import { CalcResult, CalcWarning, ToolDef, fail, lg, num, requireFinite, rn } from '../types';

export interface AmpInput {
  /** Чувствительность кабинета, дБ (1 Вт / 1 м). */
  sens: number;
  /** Требуемый уровень у слушателя, дБ SPL. */
  target: number;
  /** Расстояние до слушателя, м. */
  distance: number;
  /** Запас по пикам (headroom), дБ. */
  headroom: number;
  /** Долговременная (AES/RMS) мощность кабинета, Вт. */
  ratedPower: number;
  /** Номинальный импеданс, Ом. */
  z: number;
}

/** Мощность, нужная для уровня L на расстоянии r: P = 10^((L + H − S + 20·lg r) / 10). */
export function requiredPower(sens: number, target: number, distance: number, headroom: number): number {
  return Math.pow(10, (target + headroom - sens + 20 * lg(distance)) / 10);
}

export function ampPower(i: AmpInput): CalcResult {
  const err = requireFinite([
    ['Чувствительность', i.sens], ['Требуемый уровень', i.target], ['Расстояние', i.distance],
    ['Запас', i.headroom], ['Мощность кабинета', i.ratedPower], ['Импеданс', i.z],
  ]);
  if (err) return fail(err);
  if (i.distance <= 0) return fail('Расстояние должно быть больше 0 м.');
  if (i.ratedPower <= 0) return fail('Мощность кабинета должна быть больше 0 Вт.');
  if (i.z <= 0) return fail('Импеданс должен быть больше 0 Ом.');
  if (i.headroom < 0) return fail('Запас не может быть отрицательным.');

  const p = requiredPower(i.sens, i.target, i.distance, i.headroom);
  const u = Math.sqrt(p * i.z);
  const current = Math.sqrt(p / i.z);
  const recLow = 1.5 * i.ratedPower;
  const recHigh = 2 * i.ratedPower;
  const maxLevel = i.sens + 10 * lg(i.ratedPower) - 20 * lg(i.distance);
  const warnings: CalcWarning[] = [];
  let level: 'ok' | 'warn' | 'crit' = 'ok';

  if (p > i.ratedPower) {
    level = 'crit';
    warnings.push({
      level: 'crit',
      text: `Нужно ${Math.round(p)} Вт, а кабинет рассчитан на ${rn(i.ratedPower)} Вт. Один кабинет не обеспечит ${rn(i.target)} дБ на ${rn(i.distance)} м с запасом ${rn(i.headroom)} дБ: возьмите больше кабинетов, мощнее модель или уменьшите дистанцию.`,
    });
  } else if (p > 0.5 * i.ratedPower) {
    level = 'warn';
    warnings.push({ level: 'warn', text: 'Кабинет будет работать больше чем на половину паспортной мощности: запаса почти нет.' });
  }
  warnings.push({
    level: 'info',
    text: 'Не подавайте на кабинет постоянную мощность выше паспортной: клиппированный сигнал перегревает ВЧ-драйверы быстрее, чем «чистая» мощность.',
  });

  return {
    formulas: [
      'P = 10^((L + H − S + 20·lg r) / 10)',
      'U = √(P·Z),  I = √(P / Z)',
      'P_ус ≈ (1,5…2) · P_AES  (практика производителей)',
    ],
    inputs: [
      { label: 'Чувствительность S', value: i.sens, unit: 'дБ (1 Вт/1 м)', digits: 1 },
      { label: 'Требуемый уровень L', value: i.target, unit: 'дБ SPL', digits: 1 },
      { label: 'Расстояние r', value: i.distance, unit: 'м', digits: 1 },
      { label: 'Запас H', value: i.headroom, unit: 'дБ', digits: 1 },
      { label: 'Мощность кабинета P_AES', value: i.ratedPower, unit: 'Вт', digits: 0 },
      { label: 'Импеданс Z', value: i.z, unit: 'Ом', digits: 1 },
    ],
    results: [
      { label: 'Нужная мощность на кабинет', value: p, unit: 'Вт', digits: 0, primary: true, level },
      { label: 'Рекомендуемый усилитель на канал', value: `${Math.round(recLow)}–${Math.round(recHigh)}`, unit: `Вт на ${i.z} Ом` },
      { label: 'Напряжение на нагрузке', value: u, unit: 'В', digits: 1 },
      { label: 'Ток в нагрузке', value: current, unit: 'А', digits: 2 },
      { label: 'Макс. уровень при P_AES на r', value: maxLevel, unit: 'дБ SPL', digits: 1 },
    ],
    limits: [
      'Свободное поле, точечный источник, слушатель на оси кабинета.',
      'Чувствительность и мощность — паспортные; реальная звуковая мощность падает из-за термокомпрессии на 1–3 дБ при длительной работе.',
      'Коэффициент 1,5–2 для усилителя — рекомендация многих производителей акустики, а не физический закон. Сверяйтесь с паспортом кабинета.',
      'Запас H учитывает пик-фактор программы: для речи обычно 6–10 дБ, для живой музыки 10–20 дБ.',
    ],
    warnings,
  };
}

export const ampTool: ToolDef = {
  id: 'amp',
  title: 'Мощность усилителя',
  short: 'ватты под нужный уровень',
  fields: [
    { key: 'sens', label: 'Чувствительность', unit: 'дБ 1 Вт/1 м', type: 'number', step: 0.5 },
    { key: 'target', label: 'Нужный уровень у слушателя', unit: 'дБ SPL', type: 'number' },
    { key: 'distance', label: 'Расстояние', unit: 'м', type: 'number', step: 0.5 },
    { key: 'headroom', label: 'Запас по пикам', unit: 'дБ', type: 'number', step: 1 },
    { key: 'ratedPower', label: 'Мощность кабинета (AES/RMS)', unit: 'Вт', type: 'number' },
    { key: 'z', label: 'Импеданс кабинета', unit: 'Ом', type: 'number' },
  ],
  defaults: { sens: '98', target: '95', distance: '15', headroom: '10', ratedPower: '500', z: '8' },
  compute: (v) =>
    ampPower({
      sens: num(v.sens), target: num(v.target), distance: num(v.distance), headroom: num(v.headroom),
      ratedPower: num(v.ratedPower), z: num(v.z),
    }),
};

import { CalcResult, CalcWarning, ToolDef, fail, num, requireFinite } from '../types';

/** Скорость звука в воздухе: c ≈ 331,3 + 0,606·T (м/с, T в °C). */
export function speedOfSound(tempC: number): number {
  return 331.3 + 0.606 * tempC;
}

/** Задержка, мс: t = d / c · 1000. */
export function delayMs(distance: number, tempC: number): number {
  return (distance / speedOfSound(tempC)) * 1000;
}

export interface DelayInput {
  distance: number;
  temp: number;
  offset: number;
  sampleRate: number;
}

export function delayLine(i: DelayInput): CalcResult {
  const err = requireFinite([['Расстояние', i.distance], ['Температура', i.temp], ['Добавка', i.offset]]);
  if (err) return fail(err);
  if (i.distance <= 0) return fail('Расстояние должно быть больше 0 м.');
  if (i.temp < -30 || i.temp > 50) return fail('Температура вне диапазона −30…+50 °C.');

  const c = speedOfSound(i.temp);
  const t = delayMs(i.distance, i.temp);
  const total = t + i.offset;
  const warnings: CalcWarning[] = [];
  if (i.offset < 0) warnings.push({ level: 'warn', text: 'Отрицательная добавка: delay-линия опередит основной порт, звук «потянет» к ней.' });
  if (i.offset > 20) warnings.push({ level: 'warn', text: 'Добавка больше 20 мс может восприниматься как эхо.' });

  return {
    formulas: ['c = 331,3 + 0,606·T  (м/с)', 't = d / c · 1000 + Δt  (мс)', 'Отсчёты = t · f_д / 1000'],
    inputs: [
      { label: 'Расстояние от основного порта до delay d', value: i.distance, unit: 'м', digits: 2 },
      { label: 'Температура воздуха T', value: i.temp, unit: '°C', digits: 0 },
      { label: 'Добавка (эффект предшествования) Δt', value: i.offset, unit: 'мс', digits: 1 },
      { label: 'Частота дискретизации f_д', value: i.sampleRate, unit: 'Гц', digits: 0 },
    ],
    results: [
      { label: 'Задержка для delay-линии', value: total, unit: 'мс', digits: 1, primary: true },
      { label: 'Время пробега звука', value: t, unit: 'мс', digits: 2 },
      { label: 'Скорость звука', value: c, unit: 'м/с', digits: 1 },
      { label: 'В отсчётах', value: Math.round((total * i.sampleRate) / 1000), unit: 'отсч.', digits: 0 },
    ],
    limits: [
      'Линейная формула скорости звука точна до долей процента в диапазоне −20…+40 °C; влажность и ветер не учтены.',
      'Расстояние — по прямой от акустического центра основного порта до delay-линии (с учётом высоты подвеса).',
      'Добавка 5–15 мс обычно сохраняет локализацию на сцене (эффект Хааса); финальную настройку делают по измерению.',
    ],
    warnings,
  };
}

export const delayTool: ToolDef = {
  id: 'delay',
  title: 'Задержка delay-линии',
  short: 'мс по расстоянию и температуре',
  fields: [
    { key: 'distance', label: 'Расстояние до delay-линии', unit: 'м', type: 'number', step: 0.5 },
    { key: 'temp', label: 'Температура воздуха', unit: '°C', type: 'number' },
    { key: 'offset', label: 'Добавка', unit: 'мс', type: 'number', step: 1 },
    {
      key: 'sampleRate', label: 'Частота дискретизации', type: 'select',
      options: [{ value: '48000', label: '48 кГц' }, { value: '44100', label: '44,1 кГц' }, { value: '96000', label: '96 кГц' }],
    },
  ],
  defaults: { distance: '30', temp: '20', offset: '10', sampleRate: '48000' },
  compute: (v) => delayLine({ distance: num(v.distance), temp: num(v.temp), offset: num(v.offset), sampleRate: num(v.sampleRate) || 48000 }),
};

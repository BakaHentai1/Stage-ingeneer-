import { CalcResult, CalcWarning, ToolDef, fail, num, requireFinite, fx, rn } from '../types';

/** Скорость звука в воздухе: c ≈ 331,3 + 0,606·T (м/с, T в °C). */
export function speedOfSound(tempC: number): number {
  return 331.3 + 0.606 * tempC;
}

/** Задержка, мс: t = d / c · 1000. */
export function delayMs(distance: number, tempC: number): number {
  return (distance / speedOfSound(tempC)) * 1000;
}

export interface DelayInput {
  /** Прямое расстояние от основного порта до delay-линии, м (если geom не задан). */
  distance: number;
  temp: number;
  offset: number;
  sampleRate: number;
  /** Геометрия: высоты акустических центров и расстояние по горизонтали, м. */
  geom?: { mainH: number; delayH: number; horiz: number };
  /** Где слушатель за delay-линией, м (для схемы прихода звука). */
  listener?: number;
}

export function delayLine(i: DelayInput): CalcResult {
  const err = requireFinite([['Температура', i.temp], ['Добавка', i.offset], ...(i.geom ? ([['Высота main', i.geom.mainH], ['Высота delay', i.geom.delayH], ['По горизонтали', i.geom.horiz]] as [string, number][]) : ([['Расстояние', i.distance]] as [string, number][]))]);
  if (err) return fail(err);
  const distance = i.geom ? Math.hypot(i.geom.horiz, i.geom.mainH - i.geom.delayH) : i.distance;
  if (i.geom && (i.geom.horiz <= 0 || i.geom.mainH < 0 || i.geom.delayH < 0)) return fail('Расстояние по горизонтали больше 0, высоты не отрицательные.');
  if (distance <= 0) return fail('Расстояние должно быть больше 0 м.');
  if (i.temp < -30 || i.temp > 50) return fail('Температура вне диапазона −30…+50 °C.');

  const c = speedOfSound(i.temp);
  const t = delayMs(distance, i.temp);
  const total = t + i.offset;
  const warnings: CalcWarning[] = [];
  if (i.offset < 0) warnings.push({ level: 'warn', text: 'Отрицательная добавка: delay-линия опередит основной порт, звук «потянет» к ней.' });
  if (i.offset > 20) warnings.push({ level: 'warn', text: 'Добавка больше 20 мс может восприниматься как эхо.' });
  const dT = delayMs(distance, i.temp + 10) - t;
  if (Math.abs(dT) > 2) {
    warnings.push({ level: 'info', text: `Изменение температуры на 10 °C сдвигает задержку на ${fx(Math.abs(dT), 1)} мс. На открытой площадке перепроверьте задержку вечером, когда остынет воздух.` });
  }
  warnings.push({ level: 'warn', text: 'Delay-вышки и подвесы delay-линии: устойчивость, балласт и ветровая нагрузка проверяются специалистом.' });

  // Сравнение по температуре.
  const rows = [-10, 0, 10, 20, 30, 40].map((tc) => [`${tc} °C`, fx(speedOfSound(tc), 1), fx(delayMs(distance, tc) + i.offset, 1)]);
  const mark = [-10, 0, 10, 20, 30, 40].indexOf(Math.round(i.temp / 10) * 10);

  // Схема прихода звука к слушателю за delay-линией.
  const dl = i.listener && i.listener > 0 ? i.listener : 10;
  const tMain = delayMs(distance + dl, i.temp);
  const tDelayNo = delayMs(dl, i.temp);
  const tDelaySet = tDelayNo + total;

  const inputs: CalcResult['inputs'] = i.geom
    ? [
        { label: 'Высота main (акуст. центр)', value: i.geom.mainH, unit: 'м', digits: 2 },
        { label: 'Высота delay (акуст. центр)', value: i.geom.delayH, unit: 'м', digits: 2 },
        { label: 'По горизонтали main → delay', value: i.geom.horiz, unit: 'м', digits: 2 },
      ]
    : [{ label: 'Расстояние от основного порта до delay d', value: distance, unit: 'м', digits: 2 }];
  inputs.push(
    { label: 'Температура воздуха T', value: i.temp, unit: '°C', digits: 0 },
    { label: 'Добавка (эффект предшествования) Δt', value: i.offset, unit: 'мс', digits: 1 },
    { label: 'Частота дискретизации f_д', value: i.sampleRate, unit: 'Гц', digits: 0 },
  );

  return {
    formulas: [
      ...(i.geom ? ['d = √(L_гор² + (h_main − h_delay)²)'] : []),
      'c = 331,3 + 0,606·T  (м/с)',
      't = d / c · 1000 + Δt  (мс)',
      'Отсчёты = t · f_д / 1000',
    ],
    inputs,
    results: [
      { label: 'Задержка для delay-линии', value: total, unit: 'мс', digits: 1, primary: true },
      { label: 'Время пробега звука', value: t, unit: 'мс', digits: 2 },
      ...(i.geom ? [{ label: 'Расстояние по прямой', value: distance, unit: 'м', digits: 2 }] : []),
      { label: 'Скорость звука', value: c, unit: 'м/с', digits: 1 },
      { label: 'В отсчётах', value: Math.round((total * i.sampleRate) / 1000), unit: 'отсч.', digits: 0 },
      { label: 'Рекомендуемый диапазон настройки', value: `${fx(t + 5, 1)}…${fx(t + 15, 1)}`, unit: 'мс' },
    ],
    explain: [
      `Звук от основной системы идёт до delay-линии ${fx(t, 1)} мс (${fx(distance, 1)} м при ${rn(i.temp)} °C). Если delay включить без задержки, слушатель за ней услышит её раньше main — получится «двойной» звук и эхо.`,
      `Поэтому delay задерживают на время пробега и ещё на ${rn(i.offset)} мс: тогда первым приходит звук main, а delay лишь усиливает его. Мозг определяет направление по первому пришедшему звуку (эффект предшествования, Хааса), и зрители «слышат» сцену, а не вышку.`,
      'Уровень delay в его зоне выставляют примерно равным main или чуть выше; если он громче более чем на ~10 дБ, звук «уходит» к delay даже с правильной задержкой.',
    ],
    tables: [{ title: 'Задержка при разной температуре (с добавкой)', head: ['Температура', 'c, м/с', 'Задержка, мс'], rows, mark: mark >= 0 ? mark : undefined }],
    figures: [{
      kind: 'timeline', title: `Когда звук приходит к слушателю в ${fx(dl, 0)} м за delay-линией`,
      span: Math.ceil((Math.max(tMain, tDelaySet) * 1.15) / 10) * 10,
      events: [
        { t: tDelayNo, label: 'delay без задержки (рано!)', tone: 'warn' },
        { t: tMain, label: 'main', tone: 'accent' },
        { t: tDelaySet, label: 'delay с задержкой', tone: 'ok' },
      ],
    }],
    limits: [
      'Линейная формула скорости звука точна до долей процента в диапазоне −20…+40 °C; влажность и ветер не учтены.',
      'Расстояние — по прямой от акустического центра основного порта до delay-линии (с учётом высоты подвеса).',
      'Добавка 5–15 мс обычно сохраняет локализацию на сцене (эффект Хааса); финальную настройку делают по измерению (например, по импульсной характеристике в зоне delay).',
      'Синхронизация точна только на линии main → delay; в стороне от неё разница хода другая.',
    ],
    warnings,
  };
}

export const delayTool: ToolDef = {
  id: 'delay',
  title: 'Задержка delay-линии',
  short: 'мс по расстоянию, высоте и температуре',
  fields: [
    { key: 'mode', label: 'Как задать расстояние', type: 'select', options: [{ value: 'direct', label: 'По прямой (измерено)' }, { value: 'geom', label: 'По горизонтали и высотам' }] },
    { key: 'distance', label: 'Расстояние до delay-линии', unit: 'м', type: 'number', step: 0.5, showIf: (v) => v.mode !== 'geom' },
    { key: 'horiz', label: 'По горизонтали main → delay', unit: 'м', type: 'number', step: 0.5, showIf: (v) => v.mode === 'geom' },
    { key: 'mainH', label: 'Высота main', unit: 'м', type: 'number', step: 0.5, showIf: (v) => v.mode === 'geom' },
    { key: 'delayH', label: 'Высота delay', unit: 'м', type: 'number', step: 0.5, showIf: (v) => v.mode === 'geom' },
    { key: 'temp', label: 'Температура воздуха', unit: '°C', type: 'number' },
    { key: 'offset', label: 'Добавка', unit: 'мс', type: 'number', step: 1, hint: 'Обычно 5–15 мс' },
    { key: 'listener', label: 'Слушатель за delay на', unit: 'м', type: 'number', hint: 'Для схемы прихода звука' },
    {
      key: 'sampleRate', label: 'Частота дискретизации', type: 'select',
      options: [{ value: '48000', label: '48 кГц' }, { value: '44100', label: '44,1 кГц' }, { value: '96000', label: '96 кГц' }],
    },
  ],
  defaults: { mode: 'direct', distance: '30', horiz: '30', mainH: '8', delayH: '5', temp: '20', offset: '10', listener: '10', sampleRate: '48000' },
  compute: (v) => delayLine({
    distance: num(v.distance), temp: num(v.temp), offset: num(v.offset), sampleRate: num(v.sampleRate) || 48000,
    geom: v.mode === 'geom' ? { mainH: num(v.mainH), delayH: num(v.delayH), horiz: num(v.horiz) } : undefined,
    listener: num(v.listener) || 10,
  }),
};

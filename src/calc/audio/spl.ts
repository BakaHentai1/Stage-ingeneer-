import { CalcResult, Figure, ToolDef, fail, lg, num, requireFinite, fx, rn } from '../types';
import { findGear, gearName, gearOptions, sourceLine, splPair } from './gear';

export type SumMode = 'incoherent' | 'coherent';

export interface SplInput {
  /** Чувствительность, дБ SPL (1 Вт / 1 м). Для активной модели не нужна. */
  sens: number;
  /** Подводимая длительная мощность, Вт. */
  power: number;
  /** Расстояние до слушателя, м. */
  distance: number;
  /** Количество одинаковых кабинетов, работающих на точку. */
  count: number;
  /** Суммирование нескольких кабинетов. */
  sum: SumMode;
  /** Модель распространения. */
  model: 'point' | 'line';
  /** Паспортный максимальный SPL одного кабинета на 1 м (0 — не задан). */
  maxSpl: number;
  /** Пик-фактор программы, дБ (пик над длительным уровнем). По умолчанию 6. */
  crest?: number;
  /** Активная модель: длительный и пиковый уровень на 1 м заданы напрямую. */
  direct?: { peak: number; cont: number; assumed: boolean };
  /** Линейный массив: длина, м, и частота, Гц, — для границы ближней зоны. */
  arrayLen?: number;
  freq?: number;
  /** Номинальная мощность AES пассивного кабинета (0 — не задана). */
  powerAes?: number;
  modelLabel?: string;
  notes?: string[];
}

/** Уровень одного кабинета на 1 м от мощности: L1 = S + 10·lg(P / 1 Вт). */
export function splAt1m(sens: number, power: number): number {
  return sens + 10 * lg(power);
}

/** Затухание с расстоянием относительно 1 м. */
export function distanceLoss(distance: number, model: 'point' | 'line' = 'point'): number {
  return (model === 'point' ? 20 : 10) * lg(distance);
}

/** Граница ближней зоны линейного массива (оценка): r_t = L²·f / (2·c). */
export function nearFieldLimit(len: number, freq: number, c = 343): number {
  return (len * len * freq) / (2 * c);
}

/** Затухание для массива: −3 дБ на удвоение до r_t, дальше −6 дБ. */
export function lineArrayLoss(distance: number, rt: number): number {
  if (rt <= 1) return 20 * lg(distance);
  if (distance <= rt) return 10 * lg(distance);
  return 10 * lg(rt) + 20 * lg(distance / rt);
}

/** Прибавка от N одинаковых источников. */
export function sumGain(count: number, sum: SumMode): number {
  return (sum === 'incoherent' ? 10 : 20) * lg(count);
}

export function splAtDistance(i: SplInput): CalcResult {
  const crest = i.crest ?? 6;
  const err = requireFinite([
    ...(i.direct ? [] : ([['Чувствительность', i.sens], ['Мощность', i.power]] as [string, number][])),
    ['Расстояние', i.distance],
    ['Количество', i.count],
    ['Пик-фактор', crest],
  ]);
  if (err) return fail(err);
  if (!i.direct && i.power <= 0) return fail('Мощность должна быть больше 0 Вт.');
  if (i.distance <= 0) return fail('Расстояние должно быть больше 0 м.');
  if (i.count < 1 || !Number.isInteger(i.count)) return fail('Количество кабинетов — целое число от 1.');
  if (crest < 0 || crest > 30) return fail('Пик-фактор — от 0 до 30 дБ.');

  const warnings: CalcResult['warnings'] = [];
  let cont: number, peak: number;
  const formulas: string[] = [];
  if (i.direct) {
    cont = i.direct.cont;
    peak = i.direct.peak;
    formulas.push('L₁ пик = паспортный max SPL;  L₁ длит = L₁ пик − пик-фактор (если длительный не указан)');
  } else {
    cont = splAt1m(i.sens, i.power);
    peak = cont + crest;
    formulas.push('L₁ длит = S + 10·lg(P / 1 Вт),  L₁ пик = L₁ длит + пик-фактор');
    if (i.powerAes && i.powerAes > 0 && i.power > i.powerAes) {
      warnings.push({ level: 'crit', text: `Длительная мощность ${rn(i.power)} Вт больше паспортной ${rn(i.powerAes)} Вт: кабинет перегреется. Расчётный уровень физически недостижим без риска повреждения.` });
    }
    if (i.maxSpl > 0 && cont > i.maxSpl) {
      warnings.push({
        level: 'warn',
        text: `При ${rn(i.power)} Вт расчётный уровень ${fx(cont, 1)} дБ выше паспортного максимума ${rn(i.maxSpl)} дБ. Взят паспортный максимум: колонка не выдаст больше, лишняя мощность приведёт к компрессии или перегрузке.`,
      });
      cont = i.maxSpl;
    }
    if (i.maxSpl > 0 && peak > i.maxSpl) {
      if (cont < i.maxSpl) warnings.push({ level: 'warn', text: `Пики (${fx(cont + crest, 1)} дБ на 1 м) упрутся в паспортный максимум ${rn(i.maxSpl)} дБ: на пиках сработает лимитер или будет клиппинг. Снизьте длительный уровень на ${fx(cont + crest - i.maxSpl, 1)} дБ.` });
      peak = i.maxSpl;
    }
  }

  const gain = sumGain(i.count, i.sum);
  const isLine = i.model === 'line';
  const rt = isLine && i.arrayLen && i.freq ? nearFieldLimit(i.arrayLen, i.freq) : 0;
  const lossOf = (r: number) => (isLine ? (rt > 0 ? lineArrayLoss(r, rt) : 10 * lg(r)) : 20 * lg(r));
  const loss = lossOf(i.distance);
  const lc = cont + gain - loss;
  const lp = peak + gain - loss;

  if (i.count > 1) formulas.push(`L₁ₙ = L₁ + ${i.sum === 'incoherent' ? 10 : 20}·lg(N)`);
  if (isLine && rt > 0) formulas.push('r_t = L_м² · f / (2c);  ΔL = 10·lg r до r_t, дальше 10·lg r_t + 20·lg(r / r_t)');
  else formulas.push(`L(r) = L₁${i.count > 1 ? 'ₙ' : ''} − ${isLine ? 10 : 20}·lg(r / 1 м)`);

  if (i.distance < 1) warnings.push({ level: 'info', text: 'Расстояние меньше 1 м: это ближняя зона, формула даёт лишь грубую оценку.' });
  if (i.count > 1 && i.sum === 'coherent') {
    warnings.push({ level: 'warn', text: 'Когерентное сложение (+6 дБ на удвоение) верно, только если кабинеты стоят ближе ¼ длины волны друг к другу и в фазе: для сабвуферов в кластере — да, для широкополосных кабинетов на средних и высоких частотах — нет. Для разнесённых кабинетов выберите энергетическое сложение.' });
  }
  if (isLine && !rt) warnings.push({ level: 'warn', text: 'Модель −3 дБ без границы ближней зоны завышает уровень вдали. Укажите длину массива и частоту.' });
  if (lc >= 100) {
    warnings.push({ level: 'warn', text: `Длительный уровень ${fx(lc, 1)} дБ — опасно для слуха при длительном воздействии. Соблюдайте нормы шумового воздействия на зрителей и персонал.` });
  }

  // График: уровень от расстояния.
  const rMax = Math.max(50, i.distance * 2);
  const pts = (l1: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let k = 0; k <= 60; k++) {
      const r = Math.pow(10, (k / 60) * lg(rMax));
      out.push([r, l1 + gain - lossOf(r)]);
    }
    return out;
  };
  const figures: Figure[] = [{
    kind: 'chart', title: 'Уровень в зависимости от расстояния',
    x: { label: 'расстояние, м', log: true, min: 1, max: rMax },
    y: { label: 'дБ SPL', min: Math.floor((cont + gain - lossOf(rMax) - 5) / 10) * 10, max: Math.ceil((peak + gain + 3) / 10) * 10 },
    series: [{ name: 'пиковый', pts: pts(peak), tone: 'crit', dash: true }, { name: 'длительный', pts: pts(cont), tone: 'accent' }],
    hlines: [{ y: 100, label: '100 дБ', tone: 'warn' }, { y: 85, label: '85 дБ', tone: 'muted' }],
    vlines: [{ x: i.distance, label: `${rn(i.distance)} м`, tone: 'ok' }, ...(rt > 1 ? [{ x: rt, label: 'граница ближней зоны', tone: 'muted' as const }] : [])],
  }];

  return {
    formulas,
    inputs: [
      ...(i.modelLabel ? [{ label: 'Модель', value: i.modelLabel }] : []),
      ...(i.direct ? [] : [
        { label: 'Чувствительность S', value: i.sens, unit: 'дБ (1 Вт/1 м)', digits: 1 },
        { label: 'Длительная мощность P', value: i.power, unit: 'Вт', digits: 0 },
      ]),
      { label: 'Расстояние r', value: i.distance, unit: 'м', digits: 1 },
      { label: 'Кабинетов N', value: i.count, digits: 0 },
      { label: 'Сложение', value: i.count === 1 ? 'один источник' : i.sum === 'incoherent' ? 'энергетич. +3 дБ / 2N' : 'в фазе +6 дБ / 2N' },
      { label: 'Затухание', value: isLine ? 'массив: −3, затем −6 дБ' : 'точечный: −6 дБ / 2r' },
      { label: 'Пик-фактор', value: crest, unit: 'дБ', digits: 1 },
      ...(i.maxSpl > 0 && !i.direct ? [{ label: 'Макс. SPL кабинета', value: i.maxSpl, unit: 'дБ', digits: 1 }] : []),
    ],
    results: [
      { label: 'Длительный уровень на r', value: lc, unit: 'дБ SPL', digits: 1, primary: true, level: lc >= 100 ? 'warn' : 'ok' },
      { label: 'Пиковый уровень на r', value: lp, unit: 'дБ SPL', digits: 1 },
      { label: 'Один кабинет на 1 м, длительный', value: cont, unit: 'дБ SPL', digits: 1 },
      { label: 'Один кабинет на 1 м, пиковый', value: peak, unit: 'дБ SPL', digits: 1 },
      { label: 'Прибавка от N кабинетов', value: gain, unit: 'дБ', digits: 1 },
      { label: 'Затухание до r', value: loss, unit: 'дБ', digits: 1 },
      ...(rt > 0 ? [{ label: 'Граница ближней зоны массива', value: rt, unit: 'м', digits: 1 }] : []),
    ],
    explain: [
      `Каждое удвоение расстояния снимает 6 дБ (у линейного массива вблизи — 3 дБ). До ${rn(i.distance)} м теряется ${fx(loss, 1)} дБ.`,
      `Длительный уровень — то, что кабинет держит долго (${fx(lc, 1)} дБ на месте слушателя). Пиковый — кратковременные удары барабана и всплески (${fx(lp, 1)} дБ). Пики не должны упираться в паспортный максимум.`,
      i.count > 1 ? (i.sum === 'incoherent' ? `${i.count} разнесённых кабинета складываются по энергии: +${fx(gain, 1)} дБ.` : `${i.count} кабинета вплотную и в фазе: +${fx(gain, 1)} дБ.`) : 'Для нескольких кабинетов укажите количество и способ сложения.',
    ],
    figures,
    limits: [
      'Свободное поле: отражения и реверберация помещения не учитываются, в зале реальный уровень на дальних местах будет выше.',
      'Точечная модель верна в дальней зоне (обычно дальше 2–3 размеров кабинета).',
      'Граница ближней зоны линейного массива — оценка r ≈ L²·f / (2c) для одной частоты (в литературе коэффициент от ½ до 3/2); на НЧ она ближе, на ВЧ дальше. Массив с изогнутой (J) формой ведёт себя иначе.',
      'Когерентное суммирование (+6 дБ) — только для близко стоящих кабинетов в фазе и на низких частотах. Для разнесённых кабинетов используйте энергетическое.',
      'Поглощение звука воздухом на высоких частотах не учтено (на 50 м и 8 кГц это несколько дБ).',
      'Если производитель не указал, пиковый или длительный max SPL, значение считается пиковым, длительный — ниже на пик-фактор. Это допущение.',
      ...(i.notes ?? []),
    ],
    warnings,
  };
}

export const splTool: ToolDef = {
  id: 'spl',
  title: 'SPL на дистанции',
  short: 'пиковый и длительный уровень, график',
  fields: [
    { key: 'gear', label: 'Акустика', type: 'select', optionsFn: () => gearOptions(['point', 'line', 'sub'], 'Пассивная, ввести вручную') },
    { key: 'sens', label: 'Чувствительность', unit: 'дБ 1 Вт/1 м', type: 'number', step: 0.5, showIf: (v) => v.gear === 'manual' },
    { key: 'power', label: 'Длительная мощность на кабинет', unit: 'Вт', type: 'number', min: 0, showIf: (v) => v.gear === 'manual' || findGear(v.gear)?.active === false },
    { key: 'maxSpl', label: 'Макс. SPL кабинета', unit: 'дБ, 0 = нет', type: 'number', min: 0, showIf: (v) => v.gear === 'manual' },
    { key: 'distance', label: 'Расстояние', unit: 'м', type: 'number', min: 0, step: 0.5 },
    { key: 'count', label: 'Кабинетов', unit: 'шт', type: 'number', min: 1, step: 1 },
    {
      key: 'sum', label: 'Сложение кабинетов', type: 'select',
      options: [
        { value: 'incoherent', label: 'Энергетическое, разнесённые (+3 дБ)' },
        { value: 'coherent', label: 'В фазе, вплотную, НЧ (+6 дБ)' },
      ],
      showIf: (v) => Number(v.count) > 1,
    },
    {
      key: 'model', label: 'Модель источника', type: 'select',
      options: [
        { value: 'point', label: 'Точечный (−6 дБ)' },
        { value: 'line', label: 'Линейный массив (−3 дБ вблизи)' },
      ],
    },
    { key: 'arrayLen', label: 'Длина массива', unit: 'м', type: 'number', step: 0.1, showIf: (v) => v.model === 'line' },
    { key: 'freq', label: 'Частота для ближней зоны', unit: 'Гц', type: 'number', showIf: (v) => v.model === 'line' },
    { key: 'crest', label: 'Пик-фактор программы', unit: 'дБ', type: 'number', hint: 'Речь ≈ 10–12, сжатая поп-музыка ≈ 6–8, живой рок 12–15' },
  ],
  defaults: { gear: 'manual', sens: '98', power: '500', distance: '20', count: '1', sum: 'incoherent', model: 'point', maxSpl: '0', crest: '6', arrayLen: '2.4', freq: '1000' },
  compute: (v) => {
    const g = v.gear && v.gear !== 'manual' ? findGear(v.gear) : undefined;
    const crest = Number.isFinite(num(v.crest)) ? num(v.crest) : 6;
    const common = {
      distance: num(v.distance), count: num(v.count), sum: (v.sum === 'coherent' ? 'coherent' : 'incoherent') as SumMode,
      model: (v.model === 'line' ? 'line' : 'point') as 'point' | 'line', crest, arrayLen: num(v.arrayLen) || 0, freq: num(v.freq) || 0,
    };
    if (g && g.active) {
      return splAtDistance({ ...common, sens: NaN, power: NaN, maxSpl: g.maxSpl, direct: splPair(g, crest), modelLabel: gearName(g), notes: [sourceLine(g), ...g.notes] });
    }
    return splAtDistance({
      ...common, sens: g?.sens ?? num(v.sens), power: num(v.power), maxSpl: g ? (g.maxSplKind === 'cont' ? 0 : g.maxSpl) : num(v.maxSpl) || 0,
      powerAes: g?.powerAes ?? 0, modelLabel: g ? gearName(g) : undefined, notes: g ? [sourceLine(g)] : [],
    });
  },
};

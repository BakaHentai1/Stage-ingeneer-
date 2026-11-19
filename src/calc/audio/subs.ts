import { CalcResult, CalcTable, CalcWarning, Figure, ToolDef, fail, lg, num, requireFinite, fx, rn } from '../types';
import { findGear, gearName, gearOptions, sourceLine, splPair } from './gear';
import { speedOfSound } from './delay';

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

/**
 * Сколько сабвуферов нужно, чтобы их суммарный пиковый уровень был не ниже уровня Main PA плюс «подъём НЧ».
 * Обе системы считаются одинаково (в фазе, из одной точки), поэтому расстояние сокращается:
 * N_саб = ⌈N_топ · 10^((L_топ − L_саб + B) / 20)⌉.
 */
export function subsForMain(topSpl: number, nTop: number, subSpl: number, boost: number): number {
  return Math.max(1, Math.ceil(nTop * Math.pow(10, (topSpl - subSpl + boost) / 20) - 1e-9));
}

/** Расстояние от оси до первого провала между L/R стеками на частоте f: y ≈ λ·r / (2·D) (дальняя зона). */
export function powerAlleyNull(f: number, r: number, spacing: number, c = 343): number {
  return ((c / f) * r) / (2 * spacing);
}

export type SubLayout = 'center' | 'lr' | 'cardioid' | 'endfire' | 'arc';

export const LAYOUT_LABEL: Record<SubLayout, string> = {
  center: 'Кластер по центру',
  lr: 'Два стека L/R',
  cardioid: 'Кардиоидный стек (1 из 3 развернут назад)',
  endfire: 'End-fire (ряды друг за другом)',
  arc: 'Дуга с задержками',
};

export interface SubsFullInput extends SubsInput {
  layout: SubLayout;
  /** Нижняя частота, где сабвуферы должны работать, Гц (для λ). */
  freq: number;
  /** Расстояние между L/R стеками, м. */
  spacing: number;
  /** Глубина корпуса, м (для кардиоиды). */
  depth: number;
  width: number;
  weight: number;
  fLow: number;
  temp: number;
  maxStack: number;
  /** Main PA: пиковый SPL модуля, число модулей всего, подъём НЧ над Main PA. 0 — не учитывать. */
  topSpl: number;
  nTop: number;
  boost: number;
  modelLabel: string;
  notes: string[];
}

export function subwoofers(i: SubsInput): CalcResult {
  return subwoofersFull({
    ...i, layout: 'center', freq: 60, spacing: 10, depth: 0.7, width: 1.1, weight: 0, fLow: 0, temp: 20, maxStack: 3,
    topSpl: 0, nTop: 0, boost: 0, modelLabel: 'вручную', notes: [],
  });
}

export function subwoofersFull(i: SubsFullInput): CalcResult {
  const err = requireFinite([
    ['Макс. SPL', i.maxSpl], ['Нужный уровень', i.target], ['Расстояние', i.distance], ['Запас', i.headroom],
  ]);
  if (err) return fail(err);
  if (i.distance <= 0) return fail('Расстояние должно быть больше 0 м.');
  if (i.headroom < 0) return fail('Запас не может быть отрицательным.');
  if (!(i.freq > 0)) return fail('Укажите частоту больше 0 Гц.');

  const loss = 20 * lg(i.distance);
  const nCoh = subsCount(i.maxSpl, i.target, i.distance, i.headroom, 20);
  const nInc = subsCount(i.maxSpl, i.target, i.distance, i.headroom, 10);
  const useMain = i.topSpl > 0 && i.nTop > 0;
  const nMain = useMain ? subsForMain(i.topSpl, i.nTop, i.maxSpl, i.boost) : 0;
  // Кардиоида: на каждые 2 вперёд — 1 назад; задний частично гасит передние, прибавка вперёд меньше. Берём осторожно: считаем только передние.
  const nLevel = Math.max(nCoh, nMain);
  let n = nLevel;
  if (i.layout === 'lr' && n % 2) n++;
  if (i.layout === 'cardioid') n = Math.ceil(nLevel / 2) * 3;
  if (i.layout === 'endfire') n = Math.max(2, n);
  const nFront = i.layout === 'cardioid' ? (n / 3) * 2 : n;
  const levelCoh = i.maxSpl + 20 * lg(nFront) - loss;
  const c = speedOfSound(i.temp);
  const lambda = c / i.freq;
  const warnings: CalcWarning[] = [];
  const tables: CalcTable[] = [];
  const figures: Figure[] = [];
  const formulas = [
    'N = ⌈10^((L + H + 20·lg r − L₁) / 20)⌉   (когерентно, связанный кластер)',
    'N = ⌈10^((L + H + 20·lg r − L₁) / 10)⌉   (некогерентно, оценка сверху)',
    'L(r) = L₁ + 20·lg N − 20·lg r',
  ];
  if (useMain) formulas.push('N_саб = ⌈N_топ · 10^((L_топ − L_саб + B) / 20)⌉  (баланс с Main PA)');
  formulas.push('λ = c / f,  c = 331,3 + 0,606·T');

  if (nLevel > 16) warnings.push({ level: 'warn', text: 'Требуется очень много сабвуферов: проверьте исходные данные или уменьшите требования.' });
  if (i.fLow > 0 && i.freq < i.fLow) {
    warnings.push({ level: 'warn', text: `Частота ${rn(i.freq)} Гц ниже нижней границы модели (${rn(i.fLow)} Гц): там уровень будет заметно меньше паспортного.` });
  }

  // Варианты размещения: параметры для каждого.
  const placeRows: CalcTable['rows'] = [];
  const stackCount = (k: number) => Math.ceil(k / Math.max(1, i.maxStack));
  const lr = Math.ceil(nLevel / 2) * 2;
  const yNull = powerAlleyNull(i.freq, i.distance, i.spacing, c);
  placeRows.push(['Кластер по центру', nLevel, 'Ровно по ширине зала, один источник', 'Нужен проход для кабелей и место по центру сцены']);
  placeRows.push(['Два стека L/R', lr, `Прибавка по оси зала, провалы через ≈ ${fx(yNull, 1)} м от оси на ${rn(i.freq)} Гц`, 'Неравномерно по ширине («power alley»)']);
  placeRows.push(['Кардиоида (2 вперёд + 1 назад)', Math.ceil(nLevel / 2) * 3, `Задний: инверсия полярности, задержка ${fx((i.depth / c) * 1000, 2)} мс`, 'Меньше НЧ на сцене; +50 % корпусов']);
  placeRows.push(['End-fire, 2 ряда', Math.max(2, nLevel), `Шаг рядов λ/4 = ${fx(lambda / 4, 2)} м, задержка ${fx((lambda / 4 / c) * 1000, 2)} мс на ряд`, 'Узкая полоса частот подавления; нужна глубина сцены']);
  placeRows.push(['Дуга с задержками', nLevel, 'Шире покрытие, чем у прямого ряда', 'Задержки считаются по геометрии дуги']);
  const markIdx = ['center', 'lr', 'cardioid', 'endfire', 'arc'].indexOf(i.layout);
  tables.push({ title: 'Варианты размещения', head: ['Вариант', 'Сабвуферов', 'Что даёт', 'Минусы'], rows: placeRows, mark: markIdx });

  // Схема выбранного варианта (вид сверху).
  const roomW = Math.max(i.spacing + 6, 16), roomD = Math.max(i.distance * 1.1, 10);
  const subsSrc: Extract<Figure, { kind: 'plan' }>['sources'] = [];
  const lines: Extract<Figure, { kind: 'plan' }>['lines'] = [];
  const marks: Extract<Figure, { kind: 'plan' }>['marks'] = [];
  const w = i.width > 0 ? i.width : 1;
  if (i.layout === 'lr') {
    for (const s of [-1, 1]) subsSrc.push({ p: { x: (s * i.spacing) / 2, y: 0.4 }, aim: 0, spread: 0, label: `${n / 2} шт`, tone: 'sub' });
    // Провалы первого и второго порядка (разность хода λ/2 и 3λ/2), по дальней зоне.
    for (const k of [1, 3]) {
      for (const s of [-1, 1]) {
        const pts = [2, roomD].map((r) => ({ x: (s * k * lambda * r) / (2 * i.spacing), y: r }));
        lines.push({ a: pts[0], b: pts[1], tone: 'crit', label: s > 0 && k === 1 ? `провал ${rn(i.freq)} Гц` : undefined });
      }
    }
    lines.push({ a: { x: 0, y: 1 }, b: { x: 0, y: roomD }, tone: 'ok', label: 'прибавка' });
  } else if (i.layout === 'endfire') {
    const step = lambda / 4;
    const rowsN = 2;
    const per = Math.ceil(n / rowsN);
    for (let r = 0; r < rowsN; r++) for (let k = 0; k < per; k++) subsSrc.push({ p: { x: (k - (per - 1) / 2) * w, y: 0.4 + r * step }, aim: 0, spread: 0, label: k === 0 ? `ряд ${r + 1}` : '', tone: 'sub' });
  } else if (i.layout === 'arc') {
    const span = Math.min(90, 15 * n);
    const radius = Math.max(2, (n * w) / ((span * Math.PI) / 180));
    for (let k = 0; k < n; k++) {
      const a = ((-span / 2 + (n === 1 ? span / 2 : (k * span) / (n - 1))) * Math.PI) / 180;
      subsSrc.push({ p: { x: radius * Math.sin(a), y: 0.4 + radius * (1 - Math.cos(a)) }, aim: 0, spread: 0, label: '', tone: 'sub' });
    }
    marks.push({ p: { x: 0, y: 0.4 }, text: `дуга R ≈ ${fx(radius, 1)} м` });
  } else {
    const front = i.layout === 'cardioid' ? n / 3 * 2 : n;
    for (let k = 0; k < front; k++) subsSrc.push({ p: { x: (k - (front - 1) / 2) * w, y: 0.6 }, aim: 0, spread: 0, label: '', tone: 'sub' });
    if (i.layout === 'cardioid') {
      for (let k = 0; k < n / 3; k++) subsSrc.push({ p: { x: (k * 2 + 0.5 - (front - 1) / 2) * w, y: 0.6 - Math.max(i.depth, 0.5) }, aim: 180, spread: 0, label: k === 0 ? 'назад' : '', tone: 'fill' });
    }
  }
  marks.push({ p: { x: 0, y: i.distance }, text: `слушатель, ${fx(levelCoh, 0)} дБ` });
  figures.push({ kind: 'plan', title: `Вид сверху: ${LAYOUT_LABEL[i.layout]}`, room: { w: roomW, d: roomD }, sources: subsSrc, lines, marks });

  // Уровень от числа сабвуферов (кластер, в фазе) на расстоянии r.
  const pts: [number, number][] = [];
  for (let k = 1; k <= Math.max(8, nLevel + 4); k++) pts.push([k, i.maxSpl + 20 * lg(k) - loss]);
  figures.push({
    kind: 'chart', title: `Уровень НЧ на ${rn(i.distance)} м от числа сабвуферов (в фазе, кластер)`,
    x: { label: 'сабвуферов, шт', min: 1, max: pts.length }, y: { label: 'дБ SPL', min: Math.floor(pts[0][1] - 3), max: Math.ceil(pts[pts.length - 1][1] + 3) },
    series: [{ name: 'L(r)', pts, tone: 'accent' }],
    hlines: [{ y: i.target + i.headroom, label: 'цель + запас', tone: 'warn' }],
  });

  if (i.layout === 'lr') {
    warnings.push({ level: 'warn', text: `Стеки L/R в ${rn(i.spacing)} м друг от друга: на ${rn(i.freq)} Гц первый провал примерно в ${fx(yNull, 1)} м от оси зала (на расстоянии ${rn(i.distance)} м). Для ровного НЧ по ширине лучше кластер по центру.` });
  }
  if (i.layout === 'cardioid') {
    warnings.push({ level: 'info', text: `Кардиоида: развернутый назад сабвуфер включается с инверсией полярности и задержкой ≈ ${fx((i.depth / c) * 1000, 2)} мс (глубина корпуса ${fx(i.depth, 2)} м / скорость звука). У RCF SUB 8006-AS есть готовые кардиоидные режимы — используйте их по руководству.` });
  }
  if (i.layout === 'endfire') {
    warnings.push({ level: 'info', text: `End-fire: задний ряд впереди по времени. Задний ряд задерживают на ${fx((lambda / 4 / c) * 1000, 2)} мс относительно переднего, ряды ставят с шагом ${fx(lambda / 4, 2)} м (¼ длины волны на ${rn(i.freq)} Гц).` });
  }
  const stacks = i.layout === 'lr' ? 2 * stackCount(n / 2) : stackCount(n);
  if (i.weight > 0) {
    warnings.push({ level: 'warn', text: `Вес сабвуферов ${fx(n * i.weight, 0)} кг (${n} × ${fx(i.weight, 1)} кг). Проверьте несущую способность сцены или пола; стек выше ${i.maxStack} шт — только если это разрешает производитель, с фиксацией. Подвес сабвуферов — только на штатном такелаже и после проверки специалистом.` });
  } else if (nLevel >= 4) {
    warnings.push({ level: 'warn', text: 'Стек из нескольких сабвуферов: проверьте устойчивость, крепление и несущую способность пола или сцены. Подвес сабвуферов — только на сертифицированном оборудовании и после проверки специалистом.' });
  }

  const inputs: CalcResult['inputs'] = [
    { label: 'Модель', value: i.modelLabel },
    { label: 'Макс. SPL сабвуфера L₁ (1 м)', value: i.maxSpl, unit: 'дБ', digits: 1 },
    { label: 'Нужный уровень НЧ L', value: i.target, unit: 'дБ SPL', digits: 1 },
    { label: 'Расстояние r', value: i.distance, unit: 'м', digits: 1 },
    { label: 'Запас H', value: i.headroom, unit: 'дБ', digits: 1 },
    { label: 'Размещение', value: LAYOUT_LABEL[i.layout] },
    { label: 'Расчётная частота f', value: i.freq, unit: 'Гц', digits: 0 },
  ];
  if (useMain) {
    inputs.push(
      { label: 'Main PA: пиковый SPL модуля L_топ', value: i.topSpl, unit: 'дБ', digits: 1 },
      { label: 'Main PA: модулей всего N_топ', value: i.nTop, digits: 0 },
      { label: 'Подъём НЧ над Main PA B', value: i.boost, unit: 'дБ', digits: 1 },
    );
  }

  const results: CalcResult['results'] = [
    { label: 'Сабвуферов для выбранного размещения', value: n, unit: 'шт', digits: 0, primary: true },
    { label: 'По нужному уровню (кластер)', value: nCoh, unit: 'шт', digits: 0 },
    { label: 'Если разнесены (некогерентно)', value: nInc, unit: 'шт', digits: 0 },
  ];
  if (useMain) {
    results.push({ label: 'По балансу с Main PA', value: nMain, unit: 'шт', digits: 0 });
    results.push({ label: 'Соотношение сабы : модули Main PA', value: `${n} : ${i.nTop}` });
  }
  results.push(
    { label: 'Уровень на r (работают вперёд)', value: levelCoh, unit: 'дБ SPL', digits: 1 },
    { label: 'Затухание до r', value: loss, unit: 'дБ', digits: 1 },
    { label: 'Длина волны на f', value: lambda, unit: 'м', digits: 2 },
    { label: 'Стеков (по ' + i.maxStack + ' шт)', value: stacks, unit: 'шт', digits: 0 },
  );
  if (i.weight > 0) results.push({ label: 'Общий вес', value: n * i.weight, unit: 'кг', digits: 0 });

  return {
    formulas,
    inputs,
    results,
    explain: [
      `Чтобы на ${rn(i.distance)} м было ${rn(i.target)} дБ НЧ с запасом ${rn(i.headroom)} дБ, нужно сабвуферов, стоящих вплотную: ${nCoh} шт (в фазе они дают +6 дБ на каждое удвоение).`,
      useMain
        ? `Чтобы НЧ не «проваливался» относительно Main PA (${i.nTop} модулей) и был на ${rn(i.boost)} дБ громче, нужно сабвуферов: ${nMain} шт. Берём большее из двух.`
        : 'Можно также указать Main PA — тогда количество подберётся и по балансу с основной системой.',
      'Длина волны на низких частотах — метры, поэтому расстановка сабвуферов меняет картину по залу сильнее, чем их количество.',
    ],
    tables,
    figures,
    limits: [
      'Когерентное сложение (+6 дБ на удвоение) работает, когда сабвуферы стоят вплотную в одной точке и в фазе (расстояние между центрами меньше ~¼ длины волны: 0,85 м на 100 Гц).',
      'Разнесённые левый и правый стеки дают интерференцию («power alley»): по центру прибавка, в других местах провалы. Положение провалов посчитано для дальней зоны (r ≫ D).',
      'Баланс с Main PA считается по паспортным максимумам обеих систем в одинаковых условиях; это ориентир, а не прогноз: итоговый баланс настраивается по измерению и на слух.',
      'Кардиоида и end-fire подавляют НЧ назад только в полосе частот около расчётной; величину подавления смотрите в документации производителя и проверяйте измерением.',
      'Используется паспортный максимальный SPL; для долгой работы берите уровень на 3–6 дБ ниже пикового значения из паспорта.',
      'Влияние пола и стен (полупространство) уже входит в паспортное значение, если оно измерено на земле. Комната на НЧ может добавить или убрать до 10 дБ.',
      ...i.notes,
    ],
    warnings,
  };
}

export const subsTool: ToolDef = {
  id: 'subs',
  title: 'Количество сабвуферов',
  short: 'по уровню НЧ и Main PA, размещение',
  fields: [
    { key: 'model', label: 'Сабвуфер', type: 'select', optionsFn: () => gearOptions(['sub']) },
    { key: 'maxSpl', label: 'Макс. SPL сабвуфера на 1 м', unit: 'дБ', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'weight', label: 'Вес сабвуфера', unit: 'кг', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'depth', label: 'Глубина корпуса', unit: 'мм', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'target', label: 'Нужный уровень НЧ', unit: 'дБ SPL', type: 'number', hint: 'Речь 95–100, рок 110–115, EDM 120+' },
    { key: 'distance', label: 'Расстояние до слушателя', unit: 'м', type: 'number', step: 0.5 },
    { key: 'headroom', label: 'Запас', unit: 'дБ', type: 'number', step: 1 },
    { key: 'top', label: 'Main PA', type: 'select', optionsFn: () => [{ value: 'none', label: 'Не учитывать' }, ...gearOptions(['line', 'point']).filter((o) => o.value !== 'manual')] },
    { key: 'nTop', label: 'Модулей Main PA всего', unit: 'шт', type: 'number', step: 1, showIf: (v) => v.top !== 'none' },
    { key: 'boost', label: 'НЧ громче Main PA на', unit: 'дБ', type: 'number', showIf: (v) => v.top !== 'none', hint: '0 речь, +6 поп/рок, +10 EDM' },
    {
      key: 'layout', label: 'Размещение', type: 'select',
      options: (Object.keys(LAYOUT_LABEL) as SubLayout[]).map((k) => ({ value: k, label: LAYOUT_LABEL[k] })),
    },
    { key: 'freq', label: 'Расчётная частота', unit: 'Гц', type: 'number', hint: 'Для провалов, кардиоиды и end-fire' },
    { key: 'spacing', label: 'Между стеками L/R', unit: 'м', type: 'number', showIf: (v) => v.layout === 'lr' },
    { key: 'maxStack', label: 'Сабвуферов в одном стеке', unit: 'шт', type: 'number', step: 1 },
    { key: 'temp', label: 'Температура воздуха', unit: '°C', type: 'number' },
  ],
  defaults: {
    model: 'rcf-sub8006as', maxSpl: '131', weight: '60', depth: '700', target: '110', distance: '25', headroom: '3',
    top: 'none', nTop: '12', boost: '6', layout: 'center', freq: '63', spacing: '12', maxStack: '2', temp: '20',
  },
  compute: (v) => {
    const m = v.model === 'manual' ? undefined : findGear(v.model);
    if (v.model !== 'manual' && (!m || m.kind !== 'sub')) return fail('Выберите сабвуфер из базы или «Ввести вручную».');
    const top = v.top && v.top !== 'none' ? findGear(v.top) : undefined;
    const layout = (v.layout in LAYOUT_LABEL ? v.layout : 'center') as SubLayout;
    const notes = m ? [sourceLine(m), ...m.notes] : [];
    if (top) notes.push(sourceLine(top));
    return subwoofersFull({
      maxSpl: m ? splPair(m, 0).peak : num(v.maxSpl), target: num(v.target), distance: num(v.distance), headroom: num(v.headroom),
      layout, freq: num(v.freq), spacing: num(v.spacing) || 10, depth: m ? m.dims[2] / 1000 : (num(v.depth) || 0) / 1000,
      width: m ? m.dims[1] / 1000 : 1, weight: m ? m.weight : num(v.weight) || 0, fLow: m?.fLow ?? 0, temp: Number.isFinite(num(v.temp)) ? num(v.temp) : 20,
      maxStack: Math.max(1, Math.round(num(v.maxStack) || 1)),
      topSpl: top ? splPair(top, 0).peak : 0, nTop: top ? Math.max(0, Math.round(num(v.nTop) || 0)) : 0, boost: num(v.boost) || 0,
      modelLabel: m ? gearName(m) : 'вручную', notes,
    });
  },
};

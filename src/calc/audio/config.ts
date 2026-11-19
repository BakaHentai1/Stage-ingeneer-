import { CalcResult, CalcTable, CalcWarning, Figure, Pt, ToolDef, Values, fail, lg, num, requireFinite, fx, rn } from '../types';
import { deg, rad } from './coverage';
import { findGear, gearName, gearOptions, sourceLine, splPair } from './gear';

/** Скорость звука при 20 °C, м/с (для оценки контроля направленности массива). */
export const C20 = 343;

const RIG_WARN =
  'Подвес линейного массива и установка кабинетов на стеки — только на штатном такелаже производителя, по проекту и после проверки нагрузки на точки подвеса и конструкции специалистом. Конфигурацию проверьте в ПО производителя (для RCF — RCF Shape Designer).';

/* ======================= Точечные кабинеты: L/R порталы ======================= */

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

/** Схема порталов сверху: кабинеты каждого портала веером от боковой стены до оси зала. */
export function portalPlan(i: ConfigInput, nSide: number): Figure {
  const sources: Extract<Figure, { kind: 'plan' }>['sources'] = [];
  const aWall = deg(Math.atan((i.roomWidth / 2 - i.offset) / i.dFirst));
  const aCenter = deg(Math.atan(i.offset / i.dFirst));
  const span = aWall + aCenter;
  for (const side of [-1, 1]) {
    for (let k = 0; k < nSide; k++) {
      // Для правого портала: от −aCenter (к оси) до +aWall (к стене); левый — зеркально.
      const a = -aCenter + ((k + 0.5) * span) / nSide;
      sources.push({ p: { x: side * i.offset, y: 0 }, aim: side * a, spread: i.hAngle, label: k === 0 ? (side < 0 ? 'L' : 'R') : '' });
    }
  }
  return {
    kind: 'plan', title: 'Вид сверху: порталы и направление кабинетов', room: { w: i.roomWidth, d: i.dLast * 1.05 }, sources,
    lines: [
      { a: { x: -i.roomWidth / 2, y: i.dFirst }, b: { x: i.roomWidth / 2, y: i.dFirst }, tone: 'muted', label: 'первый ряд' },
      { a: { x: -i.roomWidth / 2, y: i.dLast }, b: { x: i.roomWidth / 2, y: i.dLast }, tone: 'muted', label: 'последний ряд' },
    ],
  };
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
      { label: 'Длительный SPL кабинета L₁ (1 м)', value: i.maxSpl, unit: 'дБ', digits: 1 },
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
    explain: [
      `Каждый портал должен «осветить» свою половину зала — это угол ${fx(span, 0)}°. Один кабинет закрывает ${rn(i.hAngle)}°, поэтому на портал нужно ${nSide} шт.`,
      `До самого дальнего места ${fx(rFar, 1)} м: уровень падает на 6 дБ при каждом удвоении расстояния и составит около ${fx(lFar, 1)} дБ.`,
    ],
    figures: [portalPlan(i, nSide)],
    limits: [
      'Модель для схемы «левый и правый портал из точечных кабинетов». Для линейного массива выберите режим «Линейный массив».',
      'Каждый портал закрывает свою половину зала; в центре порталы перекрываются и дают до +3 дБ, это в расчёт уровня не включено (оценка снизу).',
      'Уровень — по закону обратных квадратов в свободном поле; отражения зала его повышают, направленность кабинета вне оси снижает.',
      'Расстояния считаются в горизонтальной плоскости; высота подвеса не учтена (см. расчёт покрытия).',
      'Сабвуферы считаются отдельно.',
    ],
    warnings,
  };
}

/* ======================= Линейный массив ======================= */

export interface ArrayInput {
  /** Высота верхней точки массива (низ рамы), м. */
  trimH: number;
  earH: number;
  dNear: number;
  dFar: number;
  /** Высота и глубина модуля, м. */
  boxH: number;
  boxD: number;
  /** Вертикальный угол одного модуля по паспорту, ° (для справки). */
  vAngle: number;
  hAngle: number;
  /** Длительный SPL модуля на 1 м, дБ. */
  contSpl: number;
  peakSpl: number;
  target: number;
  /** 0 — подобрать автоматически. */
  count: number;
  maxSplay: number;
  splayStep: number;
  /** Нижняя частота, до которой массив должен держать направленность по вертикали, Гц (0 — не учитывать). */
  fCtrl: number;
  maxFlown: number;
  weight: number;
  barWeight: number;
  roomWidth: number;
  offset: number;
}

export interface ArrayBox {
  /** Центр передней грани модуля. */
  c: Pt;
  /** Наклон оси вниз от горизонтали, °. */
  tilt: number;
  /** Куда ось попадает на уровне ушей (горизонтальная дальность, м), Infinity — не попадает. */
  hit: number;
  /** Угол между этим и следующим модулем, °. */
  splay: number;
}

/**
 * Геометрия массива: модули висят цепочкой. Передняя грань модуля i идёт от точки p_i
 * вниз-назад в направлении (−sin t, −cos t), где t — наклон оси вниз.
 */
export function arrayGeometry(trimH: number, boxH: number, earH: number, tilts: number[]): ArrayBox[] {
  let p: Pt = { x: 0, y: trimH };
  return tilts.map((t, i) => {
    const tr = rad(t);
    const face = { x: -Math.sin(tr), y: -Math.cos(tr) };
    const c = { x: p.x + (face.x * boxH) / 2, y: p.y + (face.y * boxH) / 2 };
    p = { x: p.x + face.x * boxH, y: p.y + face.y * boxH };
    const dh = c.y - earH;
    const hit = t > 0 && dh > 0 ? c.x + dh / Math.tan(tr) : Infinity;
    return { c, tilt: t, hit, splay: i < tilts.length - 1 ? tilts[i + 1] - t : 0 };
  });
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Подбор углов: ось верхнего модуля — на последний ряд, нижнего — на первый,
 * промежуточные — на точки с геометрическим шагом по дальности (массив в форме «J»).
 * Углы между модулями округляются до шага рамы и ограничиваются максимумом.
 */
export function designSplays(n: number, trimH: number, boxH: number, earH: number, dNear: number, dFar: number, maxSplay: number, step: number) {
  const targets = Array.from({ length: n }, (_, i) => (n === 1 ? dFar : dFar * Math.pow(dNear / dFar, i / (n - 1))));
  // Идеальные наклоны с учётом смещения центров модулей вниз по цепочке.
  const ideal: number[] = [];
  let p: Pt = { x: 0, y: trimH };
  for (let i = 0; i < n; i++) {
    let t = 0;
    for (let it = 0; it < 4; it++) {
      const tr = rad(t);
      const c = { x: p.x - (Math.sin(tr) * boxH) / 2, y: p.y - (Math.cos(tr) * boxH) / 2 };
      t = deg(Math.atan2(c.y - earH, targets[i] - c.x));
    }
    ideal.push(t);
    const tr = rad(t);
    p = { x: p.x - Math.sin(tr) * boxH, y: p.y - Math.cos(tr) * boxH };
  }
  const top = roundTo(ideal[0], 0.5);
  const splays: number[] = [];
  let clamped = 0;
  let acc = top;
  for (let i = 1; i < n; i++) {
    let s = roundTo(ideal[i] - acc, step);
    if (s > maxSplay) { s = maxSplay; clamped++; }
    if (s < 0) s = 0;
    splays.push(s);
    acc += s;
  }
  const tilts = [top];
  splays.forEach((s) => tilts.push(tilts[tilts.length - 1] + s));
  return { tilts, splays, ideal, clamped, targets };
}

/** Оценка уровня в точке r от N модулей: энергетически (нижняя) и в фазе (верхняя граница). */
export function arrayLevel(l1: number, n: number, r: number) {
  return { low: l1 + 10 * lg(n) - 20 * lg(r), high: l1 + 20 * lg(n) - 20 * lg(r) };
}

export function lineArray(i: ArrayInput, modelLabel: string, modelNotes: string[]): CalcResult {
  const err = requireFinite([
    ['Высота подвеса', i.trimH], ['Высота ушей', i.earH], ['До первого ряда', i.dNear], ['До последнего ряда', i.dFar],
    ['Высота модуля', i.boxH], ['Глубина модуля', i.boxD], ['SPL модуля', i.contSpl], ['Нужный уровень', i.target],
    ['Число модулей', i.count], ['Макс. угол', i.maxSplay], ['Шаг угла', i.splayStep], ['Вес модуля', i.weight],
  ]);
  if (err) return fail(err);
  if (i.dNear <= 0 || i.dFar <= i.dNear) return fail('Последний ряд должен быть дальше первого, оба расстояния больше 0.');
  if (i.trimH <= i.earH) return fail('Массив должен висеть выше уровня ушей.');
  if (i.boxH <= 0 || i.boxD <= 0) return fail('Размеры модуля должны быть больше 0.');
  if (i.maxSplay <= 0 || i.maxSplay > 20) return fail('Максимальный угол между модулями — от 0,5 до 20°.');
  if (i.splayStep <= 0 || i.splayStep > i.maxSplay) return fail('Шаг угла — больше 0 и не больше максимального угла.');
  if (i.count < 0 || !Number.isInteger(i.count)) return fail('Число модулей — целое, 0 = подобрать.');

  const aFar = deg(Math.atan2(i.trimH - i.earH, i.dFar));
  const aNear = deg(Math.atan2(i.trimH - i.earH, i.dNear));
  const spanV = aNear - aFar;
  const rFar = Math.hypot(i.dFar, i.trimH - i.earH);
  const nAngle = Math.ceil(spanV / i.maxSplay - 1e-9) + 1;
  const nSpl = Math.max(1, Math.ceil(Math.pow(10, (i.target - i.contSpl + 20 * lg(rFar)) / 10) - 1e-9));
  const nCtrl = i.fCtrl > 0 ? Math.ceil(C20 / i.fCtrl / i.boxH - 1e-9) : 1;
  const nAuto = Math.max(2, nAngle, nSpl, nCtrl);
  const n = i.count > 0 ? i.count : nAuto;
  if (n > 48) return fail('Слишком много модулей: проверьте исходные данные.');

  const d = designSplays(n, i.trimH, i.boxH, i.earH, i.dNear, i.dFar, i.maxSplay, i.splayStep);
  const boxes = arrayGeometry(i.trimH, i.boxH, i.earH, d.tilts);
  const last = boxes[boxes.length - 1];
  const length = n * i.boxH;
  const fCtrlReal = C20 / length;
  const lv = arrayLevel(i.contSpl, n, rFar);
  const lvPeak = arrayLevel(i.peakSpl, n, rFar);
  const bottomY = boxes[boxes.length - 1].c.y - i.boxH / 2;
  const totalWeight = n * i.weight + i.barWeight;
  const totalSplay = d.tilts[d.tilts.length - 1] - d.tilts[0];
  // Горизонталь: угол, который должен закрыть портал (как для точечных кабинетов).
  const hSpan = i.roomWidth > 0 ? sideSpanDeg(i.roomWidth, Math.min(i.offset, i.roomWidth / 2), i.dNear) : 0;

  const warnings: CalcWarning[] = [];
  let lvlTone: 'ok' | 'warn' | 'crit' = 'ok';
  if (lv.low < i.target) {
    lvlTone = lv.high < i.target ? 'crit' : 'warn';
    warnings.push({
      level: lvlTone === 'crit' ? 'crit' : 'warn',
      text: `Оценка уровня на последнем ряду ${fx(lv.low, 1)}…${fx(lv.high, 1)} дБ при цели ${rn(i.target)} дБ. ${lvlTone === 'crit' ? 'Даже верхняя граница ниже цели: нужны ещё модули, более мощная модель или delay-линия.' : 'Цель достижима только при хорошем сложении модулей; проверьте в ПО производителя.'}`,
    });
  }
  if (i.count > 0 && i.count < nAuto) {
    warnings.push({ level: 'warn', text: `Задано ${i.count} модулей, а по расчёту нужно не меньше ${nAuto} (по углу — ${nAngle}, по уровню — ${nSpl}${i.fCtrl > 0 ? `, по направленности на ${rn(i.fCtrl)} Гц — ${nCtrl}` : ''}).` });
  }
  if (d.clamped > 0) {
    warnings.push({ level: 'warn', text: `${d.clamped} углов упёрлись в максимум ${rn(i.maxSplay)}°: нижние модули не дотягиваются до первых рядов. Добавьте модули, опустите массив или поставьте front-fill.` });
  }
  if (Number.isFinite(last.hit) && last.hit > i.dNear * 1.25 + 0.5) {
    warnings.push({ level: 'warn', text: `Ось нижнего модуля приходит на ${fx(last.hit, 1)} м, а первый ряд на ${rn(i.dNear)} м: первые ряды будут в «тени». Нужен front-fill.` });
  }
  if (i.fCtrl > 0 && fCtrlReal > i.fCtrl * 1.01) {
    warnings.push({ level: 'info', text: `Длина массива ${fx(length, 2)} м держит вертикальную направленность примерно от ${fx(fCtrlReal, 0)} Гц. Ниже этой частоты массив излучает шире и сильнее «светит» в потолок и на сцену.` });
  }
  if (i.maxFlown > 0 && n > i.maxFlown) {
    warnings.push({ level: 'crit', text: `${n} модулей больше допустимых по документации ${i.maxFlown} шт в подвесе. Такой массив подвешивать нельзя: разделите на два массива или возьмите другую модель.` });
  }
  if (hSpan > i.hAngle + 1) {
    warnings.push({ level: 'warn', text: `По горизонтали портал должен закрыть ${fx(hSpan, 0)}°, а модуль даёт ${rn(i.hAngle)}°. Края первых рядов у стен останутся без покрытия: нужны out-fill или разворот массивов.` });
  }
  if (bottomY < i.earH + 0.3) {
    warnings.push({ level: 'warn', text: `Низ массива на высоте ${fx(bottomY, 2)} м, почти на уровне ушей: зрители первых рядов закроют звук задним рядам. Поднимите массив.` });
  }
  warnings.push({ level: 'crit', text: `Подвесной груз ≈ ${fx(totalWeight, 1)} кг без кабелей и моторов. ${RIG_WARN}` });

  const rows: CalcTable['rows'] = boxes.map((b, k) => [
    k + 1, fx(b.tilt, 1) + '°', k < boxes.length - 1 ? fx(b.splay, 1) + '°' : '—',
    Number.isFinite(b.hit) ? fx(b.hit, 1) + ' м' : 'выше зрителей', fx(b.c.y, 2) + ' м',
  ]);
  const cmpFrom = Math.max(2, nAuto - 2);
  const cmp: CalcTable['rows'] = [];
  for (let k = cmpFrom; k <= Math.min(cmpFrom + 5, Math.max(i.maxFlown || 48, cmpFrom)); k++) {
    const g = designSplays(k, i.trimH, i.boxH, i.earH, i.dNear, i.dFar, i.maxSplay, i.splayStep);
    const bx = arrayGeometry(i.trimH, i.boxH, i.earH, g.tilts);
    const l = arrayLevel(i.contSpl, k, rFar);
    cmp.push([
      k, fx(k * i.boxH, 2) + ' м', fx(C20 / (k * i.boxH), 0) + ' Гц', `${fx(l.low, 1)}…${fx(l.high, 1)}`,
      Number.isFinite(bx[k - 1].hit) ? fx(bx[k - 1].hit, 1) + ' м' : '—', fx(k * i.weight + i.barWeight, 0) + ' кг',
      (i.maxFlown > 0 && k > i.maxFlown ? 'больше допуска' : g.clamped ? 'не хватает угла' : l.low >= i.target ? 'подходит' : 'мало уровня'),
    ]);
  }

  const rays: Extract<Figure, { kind: 'side' }>['rays'] = [];
  boxes.forEach((b, k) => {
    const to = Number.isFinite(b.hit) ? { x: b.hit, y: i.earH } : { x: i.dFar * 1.05, y: b.c.y - Math.tan(rad(b.tilt)) * (i.dFar * 1.05 - b.c.x) };
    rays.push({ from: b.c, to, tone: k === 0 || k === boxes.length - 1 ? 'axis' : 'edge' });
  });

  return {
    formulas: [
      'Нужный вертикальный угол: Θ = arctg((H − h)/d₁) − arctg((H − h)/d₂)',
      'По углу: N ≥ ⌈Θ / α_макс⌉ + 1',
      'По уровню (энергетически): N ≥ 10^((L_цель − L₁ + 20·lg r₂) / 10)',
      'По направленности: N ≥ c / (f · h_мод),  c = 343 м/с',
      'Наклон оси модуля i: tᵢ = arctg((y_i − h) / (xᵢ − x_ц)),  xᵢ = d₂ · (d₁/d₂)^((i−1)/(N−1))',
      'L(r₂) ≈ L₁ + 10·lg N − 20·lg r₂ … L₁ + 20·lg N − 20·lg r₂',
    ],
    inputs: [
      { label: 'Модель', value: modelLabel },
      { label: 'Верх массива H', value: i.trimH, unit: 'м', digits: 2 },
      { label: 'Высота ушей h', value: i.earH, unit: 'м', digits: 2 },
      { label: 'До первого ряда d₁', value: i.dNear, unit: 'м', digits: 1 },
      { label: 'До последнего ряда d₂', value: i.dFar, unit: 'м', digits: 1 },
      { label: 'Высота модуля h_мод', value: i.boxH, unit: 'м', digits: 3 },
      { label: 'Длительный SPL модуля L₁', value: i.contSpl, unit: 'дБ', digits: 1 },
      { label: 'Нужный уровень на последнем ряду', value: i.target, unit: 'дБ SPL', digits: 1 },
      { label: 'Макс. угол между модулями α_макс', value: i.maxSplay, unit: '°', digits: 1 },
      { label: 'Шаг угла рамы', value: i.splayStep, unit: '°', digits: 1 },
      { label: 'Направленность от', value: i.fCtrl > 0 ? i.fCtrl : 'не учитывается', unit: i.fCtrl > 0 ? 'Гц' : '', digits: 0 },
    ],
    results: [
      { label: 'Модулей в массиве (на портал)', value: n, unit: 'шт', digits: 0, primary: true, level: i.maxFlown > 0 && n > i.maxFlown ? 'crit' : 'ok' },
      { label: 'Подобрано автоматически', value: nAuto, unit: 'шт', digits: 0 },
      { label: 'Нужный вертикальный угол Θ', value: spanV, unit: '°', digits: 1 },
      { label: 'Сумма углов массива', value: totalSplay, unit: '°', digits: 1 },
      { label: 'Наклон верхнего модуля (рамы)', value: d.tilts[0], unit: '° вниз', digits: 1 },
      { label: 'Длина массива', value: length, unit: 'м', digits: 2 },
      { label: 'Низ массива', value: bottomY, unit: 'м', digits: 2 },
      { label: 'Направленность по вертикали от', value: fCtrlReal, unit: 'Гц', digits: 0 },
      { label: 'Уровень на последнем ряду (длит.)', value: `${fx(lv.low, 1)}…${fx(lv.high, 1)}`, unit: 'дБ SPL', level: lvlTone },
      { label: 'То же по пикам', value: `${fx(lvPeak.low, 1)}…${fx(lvPeak.high, 1)}`, unit: 'дБ SPL' },
      { label: 'Вес массива с рамой', value: totalWeight, unit: 'кг', digits: 1 },
    ],
    explain: [
      `Зрители видны из точки подвеса под углом ${fx(spanV, 1)}° по вертикали. Верхний модуль смотрит на последний ряд, нижний — на первый, промежуточные распределены так, что вверху углы маленькие (дальняя зона), внизу — большие (ближняя). Получается форма «J».`,
      `Чем длиннее массив, тем ниже частота, до которой он держит луч: ${n} × ${fx(i.boxH, 3)} м = ${fx(length, 2)} м — примерно от ${fx(fCtrlReal, 0)} Гц.`,
      'Диапазон уровня показан «от и до»: снизу — если модули складываются только по энергии, сверху — если все в фазе. Реальный уровень где-то между, точнее покажет ПО производителя.',
    ],
    tables: [
      { title: 'Углы массива (сверху вниз)', head: ['Модуль', 'Наклон оси', 'Угол к следующему', 'Ось попадает на', 'Высота центра'], rows },
      { title: 'Сравнение вариантов по числу модулей', head: ['N', 'Длина', 'Направл. от', 'Уровень на посл. ряду, дБ', 'Нижний модуль на', 'Вес с рамой', 'Итог'], rows: cmp, mark: cmp.findIndex((r) => r[0] === n) },
    ],
    figures: [{
      kind: 'side', title: 'Вид сбоку: модули и направление их осей',
      boxes: boxes.map((b, k) => ({ c: b.c, tilt: b.tilt, h: i.boxH, d: i.boxD, label: k === 0 || k === boxes.length - 1 ? String(k + 1) : undefined })),
      rays, audience: { x1: i.dNear, x2: i.dFar, y: i.earH }, floorTo: i.dFar, top: i.trimH + 0.5,
      marks: [{ x: i.dNear, y: i.earH, text: 'первый ряд' }, { x: i.dFar, y: i.earH, text: 'последний', tone: lvlTone }],
    }, {
      kind: 'side', title: 'Крупно: массив и наклон каждого модуля (масштаб 1:1)',
      boxes: boxes.map((b, k) => ({ c: b.c, tilt: b.tilt, h: i.boxH, d: i.boxD, label: `${k + 1}: ${fx(b.tilt, 1)}°` })),
      rays: boxes.map((b) => ({ from: b.c, to: { x: b.c.x + 1.2 * Math.cos(rad(b.tilt)), y: b.c.y - 1.2 * Math.sin(rad(b.tilt)) }, tone: 'axis' as const })),
      audience: { x1: 0, x2: 0, y: 0 }, floorTo: 0, top: i.trimH,
    }],
    limits: [
      'Это предварительная геометрия «J»-массива, а не прогноз покрытия. Реальная форма луча зависит от частоты, интерференции модулей и пресетов процессора; окончательные углы и уровни — только в ПО производителя (RCF Shape Designer) и по измерению.',
      'Модуль считается прямоугольником, повёрнутым вокруг передней кромки; реальная точка вращения задаётся такелажем.',
      'Уровень — по закону обратных квадратов от точки подвеса; на средних дистанциях линейный массив спадает медленнее (−3 дБ на удвоение), поэтому по ближним рядам оценка занижена.',
      'Отражения, поглощение воздухом на ВЧ и реверберация помещения не учтены.',
      ...modelNotes,
    ],
    warnings,
  };
}

/* ======================= Инструмент ======================= */

function crestOf(v: Values) {
  const c = num(v.crest);
  return Number.isFinite(c) && c >= 0 ? c : 6;
}

export const configTool: ToolDef = {
  id: 'config',
  title: 'Конфигурация акустики',
  short: 'кабинеты на портал, линейный массив, углы',
  fields: [
    {
      key: 'mode', label: 'Система', type: 'select',
      options: [{ value: 'point', label: 'Точечные кабинеты (L/R порталы)' }, { value: 'line', label: 'Линейный массив' }],
    },
    { key: 'model', label: 'Модель', type: 'select', optionsFn: (v) => gearOptions(v.mode === 'line' ? ['line'] : ['point']) },
    { key: 'roomWidth', label: 'Ширина зрительской зоны', unit: 'м', type: 'number' },
    { key: 'dFirst', label: 'До первого ряда', unit: 'м', type: 'number', step: 0.5 },
    { key: 'dLast', label: 'До последнего ряда', unit: 'м', type: 'number', step: 0.5 },
    { key: 'offset', label: 'Смещение портала от центра', unit: 'м', type: 'number', step: 0.5, hint: 'Обычно половина ширины сцены' },
    { key: 'target', label: 'Нужный уровень на последнем ряду', unit: 'дБ SPL', type: 'number', hint: 'Длительный: речь 85–90, концерт 95–100' },
    { key: 'crest', label: 'Пик-фактор (пик − длительный)', unit: 'дБ', type: 'number', hint: 'Если производитель не указал длительный SPL. Обычно 6 дБ' },
    { key: 'hAngle', label: 'Угол кабинета по горизонтали', unit: '°', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'maxSpl', label: 'Макс. пиковый SPL на 1 м', unit: 'дБ', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'boxH', label: 'Высота модуля', unit: 'мм', type: 'number', showIf: (v) => v.mode === 'line' && v.model === 'manual' },
    { key: 'boxD', label: 'Глубина модуля', unit: 'мм', type: 'number', showIf: (v) => v.mode === 'line' && v.model === 'manual' },
    { key: 'weight', label: 'Вес модуля', unit: 'кг', type: 'number', showIf: (v) => v.mode === 'line' && v.model === 'manual' },
    { key: 'trimH', label: 'Высота верха массива', unit: 'м', type: 'number', step: 0.5, showIf: (v) => v.mode === 'line' },
    { key: 'earH', label: 'Высота ушей', unit: 'м', type: 'number', step: 0.1, showIf: (v) => v.mode === 'line', hint: '1,2 сидя, 1,6 стоя' },
    { key: 'count', label: 'Модулей на портал', unit: 'шт, 0 = подобрать', type: 'number', step: 1, showIf: (v) => v.mode === 'line' },
    { key: 'maxSplay', label: 'Макс. угол между модулями', unit: '°', type: 'number', showIf: (v) => v.mode === 'line', hint: 'Из руководства на раму и модуль' },
    { key: 'splayStep', label: 'Шаг углов рамы', unit: '°', type: 'number', step: 0.5, showIf: (v) => v.mode === 'line' },
    { key: 'fCtrl', label: 'Держать направленность от', unit: 'Гц, 0 = нет', type: 'number', showIf: (v) => v.mode === 'line' },
    { key: 'barWeight', label: 'Вес рамы', unit: 'кг', type: 'number', showIf: (v) => v.mode === 'line', hint: 'Для HDL 20-A и FL-B HDL 20-18 — 20,69 кг' },
  ],
  defaults: {
    mode: 'point', model: 'rcf-art912a', roomWidth: '20', dFirst: '3', dLast: '24', offset: '5', target: '98', crest: '6',
    hAngle: '90', maxSpl: '128', boxH: '294', boxD: '445', weight: '30', trimH: '7', earH: '1.6', count: '0', maxSplay: '10',
    splayStep: '1', fCtrl: '250', barWeight: '20.69',
  },
  compute: (v) => {
    const crest = crestOf(v);
    const m = v.model === 'manual' ? undefined : findGear(v.model);
    const isLine = v.mode === 'line';
    if (v.model !== 'manual' && (!m || m.kind !== (isLine ? 'line' : 'point'))) {
      return fail(`Выберите модель ${isLine ? 'линейного массива' : 'широкополосной акустики'} или «Ввести вручную».`);
    }
    const peak = m ? splPair(m, crest).peak : num(v.maxSpl);
    const cont = m ? splPair(m, crest).cont : num(v.maxSpl) - crest;
    const hA = m ? m.hAngle ?? NaN : num(v.hAngle);
    const notes = m ? [sourceLine(m), ...m.notes] : ['Характеристики введены вручную.'];
    if (m && m.contSpl === undefined) notes.push(`Длительный SPL взят как паспортный максимум минус пик-фактор ${fx(crest, 0)} дБ — это допущение, а не данные производителя.`);
    if (!isLine) {
      const r = speakerConfig({
        roomWidth: num(v.roomWidth), dFirst: num(v.dFirst), dLast: num(v.dLast), offset: num(v.offset), hAngle: hA, maxSpl: cont, target: num(v.target),
      });
      if (!r.error) {
        r.inputs.unshift({ label: 'Модель', value: m ? gearName(m) : 'вручную' }, { label: 'Пиковый SPL на 1 м', value: peak, unit: 'дБ', digits: 1 });
        r.limits.push(...notes);
      }
      return r;
    }
    return lineArray({
      trimH: num(v.trimH), earH: num(v.earH), dNear: num(v.dFirst), dFar: num(v.dLast),
      boxH: m ? m.dims[0] / 1000 : num(v.boxH) / 1000, boxD: m ? m.dims[2] / 1000 : num(v.boxD) / 1000,
      vAngle: m?.vAngle ?? 0, hAngle: hA, contSpl: cont, peakSpl: peak, target: num(v.target),
      count: num(v.count) || 0, maxSplay: num(v.maxSplay), splayStep: num(v.splayStep), fCtrl: num(v.fCtrl) || 0,
      maxFlown: m?.flyBar?.max ?? m?.maxFlown ?? 0, weight: m ? m.weight : num(v.weight), barWeight: num(v.barWeight) || 0,
      roomWidth: num(v.roomWidth) || 0, offset: num(v.offset) || 0,
    }, m ? gearName(m) : 'вручную', notes);
  },
};

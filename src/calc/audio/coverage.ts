import { CalcResult, CalcWarning, Figure, ToolDef, fail, lg, num, requireFinite, fx, rn } from '../types';
import { findGear, gearName, gearOptions, sourceLine } from './gear';

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

/** Ширина покрытия на расстоянии d при угле раскрытия θ: W = 2·d·tg(θ/2). */
export function coverageWidth(d: number, angleDeg: number): number {
  return 2 * d * Math.tan(rad(angleDeg / 2));
}

/** Коэффициент направленности по углам раскрытия (формула Molloy): Q = 180° / arcsin(sin(θ/2)·sin(φ/2)). */
export function qMolloy(hDeg: number, vDeg: number): number {
  return 180 / deg(Math.asin(Math.sin(rad(hDeg / 2)) * Math.sin(rad(vDeg / 2))));
}

/** Критическое расстояние: r_c = 0,057·√(Q·V / T60), м. */
export function criticalDistance(q: number, volume: number, rt60: number): number {
  return 0.057 * Math.sqrt((q * volume) / rt60);
}

export interface CoverageInput {
  hAngle: number;
  vAngle: number;
  speakerH: number;
  earH: number;
  dNear: number;
  dFar: number;
  /** Зал: ширина, длина от линии акустики до задней стены, высота, м (0 — не задано). */
  roomW?: number;
  roomL?: number;
  roomH?: number;
  /** Расстояние от оси зала до каждого портала, м (0 — одна колонка по центру). */
  offset?: number;
  /** Разворот кабинетов к центру зала, °. */
  toe?: number;
  /** Время реверберации, с (0 — неизвестно). */
  rt60?: number;
  modelNotes?: string[];
  modelLabel?: string;
}

export function coverage(i: CoverageInput): CalcResult {
  const err = requireFinite([
    ['Угол по горизонтали', i.hAngle], ['Угол по вертикали', i.vAngle], ['Высота кабинета', i.speakerH],
    ['Высота ушей', i.earH], ['До первого ряда', i.dNear], ['До последнего ряда', i.dFar],
  ]);
  if (err) return fail(err);
  if (i.hAngle <= 0 || i.hAngle >= 180 || i.vAngle <= 0 || i.vAngle >= 180) return fail('Углы раскрытия должны быть от 1 до 179°.');
  if (i.dNear <= 0 || i.dFar <= 0) return fail('Расстояния должны быть больше 0 м.');
  if (i.dFar <= i.dNear) return fail('Последний ряд должен быть дальше первого.');
  const roomW = i.roomW ?? 0, roomL = i.roomL ?? 0, roomH = i.roomH ?? 0;
  const offset = i.offset ?? 0, toe = i.toe ?? 0, rt60 = i.rt60 ?? 0;
  if (![roomW, roomL, roomH, offset, toe, rt60].every(Number.isFinite)) return fail('Проверьте размеры зала, смещение, разворот и RT60.');
  if (roomW < 0 || roomL < 0 || roomH < 0 || offset < 0 || rt60 < 0) return fail('Размеры и RT60 не могут быть отрицательными.');
  if (roomW > 0 && offset > roomW / 2) return fail('Смещение портала больше половины ширины зала.');
  if (roomL > 0 && roomL < i.dFar) return fail('Последний ряд дальше задней стены: проверьте длину зала.');
  if (toe < 0 || toe >= i.hAngle / 2 + 45) return fail('Разворот к центру — от 0° и не больше половины угла раскрытия + 45°.');

  const dh = i.speakerH - i.earH;
  const wNear = coverageWidth(i.dNear, i.hAngle);
  const wFar = coverageWidth(i.dFar, i.hAngle);
  const sNear = Math.hypot(i.dNear, dh);
  const sFar = Math.hypot(i.dFar, dh);
  const tilt = deg(Math.atan2(dh, i.dFar));
  const angNear = deg(Math.atan2(dh, i.dNear));
  const offNear = angNear - tilt;
  const dL = 20 * lg(sFar / sNear);
  const warnings: CalcWarning[] = [];
  const results: CalcResult['results'] = [];
  const formulas = [
    'W = 2·d·tg(θ_г / 2)',
    'Наклон оси α = arctg((h_к − h_у) / d_посл)',
    'ΔL = 20·lg(s_посл / s_перв),  s = √(d² + (h_к − h_у)²)',
  ];

  let nearLevel: 'ok' | 'warn' = 'ok';
  if (offNear > i.vAngle / 2) {
    nearLevel = 'warn';
    warnings.push({
      level: 'warn',
      text: `Первый ряд на ${fx(offNear, 1)}° ниже оси, это за пределами вертикального покрытия (±${fx(i.vAngle / 2, 1)}°). Нужен front-fill или кабинет с большим вертикальным углом.`,
    });
  }
  if (dL > 6) {
    warnings.push({
      level: 'warn',
      text: `Разница уровня между первым и последним рядом ${fx(dL, 1)} дБ. Наведение оси на дальние ряды частично компенсирует её; при разнице больше 6–10 дБ подумайте о delay-линии.`,
    });
  }
  if (i.speakerH > 3) {
    warnings.push({
      level: 'crit',
      text: 'Кабинет выше 3 м — это подвес или высокая стойка. Используйте только сертифицированный такелаж и проверенные точки подвеса. Проверка специалистом обязательна.',
    });
  }

  results.push(
    { label: 'Ширина покрытия на последнем ряду', value: wFar, unit: 'м', digits: 1, primary: true },
    { label: 'Ширина покрытия на первом ряду', value: wNear, unit: 'м', digits: 1 },
    { label: 'Наклон оси вниз (на последний ряд)', value: tilt, unit: '°', digits: 1 },
    { label: 'Первый ряд ниже оси на', value: offNear, unit: '°', digits: 1, level: nearLevel },
    { label: 'Разница уровня первый/последний ряд', value: dL, unit: 'дБ', digits: 1, level: dL > 6 ? 'warn' : 'ok' },
  );

  // ---- Горизонталь в зале: дыра по центру, стены, углы последнего ряда.
  const half = i.hAngle / 2;
  const inner = toe + half; // внутренняя граница покрытия, ° от оси зала (к центру)
  const outer = half - toe; // внешняя граница, ° от оси зала (к стене)
  const marks: Extract<Figure, { kind: 'plan' }>['marks'] = [];
  const zones: Extract<Figure, { kind: 'plan' }>['zones'] = [];
  if (offset > 0) {
    formulas.push('Центр: d_ц = x / tg(разворот + θ_г/2);  стена: d_ст = (W/2 − x) / tg(θ_г/2 − разворот)');
    const dCenter = inner < 90 ? offset / Math.tan(rad(inner)) : 0;
    results.push({ label: 'Покрытие порталов сходится по центру с', value: dCenter, unit: 'м', digits: 1, level: dCenter > i.dNear ? 'warn' : 'ok' });
    if (dCenter > i.dNear) {
      warnings.push({ level: 'warn', text: `По центру перед сценой до ${fx(dCenter, 1)} м зрители вне покрытия обоих порталов (а первый ряд на ${rn(i.dNear)} м). Нужен front-fill или разворот кабинетов к центру.` });
      zones.push({ p: { x: 0, y: (i.dNear + dCenter) / 2 }, r: Math.max(0.6, (dCenter - i.dNear) / 2), tone: 'warn', label: 'дыра' });
    }
  }
  if (roomW > 0) {
    const side = roomW / 2 - offset;
    if (outer > 0 && outer < 90) {
      const dWall = side / Math.tan(rad(outer));
      results.push({ label: 'Покрытие доходит до боковых стен на', value: dWall, unit: 'м', digits: 1, level: dWall < i.dFar ? 'warn' : 'ok' });
      if (dWall < i.dFar) {
        warnings.push({ level: 'warn', text: `С ${fx(dWall, 1)} м звук попадает на боковые стены: отражения ухудшат разборчивость, если стены жёсткие. Помогают разворот к центру, кабинет с меньшим углом или поглощение на стенах.` });
      }
    }
    const cornerAng = deg(Math.atan(side / i.dFar));
    if (cornerAng > outer + 1e-9) {
      warnings.push({ level: 'warn', text: `Угол последнего ряда у стены виден под ${fx(cornerAng, 1)}°, а покрытие кончается на ${fx(Math.max(0, outer), 1)}°: там на 6 дБ и больше тише. Нужен out-fill или меньший разворот.` });
      marks.push({ p: { x: roomW / 2 - 0.4, y: i.dFar }, text: 'тихо', tone: 'warn' });
    }
  }
  if (roomL > 0) {
    // Отражение от задней стены к первому ряду: путь туда и обратно.
    const extra = 2 * (roomL - i.dNear);
    const dt = (extra / 343) * 1000;
    results.push({ label: 'Запаздывание отражения задней стены (1-й ряд)', value: dt, unit: 'мс', digits: 0, level: dt > 50 ? 'warn' : 'ok' });
    formulas.push('Δt = 2·(L_зала − d_перв) / c');
    if (dt > 50) {
      warnings.push({ level: 'warn', text: `Отражение от задней стены приходит к первым рядам на ${fx(dt, 0)} мс позже прямого звука (больше 50 мс): если стена жёсткая, будет слышно эхо. Не направляйте ось выше последнего ряда, закройте стену поглотителем.` });
    }
  }
  if (rt60 > 0 && roomW > 0 && roomL > 0 && roomH > 0) {
    const q = qMolloy(i.hAngle, i.vAngle);
    const v = roomW * roomL * roomH;
    const rc = criticalDistance(q, v, rt60);
    formulas.push('Q = 180° / arcsin(sin(θ_г/2)·sin(θ_в/2)),  r_c = 0,057·√(Q·V / T60)');
    results.push({ label: 'Коэффициент направленности Q', value: q, digits: 1 });
    results.push({ label: 'Объём зала', value: v, unit: 'м³', digits: 0 });
    results.push({ label: 'Критическое расстояние r_c', value: rc, unit: 'м', digits: 1, level: sFar > 2 * rc ? 'warn' : 'ok' });
    if (sFar > rc) {
      warnings.push({
        level: 'warn',
        text: `Последний ряд (${fx(sFar, 1)} м) дальше критического расстояния ${fx(rc, 1)} м: там отражённого звука больше прямого${sFar > 3 * rc ? ', разборчивость речи будет плохой' : ''}. Добавить громкости не поможет — нужны delay-линия ближе к слушателям, более направленная акустика или поглощение в зале.`,
      });
    }
  }

  const inputs: CalcResult['inputs'] = [
    ...(i.modelLabel ? [{ label: 'Модель', value: i.modelLabel }] : []),
    { label: 'Угол раскрытия по горизонтали θ_г', value: i.hAngle, unit: '°', digits: 0 },
    { label: 'Угол раскрытия по вертикали θ_в', value: i.vAngle, unit: '°', digits: 0 },
    { label: 'Высота кабинета (акуст. центр) h_к', value: i.speakerH, unit: 'м', digits: 2 },
    { label: 'Высота ушей слушателя h_у', value: i.earH, unit: 'м', digits: 2 },
    { label: 'До первого ряда d_перв', value: i.dNear, unit: 'м', digits: 1 },
    { label: 'До последнего ряда d_посл', value: i.dFar, unit: 'м', digits: 1 },
  ];
  if (roomW > 0) inputs.push({ label: 'Зал Ш × Д × В', value: `${rn(roomW)} × ${rn(roomL || 0)} × ${rn(roomH || 0)}`, unit: 'м' });
  if (offset > 0) inputs.push({ label: 'Порталы от оси зала x', value: offset, unit: 'м', digits: 1 }, { label: 'Разворот к центру', value: toe, unit: '°', digits: 0 });
  if (rt60 > 0) inputs.push({ label: 'Время реверберации T60', value: rt60, unit: 'с', digits: 1 });

  // Рисунки.
  const figures: Figure[] = [];
  const pw = roomW > 0 ? roomW : Math.max(wFar, 2 * offset + 4);
  const pl = roomL > 0 ? roomL : i.dFar * 1.1;
  const sources: Extract<Figure, { kind: 'plan' }>['sources'] = offset > 0
    ? [{ p: { x: -offset, y: 0 }, aim: toe, spread: i.hAngle, label: 'L' }, { p: { x: offset, y: 0 }, aim: -toe, spread: i.hAngle, label: 'R' }]
    : [{ p: { x: 0, y: 0 }, aim: 0, spread: i.hAngle, label: 'PA' }];
  figures.push({
    kind: 'plan', title: 'Вид сверху: примерная зона покрытия (−6 дБ)', room: { w: pw, d: pl }, sources, zones, marks,
    lines: [
      { a: { x: -pw / 2, y: i.dNear }, b: { x: pw / 2, y: i.dNear }, tone: 'muted', label: 'первый ряд' },
      { a: { x: -pw / 2, y: i.dFar }, b: { x: pw / 2, y: i.dFar }, tone: 'muted', label: 'последний ряд' },
    ],
  });
  const ray = (a: number) => {
    const t = Math.tan(rad(a));
    const x = t > 0 ? Math.min(dh / t, pl) : pl;
    return { x, y: i.speakerH - t * x };
  };
  figures.push({
    kind: 'side', title: 'Вид сбоку: ось и границы вертикального покрытия',
    boxes: [{ c: { x: 0, y: i.speakerH }, tilt, h: 0.5, d: 0.4 }],
    rays: [
      { from: { x: 0, y: i.speakerH }, to: ray(tilt), tone: 'axis' },
      { from: { x: 0, y: i.speakerH }, to: ray(tilt - i.vAngle / 2), tone: 'edge' },
      { from: { x: 0, y: i.speakerH }, to: ray(tilt + i.vAngle / 2), tone: nearLevel === 'warn' ? 'warn' : 'edge' },
    ],
    audience: { x1: i.dNear, x2: i.dFar, y: i.earH }, floorTo: pl, top: Math.max(i.speakerH, roomH || 0) + 0.5,
    marks: [{ x: i.dNear, y: i.earH, text: 'первый ряд', tone: nearLevel }, { x: i.dFar, y: i.earH, text: 'последний' }],
  });

  return {
    formulas,
    inputs,
    results,
    explain: [
      `Кабинет с углом ${rn(i.hAngle)}° на последнем ряду (${rn(i.dFar)} м) закрывает полосу шириной ${fx(wFar, 1)} м, на первом — ${fx(wNear, 1)} м. На краю этой полосы на 6 дБ тише, чем на оси.`,
      `Ось надо наклонить вниз на ${fx(tilt, 1)}°, чтобы она смотрела на последний ряд; тогда первый ряд окажется на ${fx(offNear, 1)}° ниже оси ${nearLevel === 'warn' ? '— уже за границей покрытия.' : '— ещё в пределах покрытия.'}`,
      'Это геометрическая оценка: реальная картина зависит от частоты, отражений и поглощения в зале. Проверяйте измерением.',
    ],
    figures,
    limits: [
      'Угол раскрытия — паспортный, по уровню −6 дБ. На границе покрытия уровень на 6 дБ ниже, чем на оси.',
      'Угол раскрытия зависит от частоты: на НЧ он шире, на ВЧ может быть уже паспортного.',
      'Разница уровней считается по закону обратных квадратов без учёта направленности кабинета и отражений.',
      'Критическое расстояние — оценка для диффузного поля (формула Сэбина); в залах с неравномерным поглощением реальная картина другая.',
      'Расстояния — по горизонтали от кабинета до рядов.',
      ...(i.modelNotes ?? []),
    ],
    warnings,
  };
}

export const coverageTool: ToolDef = {
  id: 'coverage',
  title: 'Звуковое покрытие',
  short: 'ширина, наклон, зал, акустические проблемы',
  fields: [
    { key: 'model', label: 'Модель', type: 'select', optionsFn: () => gearOptions(['point', 'line']) },
    { key: 'hAngle', label: 'Угол по горизонтали', unit: '°', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'vAngle', label: 'Угол по вертикали', unit: '°', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'speakerH', label: 'Высота кабинета', unit: 'м', type: 'number', step: 0.1 },
    { key: 'earH', label: 'Высота ушей', unit: 'м', type: 'number', step: 0.1, hint: '1,2 сидя, 1,6 стоя' },
    { key: 'dNear', label: 'До первого ряда', unit: 'м', type: 'number', step: 0.5 },
    { key: 'dFar', label: 'До последнего ряда', unit: 'м', type: 'number', step: 0.5 },
    { key: 'offset', label: 'Порталы от центра зала', unit: 'м, 0 = один по центру', type: 'number', step: 0.5 },
    { key: 'toe', label: 'Разворот к центру', unit: '°', type: 'number' },
    { key: 'roomW', label: 'Ширина зала', unit: 'м, 0 = нет', type: 'number' },
    { key: 'roomL', label: 'Длина зала от акустики', unit: 'м, 0 = нет', type: 'number' },
    { key: 'roomH', label: 'Высота зала', unit: 'м, 0 = нет', type: 'number' },
    { key: 'rt60', label: 'Время реверберации T60', unit: 'с, 0 = неизвестно', type: 'number', step: 0.1, hint: 'Концертный зал 1,5–2, спортзал 2–4' },
  ],
  defaults: {
    model: 'manual', hAngle: '90', vAngle: '40', speakerH: '2.8', earH: '1.2', dNear: '3', dFar: '20',
    offset: '0', toe: '0', roomW: '0', roomL: '0', roomH: '0', rt60: '0',
  },
  compute: (v) => {
    const m = v.model === 'manual' ? undefined : findGear(v.model);
    if (v.model !== 'manual' && (!m || !m.hAngle || !m.vAngle)) return fail('Выберите модель с углами раскрытия или «Ввести вручную».');
    const notes = m ? [sourceLine(m), ...(m.kind === 'line' ? ['Для модуля линейного массива вертикальный угол — у одного модуля; у массива вертикальное покрытие задаётся углами между модулями (см. «Конфигурация акустики»).'] : [])] : [];
    return coverage({
      hAngle: m?.hAngle ?? num(v.hAngle), vAngle: m?.vAngle ?? num(v.vAngle), speakerH: num(v.speakerH), earH: num(v.earH),
      dNear: num(v.dNear), dFar: num(v.dFar), roomW: num(v.roomW) || 0, roomL: num(v.roomL) || 0, roomH: num(v.roomH) || 0,
      offset: num(v.offset) || 0, toe: num(v.toe) || 0, rt60: num(v.rt60) || 0, modelNotes: notes, modelLabel: m ? gearName(m) : undefined,
    });
  },
};

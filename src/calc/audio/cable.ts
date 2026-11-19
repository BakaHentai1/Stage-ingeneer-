import { CalcResult, CalcTable, CalcWarning, ToolDef, Values, fail, lg, num, requireFinite, fx, rn } from '../types';
import { CableListPanel } from './CableListPanel';

/** Удельное сопротивление меди при 20 °C, Ом·мм²/м. */
export const RHO_CU = 0.0175;
/** Омеднённый алюминий (CCA): примерно в 1,6 раза выше меди — ориентировочное значение, у разных кабелей отличается. */
export const RHO_CCA = 0.028;
/** Температурный коэффициент сопротивления меди, 1/°C. */
export const ALPHA_CU = 0.00393;
/** Стандартные сечения акустического кабеля, мм². */
export const SECTIONS = [0.75, 1, 1.5, 2.5, 4, 6, 10];
/** Стандартные длины готовых кабелей, м. */
export const STD_LENGTHS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100];

/** Сопротивление двухпроводной линии (туда и обратно): R = 2·ρ·L / A. */
export function lineResistance(length: number, section: number, rho = RHO_CU): number {
  return (2 * rho * length) / section;
}

/** Потери уровня на нагрузке из-за сопротивления кабеля: ΔL = 20·lg((Z + R) / Z). */
export function lossDb(z: number, r: number): number {
  return 20 * lg((z + r) / z);
}

/** Минимальное сечение, при котором потери не превышают lossMax дБ. */
export function minSection(length: number, z: number, lossMax: number, rho = RHO_CU): number {
  const rMax = z * (Math.pow(10, lossMax / 20) - 1);
  return (2 * rho * length) / rMax;
}

export interface CableLossInput {
  length: number;
  section: number;
  /** Импеданс одного кабинета, Ом. */
  z: number;
  lossMax: number;
  /** Кабинетов параллельно на конце линии (по умолчанию 1). */
  count?: number;
  /** Удельное сопротивление, Ом·мм²/м (по умолчанию медь при 20 °C). */
  rho?: number;
  material?: string;
  /** Температура кабеля, °C (по умолчанию 20). */
  temp?: number;
}

/** Строка сравнения для одного сечения. */
export function lossRow(length: number, section: number, zLoad: number, rho: number) {
  const r = lineResistance(length, section, rho);
  const ratio = zLoad / (zLoad + r);
  return { r, db: lossDb(zLoad, r), pPct: (1 - ratio * ratio) * 100, uPct: (r / (zLoad + r)) * 100, df: zLoad / r };
}

export function cableLoss(i: CableLossInput): CalcResult {
  const n = i.count ?? 1;
  const temp = i.temp ?? 20;
  const err = requireFinite([['Длина', i.length], ['Сечение', i.section], ['Импеданс', i.z], ['Допустимые потери', i.lossMax], ['Кабинетов', n], ['Температура', temp]]);
  if (err) return fail(err);
  if (i.length <= 0 || i.section <= 0 || i.z <= 0) return fail('Длина, сечение и импеданс должны быть больше 0.');
  if (i.lossMax <= 0) return fail('Допустимые потери должны быть больше 0 дБ.');
  if (n < 1 || !Number.isInteger(n) || n > 16) return fail('Кабинетов на линии — целое число от 1 до 16.');
  if (temp < -30 || temp > 90) return fail('Температура кабеля — от −30 до +90 °C.');

  const rho20 = i.rho ?? RHO_CU;
  const rho = rho20 * (1 + ALPHA_CU * (temp - 20));
  const zLoad = i.z / n;
  const cur = lossRow(i.length, i.section, zLoad, rho);
  const r = cur.r;
  const loss = cur.db;
  const aMin = minSection(i.length, zLoad, i.lossMax, rho);
  const aStd = SECTIONS.find((s) => s >= aMin - 1e-9);
  const warnings: CalcWarning[] = [];
  const level = loss > i.lossMax ? 'warn' : 'ok';
  if (loss > i.lossMax) {
    warnings.push({ level: 'warn', text: `Потери ${fx(loss, 2)} дБ больше допустимых ${rn(i.lossMax)} дБ: увеличьте сечение или сократите длину.` });
  }
  if (!aStd) {
    warnings.push({ level: 'warn', text: 'Нужно сечение больше 10 мм²: поставьте усилитель ближе к акустике.' });
  }
  if (cur.df < 20) {
    warnings.push({ level: 'info', text: `Демпинг-фактор кабеля ${fx(cur.df, 0)} (меньше 20): сопротивление кабеля заметно влияет на контроль НЧ-динамика.` });
  }

  const sec = (s: number) => String(s).replace('.', ',');
  const rows: CalcTable['rows'] = SECTIONS.map((s) => {
    const x = lossRow(i.length, s, zLoad, rho);
    return [sec(s) + ' мм²', fx(x.r, 3), fx(x.db, 2), fx(x.pPct, 1), fx(x.uPct, 1), fx(x.df, 0), x.db <= i.lossMax ? 'подходит' : 'много потерь'];
  });

  return {
    formulas: [
      `R = 2·ρ·L / A,   ρ = ${fx(rho20, 4)}·(1 + 0,00393·(T − 20)) = ${fx(rho, 4)} Ом·мм²/м`,
      'Z_нагр = Z / N',
      'ΔL = 20·lg((Z_нагр + R) / Z_нагр)',
      'Потери мощности = 1 − (Z_нагр / (Z_нагр + R))²,  потери напряжения = R / (Z_нагр + R)',
      'A_мин = 2·ρ·L / (Z_нагр·(10^(ΔL_доп/20) − 1))',
    ],
    inputs: [
      { label: 'Длина кабеля L (в одну сторону)', value: i.length, unit: 'м', digits: 1 },
      { label: 'Сечение жилы A', value: i.section, unit: 'мм²', digits: 2 },
      { label: 'Материал', value: i.material ?? 'медь' },
      { label: 'Температура кабеля T', value: temp, unit: '°C', digits: 0 },
      { label: 'Импеданс кабинета Z', value: i.z, unit: 'Ом', digits: 1 },
      { label: 'Кабинетов параллельно N', value: n, digits: 0 },
      { label: 'Допустимые потери', value: i.lossMax, unit: 'дБ', digits: 2 },
    ],
    results: [
      { label: 'Потери уровня', value: loss, unit: 'дБ', digits: 2, primary: true, level },
      { label: 'Сопротивление линии', value: r, unit: 'Ом', digits: 3 },
      { label: 'Нагрузка на конце', value: zLoad, unit: 'Ом', digits: 2 },
      { label: 'Потери мощности', value: cur.pPct, unit: '%', digits: 1 },
      { label: 'Потери напряжения', value: cur.uPct, unit: '%', digits: 1 },
      { label: 'Демпинг-фактор кабеля Z/R', value: cur.df, digits: 0 },
      { label: 'Минимальное сечение', value: aMin, unit: 'мм²', digits: 2 },
      { label: 'Ближайшее стандартное', value: aStd ? sec(aStd) : '> 10', unit: 'мм²' },
    ],
    explain: [
      `Кабель — это дополнительное сопротивление ${fx(r, 3)} Ом последовательно с нагрузкой ${fx(zLoad, 2)} Ом. На нём теряется ${fx(cur.uPct, 1)} % напряжения и ${fx(cur.pPct, 1)} % мощности, на слух это −${fx(loss, 2)} дБ.`,
      aStd ? `Чтобы терять не больше ${rn(i.lossMax)} дБ, нужно сечение от ${fx(aMin, 2)} мм², то есть стандартное ${sec(aStd)} мм².` : 'Даже 10 мм² не укладывается в допустимые потери: сократите длину линии.',
    ],
    tables: [{
      title: `Сравнение сечений для ${rn(i.length)} м на ${fx(zLoad, 2)} Ом`,
      head: ['Сечение', 'R, Ом', 'Потери, дБ', 'Мощность, %', 'Напряжение, %', 'DF', 'Итог'],
      rows, mark: aStd ? SECTIONS.indexOf(aStd) : undefined,
    }],
    figures: [{
      kind: 'bars', title: 'Потери по сечениям, дБ', unit: 'дБ',
      bars: SECTIONS.map((s) => {
        const x = lossRow(i.length, s, zLoad, rho);
        return { label: sec(s) + ' мм²', value: x.db, tone: x.db <= i.lossMax ? 'ok' : 'crit' };
      }),
      ref: { value: i.lossMax, label: 'допустимо' },
    }],
    limits: [
      'Медь — по справочному удельному сопротивлению 0,0175 Ом·мм²/м при 20 °C; CCA (омеднённый алюминий) — ориентировочно 0,028, у конкретного кабеля может отличаться.',
      'Используется номинальный импеданс; на частотах, где импеданс кабинета ниже номинала, потери больше.',
      'Сопротивление разъёмов и выходное сопротивление усилителя не учитываются.',
      'Для линий 70/100 В расчёт другой, этот инструмент для низкоомной акустики.',
    ],
    warnings,
  };
}

export const cableLossTool: ToolDef = {
  id: 'cable-loss',
  title: 'Потери в акустическом кабеле',
  short: 'потери в дБ и %, сравнение сечений',
  fields: [
    { key: 'length', label: 'Длина кабеля (в одну сторону)', unit: 'м', type: 'number' },
    {
      key: 'section', label: 'Сечение жилы', type: 'select',
      options: SECTIONS.map((s) => ({ value: String(s), label: `${String(s).replace('.', ',')} мм²` })),
    },
    { key: 'material', label: 'Материал жилы', type: 'select', options: [{ value: 'cu', label: 'Медь' }, { value: 'cca', label: 'CCA (омеднённый алюминий)' }] },
    { key: 'z', label: 'Импеданс кабинета', unit: 'Ом', type: 'number' },
    { key: 'count', label: 'Кабинетов параллельно на линии', unit: 'шт', type: 'number', step: 1 },
    { key: 'lossMax', label: 'Допустимые потери', unit: 'дБ', type: 'number', step: 0.1, hint: 'Обычно 0,5 дБ (≈ 11 % мощности)' },
    { key: 'temp', label: 'Температура кабеля', unit: '°C', type: 'number' },
  ],
  defaults: { length: '25', section: '2.5', material: 'cu', z: '8', count: '1', lossMax: '0.5', temp: '20' },
  compute: (v) => cableLoss({
    length: num(v.length), section: num(v.section), z: num(v.z), lossMax: num(v.lossMax), count: num(v.count) || 1,
    rho: v.material === 'cca' ? RHO_CCA : RHO_CU, material: v.material === 'cca' ? 'CCA (ориентировочно)' : 'медь',
    temp: Number.isFinite(num(v.temp)) ? num(v.temp) : 20,
  }),
};

/* ---------------- Длина и тип кабеля ---------------- */

export type CableType = 'mic' | 'line-bal' | 'unbal' | 'aes' | 'utp' | 'speaker' | 'dmx';

/** Практические ограничения длины. Для UTP и DMX — требования стандартов. */
export const CABLE_TYPES: Record<CableType, { label: string; connector: string; maxLen: number; note: string; ports: Port[] }> = {
  mic: { label: 'Микрофонный, симметричный', connector: 'XLR3 (m–f)', maxLen: 100, note: 'Практический предел ~100 м; при фантомном питании и длине больше 50 м проверьте падение напряжения.', ports: ['xlr3'] },
  'line-bal': { label: 'Линейный симметричный', connector: 'XLR3 или Jack TRS', maxLen: 100, note: 'Симметричная линия устойчива к наводкам; практический предел около 100 м.', ports: ['xlr3', 'trs', 'ts', 'rca'] },
  unbal: { label: 'Несимметричный', connector: 'Jack TS или RCA', maxLen: 5, note: 'Несимметричная линия собирает наводки. Длиннее 5 м — используйте DI-box и симметричную линию.', ports: ['ts', 'rca', 'trs', 'xlr3'] },
  aes: { label: 'Цифровой AES/EBU, 110 Ом', connector: 'XLR3', maxLen: 100, note: 'Нужен кабель 110 Ом; микрофонный кабель на длинных линиях даёт ошибки.', ports: ['xlr3'] },
  utp: { label: 'Сетевой (стейджбокс, Dante и т. п.)', connector: 'RJ45 / etherCON', maxLen: 100, note: 'Стандарт Ethernet: не более 100 м на сегмент. Рекомендуется Cat5e/Cat6 в экране, с etherCON для сцены.', ports: ['rj45', 'ethercon'] },
  speaker: { label: 'Акустический', connector: 'speakON NL2/NL4', maxLen: 100, note: 'Сечение подбирайте в расчёте потерь в кабеле.', ports: ['nl4', 'nl2', 'bind'] },
  dmx: { label: 'DMX512, 120 Ом', connector: 'XLR5 или XLR3', maxLen: 300, note: 'Кабель 120 Ом, до 32 устройств и не более 300 м на линию, терминатор 120 Ом в конце.', ports: ['xlr5', 'xlr3'] },
};

export type Port = 'xlr3' | 'xlr5' | 'trs' | 'ts' | 'rca' | 'nl2' | 'nl4' | 'bind' | 'rj45' | 'ethercon';

export const PORT_LABEL: Record<Port, string> = {
  xlr3: 'XLR3', xlr5: 'XLR5', trs: 'Jack 6,3 TRS', ts: 'Jack 6,3 TS', rca: 'RCA', nl2: 'speakON NL2', nl4: 'speakON NL4',
  bind: 'Клеммы', rj45: 'RJ45', ethercon: 'etherCON',
};

const BAL: Port[] = ['xlr3', 'trs'];
const UNBAL: Port[] = ['ts', 'rca'];

/**
 * Разъём на кабеле со стороны источника (выход прибора) и приёмника (вход прибора).
 * Для XLR: выход прибора — «папа», значит на кабеле «мама»; вход прибора — «мама», на кабеле «папа».
 */
export function cableEnd(p: Port, side: 'src' | 'dst'): string {
  switch (p) {
    case 'xlr3': return side === 'src' ? 'XLR3 мама' : 'XLR3 папа';
    case 'xlr5': return side === 'src' ? 'XLR5 мама' : 'XLR5 папа';
    case 'trs': return 'Jack 6,3 TRS (стерео) папа';
    case 'ts': return 'Jack 6,3 TS (моно) папа';
    case 'rca': return 'RCA папа';
    case 'nl2': return 'speakON NL2FC';
    case 'nl4': return 'speakON NL4FC';
    case 'bind': return 'наконечники под клеммы';
    case 'rj45': return 'RJ45 (8P8C)';
    case 'ethercon': return 'etherCON NE8MC';
  }
}

export interface CableLengthInput {
  horizontal: number;
  vertical: number;
  reservePct: number;
  runs: number;
  type: CableType;
  /** Запас на разделку и подключение на каждом конце, м. */
  endReserve?: number;
  src?: Port;
  dst?: Port;
  /** Список кабелей мероприятия (сохранённые трассы). */
  list?: CableLine[];
}

export interface CableLine {
  purpose: string;
  type: CableType;
  src: Port;
  dst: Port;
  /** Расчётная длина одной линии, м. */
  len: number;
  runs: number;
}

/** L = (Lгор + Lверт) · (1 + запас/100) + 2·запас на конец. */
export function routeLength(horizontal: number, vertical: number, reservePct: number, endReserve = 0): number {
  return (horizontal + vertical) * (1 + reservePct / 100) + 2 * endReserve;
}

export function pickStdLength(len: number): number | undefined {
  return STD_LENGTHS.find((l) => l >= len - 1e-9);
}

/** Проверка пары разъёмов для типа линии. */
export function checkPorts(type: CableType, src: Port, dst: Port): CalcWarning[] {
  const t = CABLE_TYPES[type];
  const out: CalcWarning[] = [];
  for (const [p, side] of [[src, 'источника'], [dst, 'приёмника']] as const) {
    if (!t.ports.includes(p)) out.push({ level: 'crit', text: `Разъём ${PORT_LABEL[p]} со стороны ${side} не подходит для линии «${t.label}». Проверьте тип линии или нужен переходник/устройство (DI-box, конвертер).` });
  }
  if (out.length) return out;
  if ((BAL.includes(src) && UNBAL.includes(dst)) || (UNBAL.includes(src) && BAL.includes(dst))) {
    out.push({ level: 'warn', text: 'Симметричный разъём соединяется с несимметричным: линия станет несимметричной и будет собирать фон. Для длинных линий используйте DI-box или симметрирующий трансформатор.' });
  }
  if (type === 'speaker' && src !== dst && (src === 'nl2' || dst === 'nl2')) {
    out.push({ level: 'info', text: 'NL2 и NL4 совместимы по контактам 1+/1−: сигнал идёт по паре 1. Контакты 2± на NL4 при этом не задействованы.' });
  }
  if (type === 'speaker' && src === 'nl4' && dst === 'nl4') {
    out.push({ level: 'info', text: 'Убедитесь, на какой паре (1± или 2±) кабинет принимает сигнал; у многих сабвуферов и би-амп кабинетов разводка своя.' });
  }
  return out;
}

export function aggregate(list: CableLine[]): CalcTable['rows'] {
  const map = new Map<string, { type: CableType; ends: string; std: number | string; pcs: number }>();
  for (const l of list) {
    const std = pickStdLength(l.len) ?? `бухта ${Math.ceil(l.len)} м`;
    const ends = `${cableEnd(l.src, 'src')} — ${cableEnd(l.dst, 'dst')}`;
    const key = `${l.type}|${ends}|${std}`;
    const e = map.get(key) ?? { type: l.type, ends, std, pcs: 0 };
    e.pcs += l.runs;
    map.set(key, e);
  }
  return [...map.values()]
    .sort((a, b) => a.type.localeCompare(b.type) || String(a.std).localeCompare(String(b.std), 'ru', { numeric: true }))
    .map((e) => [CABLE_TYPES[e.type].label, e.ends, typeof e.std === 'number' ? `${e.std} м` : e.std, `${e.pcs} шт`]);
}

export function cableLength(i: CableLengthInput): CalcResult {
  const endReserve = i.endReserve ?? 0;
  const err = requireFinite([['По горизонтали', i.horizontal], ['По вертикали', i.vertical], ['Запас', i.reservePct], ['Количество линий', i.runs], ['Запас на конец', endReserve]]);
  if (err) return fail(err);
  if (i.horizontal < 0 || i.vertical < 0 || i.reservePct < 0 || endReserve < 0) return fail('Длины и запас не могут быть отрицательными.');
  if (i.horizontal + i.vertical <= 0) return fail('Укажите длину трассы.');
  if (i.runs < 1 || !Number.isInteger(i.runs)) return fail('Количество линий — целое число от 1.');

  const t = CABLE_TYPES[i.type];
  const src = i.src ?? t.ports[0];
  const dst = i.dst ?? t.ports[0];
  const len = routeLength(i.horizontal, i.vertical, i.reservePct, endReserve);
  const std = pickStdLength(len);
  const warnings: CalcWarning[] = [...checkPorts(i.type, src, dst)];
  let level: 'ok' | 'warn' | 'crit' = 'ok';
  if (len > t.maxLen) {
    level = i.type === 'utp' ? 'crit' : 'warn';
    warnings.push({
      level: level === 'crit' ? 'crit' : 'warn',
      text: `Длина ${fx(len, 1)} м больше предела ${t.maxLen} м для этого типа. ${t.note}`,
    });
  }
  if (!std) {
    warnings.push({ level: 'info', text: 'Длиннее 100 м готовых кабелей обычно нет: нужна бухта или удлинение через разъём.' });
  }
  const list = i.list ?? [];
  list.forEach((l, k) => {
    if (l.len > CABLE_TYPES[l.type].maxLen) warnings.push({ level: l.type === 'utp' ? 'crit' : 'warn', text: `Список, строка ${k + 1} (${l.purpose || CABLE_TYPES[l.type].label}): ${fx(l.len, 1)} м больше предела ${CABLE_TYPES[l.type].maxLen} м.` });
  });

  const tables: CalcTable[] = [];
  if (list.length) {
    tables.push({
      title: `Список кабелей мероприятия (${list.length})`,
      head: ['№', 'Назначение', 'Тип', 'Разъёмы', 'Длина трассы', 'Кабель', 'Шт'],
      rows: list.map((l, k) => [k + 1, l.purpose || '—', CABLE_TYPES[l.type].label, `${cableEnd(l.src, 'src')} — ${cableEnd(l.dst, 'dst')}`, fx(l.len, 1) + ' м', pickStdLength(l.len) ? `${pickStdLength(l.len)} м` : 'бухта', l.runs]),
    });
    tables.push({ title: 'Итого по видам и длинам (что брать со склада)', head: ['Тип', 'Разъёмы', 'Длина', 'Количество'], rows: aggregate(list) });
  }
  const totalM = list.reduce((a, l) => a + (pickStdLength(l.len) ?? Math.ceil(l.len)) * l.runs, 0);

  const results: CalcResult['results'] = [
    { label: 'Длина одной линии', value: len, unit: 'м', digits: 1, primary: true, level },
    { label: 'Готовый кабель', value: std ? std : '—', unit: std ? 'м' : '', digits: 0 },
    { label: 'Разъём со стороны источника', value: cableEnd(src, 'src') },
    { label: 'Разъём со стороны приёмника', value: cableEnd(dst, 'dst') },
    { label: 'Всего кабеля', value: std ? std * i.runs : len * i.runs, unit: 'м', digits: 0 },
    { label: 'Предел длины для типа', value: t.maxLen, unit: 'м', digits: 0 },
  ];
  if (list.length) results.push({ label: 'В списке мероприятия всего', value: totalM, unit: 'м', digits: 0 });

  return {
    formulas: ['L = (L_гор + L_верт) · (1 + запас / 100) + 2 · запас на конец', 'Итого = L_станд · N'],
    inputs: [
      { label: 'Тип линии', value: t.label },
      { label: 'Разъёмы приборов', value: `${PORT_LABEL[src]} → ${PORT_LABEL[dst]}` },
      { label: 'По горизонтали', value: i.horizontal, unit: 'м', digits: 1 },
      { label: 'По вертикали (подъёмы, спуски)', value: i.vertical, unit: 'м', digits: 1 },
      { label: 'Запас на трассу', value: i.reservePct, unit: '%', digits: 0 },
      { label: 'Запас на каждом конце', value: endReserve, unit: 'м', digits: 1 },
      { label: 'Количество линий N', value: i.runs, digits: 0 },
    ],
    results,
    explain: [
      `Трасса ${rn(i.horizontal + i.vertical)} м плюс ${rn(i.reservePct)} % на обходы и по ${rn(endReserve)} м на каждый конец — ${fx(len, 1)} м. Берём ближайший готовый кабель${std ? ` ${std} м` : ''}.`,
      'Нажмите «Добавить в список», чтобы собрать все линии мероприятия: внизу появится сводка, сколько каких кабелей брать со склада.',
    ],
    tables,
    limits: [
      'Трасса считается как сумма горизонтальных и вертикальных участков; обходы препятствий заложите в запас (обычно 10–20 %).',
      t.note,
      'Пределы для аналоговых линий — практические рекомендации, а не жёсткий стандарт; для UTP и DMX512 — требования стандартов.',
      'Пол рода разъёма на кабеле указан для обычной разводки: выход прибора «папа», вход «мама». Проверьте свои приборы.',
    ],
    warnings,
  };
}

export function parseList(s: string | undefined): CableLine[] {
  try {
    const a = JSON.parse(s || '[]');
    return Array.isArray(a) ? a.filter((x) => x && x.type in CABLE_TYPES && typeof x.len === 'number') : [];
  } catch {
    return [];
  }
}

export function lineFromValues(v: Values): CableLine | null {
  const type = (v.type in CABLE_TYPES ? v.type : 'mic') as CableType;
  const len = routeLength(num(v.horizontal), num(v.vertical), num(v.reservePct), num(v.endReserve) || 0);
  const runs = num(v.runs);
  if (!Number.isFinite(len) || len <= 0 || !(runs >= 1)) return null;
  return { purpose: (v.purpose ?? '').trim(), type, src: (v.src as Port) || CABLE_TYPES[type].ports[0], dst: (v.dst as Port) || CABLE_TYPES[type].ports[0], len, runs: Math.round(runs) };
}

const portOpts = (v: Values) => {
  const t = CABLE_TYPES[(v.type in CABLE_TYPES ? v.type : 'mic') as CableType];
  return t.ports.map((p) => ({ value: p, label: PORT_LABEL[p] }));
};

export const cableLengthTool: ToolDef = {
  id: 'cable-length',
  title: 'Длина и тип кабеля',
  short: 'трасса, запас, разъёмы, список кабелей',
  fields: [
    {
      key: 'type', label: 'Тип линии', type: 'select',
      options: (Object.keys(CABLE_TYPES) as CableType[]).map((k) => ({ value: k, label: CABLE_TYPES[k].label })),
    },
    { key: 'src', label: 'Разъём на выходе прибора', type: 'select', optionsFn: portOpts },
    { key: 'dst', label: 'Разъём на входе прибора', type: 'select', optionsFn: portOpts },
    { key: 'horizontal', label: 'По горизонтали', unit: 'м', type: 'number' },
    { key: 'vertical', label: 'По вертикали', unit: 'м', type: 'number' },
    { key: 'reservePct', label: 'Запас на трассу', unit: '%', type: 'number', step: 5 },
    { key: 'endReserve', label: 'Запас на каждом конце', unit: 'м', type: 'number', step: 0.5 },
    { key: 'runs', label: 'Количество линий', unit: 'шт', type: 'number', step: 1 },
    { key: 'purpose', label: 'Назначение (для списка)', type: 'text', hint: 'Например: Вокал 1 → стейджбокс' },
  ],
  defaults: { type: 'mic', src: 'xlr3', dst: 'xlr3', horizontal: '12', vertical: '2', reservePct: '15', endReserve: '0', runs: '8', purpose: '', list: '[]' },
  compute: (v) => {
    const type = (v.type in CABLE_TYPES ? v.type : 'mic') as CableType;
    const ports = CABLE_TYPES[type].ports;
    return cableLength({
      type, horizontal: num(v.horizontal), vertical: num(v.vertical), reservePct: num(v.reservePct), runs: num(v.runs),
      endReserve: num(v.endReserve) || 0,
      src: ports.includes(v.src as Port) ? (v.src as Port) : ports[0], dst: ports.includes(v.dst as Port) ? (v.dst as Port) : ports[0],
      list: parseList(v.list),
    });
  },
  panel: CableListPanel,
};

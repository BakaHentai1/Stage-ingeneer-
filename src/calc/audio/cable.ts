import { CalcResult, CalcWarning, ToolDef, fail, lg, num, requireFinite, fx, rn } from '../types';

/** Удельное сопротивление меди при 20 °C, Ом·мм²/м. */
export const RHO_CU = 0.0175;
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
  z: number;
  lossMax: number;
}

export function cableLoss(i: CableLossInput): CalcResult {
  const err = requireFinite([['Длина', i.length], ['Сечение', i.section], ['Импеданс', i.z], ['Допустимые потери', i.lossMax]]);
  if (err) return fail(err);
  if (i.length <= 0 || i.section <= 0 || i.z <= 0) return fail('Длина, сечение и импеданс должны быть больше 0.');
  if (i.lossMax <= 0) return fail('Допустимые потери должны быть больше 0 дБ.');

  const r = lineResistance(i.length, i.section);
  const loss = lossDb(i.z, r);
  const ratio = i.z / (i.z + r);
  const powerLossPct = (1 - ratio * ratio) * 100;
  const df = i.z / r;
  const aMin = minSection(i.length, i.z, i.lossMax);
  const aStd = SECTIONS.find((s) => s >= aMin - 1e-9);
  const warnings: CalcWarning[] = [];
  const level = loss > i.lossMax ? 'warn' : 'ok';
  if (loss > i.lossMax) {
    warnings.push({ level: 'warn', text: `Потери ${fx(loss, 2)} дБ больше допустимых ${rn(i.lossMax)} дБ: увеличьте сечение или сократите длину.` });
  }
  if (!aStd) {
    warnings.push({ level: 'warn', text: 'Нужно сечение больше 10 мм²: поставьте усилитель ближе к акустике.' });
  }

  return {
    formulas: [
      'R = 2·ρ·L / A,   ρ(Cu, 20 °C) = 0,0175 Ом·мм²/м',
      'ΔL = 20·lg((Z + R) / Z)',
      'Потери мощности = 1 − (Z / (Z + R))²',
      'A_мин = 2·ρ·L / (Z·(10^(ΔL_доп/20) − 1))',
    ],
    inputs: [
      { label: 'Длина кабеля L (в одну сторону)', value: i.length, unit: 'м', digits: 1 },
      { label: 'Сечение жилы A', value: i.section, unit: 'мм²', digits: 2 },
      { label: 'Импеданс нагрузки Z', value: i.z, unit: 'Ом', digits: 1 },
      { label: 'Допустимые потери', value: i.lossMax, unit: 'дБ', digits: 2 },
    ],
    results: [
      { label: 'Потери уровня', value: loss, unit: 'дБ', digits: 2, primary: true, level },
      { label: 'Сопротивление линии', value: r, unit: 'Ом', digits: 3 },
      { label: 'Потери мощности', value: powerLossPct, unit: '%', digits: 1 },
      { label: 'Демпинг-фактор кабеля Z/R', value: df, digits: 0 },
      { label: 'Минимальное сечение', value: aMin, unit: 'мм²', digits: 2 },
      { label: 'Ближайшее стандартное', value: aStd ? String(aStd).replace('.', ',') : '> 10', unit: 'мм²' },
    ],
    limits: [
      'Медный кабель при 20 °C. Нагрев на 30 °C увеличивает сопротивление примерно на 12 %; кабель CCA (омеднённый алюминий) имеет сопротивление в ~1,6 раза выше.',
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
  short: 'сечение и длина линии',
  fields: [
    { key: 'length', label: 'Длина кабеля (в одну сторону)', unit: 'м', type: 'number' },
    {
      key: 'section', label: 'Сечение жилы', type: 'select',
      options: SECTIONS.map((s) => ({ value: String(s), label: `${String(s).replace('.', ',')} мм²` })),
    },
    { key: 'z', label: 'Импеданс нагрузки', unit: 'Ом', type: 'number' },
    { key: 'lossMax', label: 'Допустимые потери', unit: 'дБ', type: 'number', step: 0.1 },
  ],
  defaults: { length: '25', section: '2.5', z: '8', lossMax: '0.5' },
  compute: (v) => cableLoss({ length: num(v.length), section: num(v.section), z: num(v.z), lossMax: num(v.lossMax) }),
};

/* ---------------- Длина и тип кабеля ---------------- */

export type CableType = 'mic' | 'line-bal' | 'unbal' | 'aes' | 'utp' | 'speaker' | 'dmx';

/** Практические ограничения длины. Для UTP — требование стандарта Ethernet. */
export const CABLE_TYPES: Record<CableType, { label: string; connector: string; maxLen: number; note: string }> = {
  mic: { label: 'Микрофонный, симметричный', connector: 'XLR3 (m–f)', maxLen: 100, note: 'Практический предел ~100 м; при фантомном питании и длине больше 50 м проверьте падение напряжения.' },
  'line-bal': { label: 'Линейный симметричный', connector: 'XLR3 или Jack TRS', maxLen: 100, note: 'Симметричная линия устойчива к наводкам; практический предел около 100 м.' },
  unbal: { label: 'Несимметричный', connector: 'Jack TS или RCA', maxLen: 5, note: 'Несимметричная линия собирает наводки. Длиннее 5 м — используйте DI-box и симметричную линию.' },
  aes: { label: 'Цифровой AES/EBU, 110 Ом', connector: 'XLR3', maxLen: 100, note: 'Нужен кабель 110 Ом; микрофонный кабель на длинных линиях даёт ошибки.' },
  utp: { label: 'Сетевой (стейджбокс, Dante и т. п.)', connector: 'RJ45 / etherCON', maxLen: 100, note: 'Стандарт Ethernet: не более 100 м на сегмент. Рекомендуется Cat5e/Cat6 в экране, с etherCON для сцены.' },
  speaker: { label: 'Акустический', connector: 'speakON NL2/NL4', maxLen: 100, note: 'Сечение подбирайте в расчёте потерь в кабеле.' },
  dmx: { label: 'DMX512, 120 Ом', connector: 'XLR5 или XLR3', maxLen: 300, note: 'Кабель 120 Ом, до 32 устройств и не более 300 м на линию, терминатор 120 Ом в конце.' },
};

export interface CableLengthInput {
  horizontal: number;
  vertical: number;
  reservePct: number;
  runs: number;
  type: CableType;
}

/** L = (Lгор + Lверт) · (1 + запас/100), округление вверх до стандартной длины. */
export function routeLength(horizontal: number, vertical: number, reservePct: number): number {
  return (horizontal + vertical) * (1 + reservePct / 100);
}

export function pickStdLength(len: number): number | undefined {
  return STD_LENGTHS.find((l) => l >= len - 1e-9);
}

export function cableLength(i: CableLengthInput): CalcResult {
  const err = requireFinite([['По горизонтали', i.horizontal], ['По вертикали', i.vertical], ['Запас', i.reservePct], ['Количество линий', i.runs]]);
  if (err) return fail(err);
  if (i.horizontal < 0 || i.vertical < 0 || i.reservePct < 0) return fail('Длины и запас не могут быть отрицательными.');
  if (i.horizontal + i.vertical <= 0) return fail('Укажите длину трассы.');
  if (i.runs < 1 || !Number.isInteger(i.runs)) return fail('Количество линий — целое число от 1.');

  const t = CABLE_TYPES[i.type];
  const len = routeLength(i.horizontal, i.vertical, i.reservePct);
  const std = pickStdLength(len);
  const warnings: CalcWarning[] = [];
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

  return {
    formulas: ['L = (L_гор + L_верт) · (1 + запас / 100)', 'Итого = L_станд · N'],
    inputs: [
      { label: 'Тип линии', value: t.label },
      { label: 'По горизонтали', value: i.horizontal, unit: 'м', digits: 1 },
      { label: 'По вертикали (подъёмы, спуски)', value: i.vertical, unit: 'м', digits: 1 },
      { label: 'Запас на трассу и разделку', value: i.reservePct, unit: '%', digits: 0 },
      { label: 'Количество линий N', value: i.runs, digits: 0 },
    ],
    results: [
      { label: 'Длина одной линии', value: len, unit: 'м', digits: 1, primary: true, level },
      { label: 'Готовый кабель', value: std ? std : '—', unit: std ? 'м' : '' },
      { label: 'Разъёмы', value: t.connector },
      { label: 'Всего кабеля', value: std ? std * i.runs : len * i.runs, unit: 'м', digits: 0 },
      { label: 'Предел длины для типа', value: t.maxLen, unit: 'м', digits: 0 },
    ],
    limits: [
      'Трасса считается как сумма горизонтальных и вертикальных участков; обходы препятствий заложите в запас (обычно 10–20 %).',
      t.note,
      'Пределы для аналоговых линий — практические рекомендации, а не жёсткий стандарт; для UTP и DMX512 — требования стандартов.',
    ],
    warnings,
  };
}

export const cableLengthTool: ToolDef = {
  id: 'cable-length',
  title: 'Длина и тип кабеля',
  short: 'трасса, запас, разъёмы',
  fields: [
    {
      key: 'type', label: 'Тип линии', type: 'select',
      options: (Object.keys(CABLE_TYPES) as CableType[]).map((k) => ({ value: k, label: CABLE_TYPES[k].label })),
    },
    { key: 'horizontal', label: 'По горизонтали', unit: 'м', type: 'number' },
    { key: 'vertical', label: 'По вертикали', unit: 'м', type: 'number' },
    { key: 'reservePct', label: 'Запас', unit: '%', type: 'number', step: 5 },
    { key: 'runs', label: 'Количество линий', unit: 'шт', type: 'number', step: 1 },
  ],
  defaults: { type: 'mic', horizontal: '12', vertical: '2', reservePct: '15', runs: '8' },
  compute: (v) =>
    cableLength({
      type: (v.type in CABLE_TYPES ? v.type : 'mic') as CableType,
      horizontal: num(v.horizontal), vertical: num(v.vertical), reservePct: num(v.reservePct), runs: num(v.runs),
    }),
};

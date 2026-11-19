/**
 * Модуль C. Справочные данные пультов для патчинга и маршрутизации.
 * Источник для Allen & Heath: Qu Mixer Reference Guide (AP9372), Qu-16 User Guide (AP9031),
 * блок-схема Qu-16 V1.8 (allen-heath.com). Здесь только то, что подтверждено документацией.
 */

export type ConsoleId = 'qu16' | 'qu24' | 'analog';

export interface ConsoleProfile {
  id: ConsoleId;
  label: string;
  digital: boolean;
  /** Моно каналы mic/line. */
  mono: number;
  /** Стерео линейные каналы ST. */
  stereo: number;
  /** Шины FX send (у Qu). */
  fxSends: number;
  /** Стерео группы. */
  groups: number;
  /** Стерео матрицы. */
  matrix: number;
  facts: string[];
}

export const CONSOLES: Record<ConsoleId, ConsoleProfile> = {
  qu16: {
    id: 'qu16', label: 'Allen & Heath Qu-16', digital: true, mono: 16, stereo: 3, fxSends: 2, groups: 0, matrix: 0,
    facts: [
      '16 моно каналов (на каждый канал XLR Mic и Jack TRS Line), стерео входы ST1, ST2 (Jack TRS L/R) и ST3.',
      'Миксы: Mix 1–4 моно, Mix 5/6, 7/8, 9/10 стерео, главный LR. Каждый микс — свой XLR на задней панели.',
      '4 встроенных FX-процессора. Шин FX send только две (FX1, FX2); FX3 и FX4 питаются от Mix 1–10 или включаются в разрыв (Insert).',
      'Групп и матриц у Qu-16 нет.',
      'Alt Out (Jack TRS L/R) и AES (XLR, цифровой) — источник назначается в Setup → I/O Patch → Surface. 2TRK Out всегда несёт LR после фейдера.',
      'dSNAKE (EtherCon): стейджбоксы AR2412, AB168, AR84. Кабель Cat5e STP до 120 м, рекомендовано до 100 м.',
    ],
  },
  qu24: {
    id: 'qu24', label: 'Allen & Heath Qu-24', digital: true, mono: 24, stereo: 3, fxSends: 4, groups: 2, matrix: 2,
    facts: [
      '24 моно канала (XLR Mic и Jack TRS Line на каждый), стерео входы ST1–ST3.',
      'Миксы: Mix 1–4 моно, Mix 5/6, 7/8, 9/10 стерео, главный LR — каждый на своём XLR.',
      '4 шины FX send (FX1–FX4) на 4 встроенных FX-процессора.',
      '2 стерео группы (Group 1/2, 3/4). Группу можно перевести в Mix Mode — тогда стерео миксов становится 5.',
      '2 стерео матрицы. В матрицу отправляются LR, миксы и группы. Матрицу можно назначить на Alt Out, AES, USB и выходы стейджбокса.',
      'Alt Out и AES назначаются в Setup → I/O Patch → Surface. 2TRK Out всегда несёт LR после фейдера.',
      'dSNAKE (EtherCon): AR2412, AB168, AR84. Cat5e STP до 120 м, рекомендовано до 100 м.',
    ],
  },
  analog: {
    id: 'analog', label: 'Аналоговый пульт', digital: false, mono: 16, stereo: 0, fxSends: 0, groups: 0, matrix: 0,
    facts: [
      'Патч физический: разъём входа жёстко равен каналу, переназначить можно только перекоммутацией кабелей.',
      'AUX-посылы бывают pre-fader (мониторы) и post-fader (эффекты). Переключатель pre/post — на канале или на всю шину, зависит от модели.',
      'Эффекты подключаются кабелями: AUX Send → вход процессора, выход процессора → Return или свободный канал.',
    ],
  },
};

export type RackId = 'AR2412' | 'AB168' | 'AR84';
export const RACKS: Record<RackId, { label: string; inputs: number; outputs: number }> = {
  AR2412: { label: 'AR2412 (24 вх / 12 вых)', inputs: 24, outputs: 12 },
  AB168: { label: 'AB168 (16 вх / 8 вых)', inputs: 16, outputs: 8 },
  AR84: { label: 'AR84 (8 вх / 4 вых)', inputs: 8, outputs: 4 },
};

/** dSNAKE: предел и рекомендация по длине (Reference Guide). */
export const DSNAKE_MAX_M = 120;
export const DSNAKE_REC_M = 100;

/* ---------------- Шины ---------------- */

export type BusKind = 'main' | 'mix' | 'fx' | 'group' | 'matrix';

export interface Bus {
  id: string;
  label: string;
  kind: BusKind;
  stereo: boolean;
  /** Половины стерео шины, которые выходят на отдельные XLR (Mix 5 и Mix 6). */
  legs?: [string, string];
}

/** Все шины выбранного Qu. */
export function busesOf(c: ConsoleProfile): Bus[] {
  if (!c.digital) return [];
  const b: Bus[] = [{ id: 'LR', label: 'Main LR', kind: 'main', stereo: true, legs: ['L', 'R'] }];
  for (let i = 1; i <= 4; i++) b.push({ id: `Mix${i}`, label: `Mix ${i}`, kind: 'mix', stereo: false });
  for (const i of [5, 7, 9]) b.push({ id: `Mix${i}/${i + 1}`, label: `Mix ${i}/${i + 1}`, kind: 'mix', stereo: true, legs: [`Mix${i}`, `Mix${i + 1}`] });
  for (let i = 1; i <= c.fxSends; i++) b.push({ id: `FX${i}`, label: `FX${i} send`, kind: 'fx', stereo: false });
  for (let i = 1; i <= c.groups; i++) b.push({ id: `Grp${2 * i - 1}/${2 * i}`, label: `Group ${2 * i - 1}/${2 * i}`, kind: 'group', stereo: true });
  for (let i = 1; i <= c.matrix; i++) b.push({ id: `MTX${i}`, label: `Matrix ${i}`, kind: 'matrix', stereo: true });
  return b;
}

export function findBus(c: ConsoleProfile, id: string): Bus | undefined {
  return busesOf(c).find((b) => b.id === id);
}

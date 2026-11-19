/**
 * Модуль C. Патчинг: какой источник в какой физический разъём (физика)
 * и какой разъём на какой канал или шину на какой выход (цифра).
 * Чистые функции, проверяются тестами.
 */
import type { CalcWarning } from '../calc/types';
import { CONSOLES, DSNAKE_MAX_M, DSNAKE_REC_M, RACKS, busesOf, findBus, type Bus, type ConsoleId, type RackId } from './qu';

/* ---------------- Входы ---------------- */

export type InKind = 'dyn' | 'cond' | 'di-active' | 'di-passive' | 'wireless' | 'line' | 'playback';

export const IN_KINDS: Record<InKind, { label: string; phantom: boolean; mic: boolean; cable: string }> = {
  dyn: { label: 'Динамический микрофон', phantom: false, mic: true, cable: 'XLR — XLR' },
  cond: { label: 'Конденсаторный микрофон', phantom: true, mic: true, cable: 'XLR — XLR' },
  'di-active': { label: 'Активный DI-box', phantom: true, mic: true, cable: 'XLR — XLR (от DI)' },
  'di-passive': { label: 'Пассивный DI-box', phantom: false, mic: true, cable: 'XLR — XLR (от DI)' },
  wireless: { label: 'Приёмник радиосистемы', phantom: false, mic: true, cable: 'XLR — XLR' },
  line: { label: 'Линейный симметричный выход', phantom: false, mic: false, cable: 'XLR — XLR или Jack TRS' },
  playback: { label: 'Плейбэк (ноутбук, телефон)', phantom: false, mic: false, cable: 'mini-jack — 2×Jack TS' },
};

export interface InSource {
  id: string;
  name: string;
  kind: InKind;
  stereo: boolean;
  /** Где физически подключено: на задней панели пульта или в стейджбоксе. */
  loc: 'local' | 'rack';
  /** Номер входа стейджбокса (для стерео — левый, правый следующий). Для local не используется. */
  socket: number;
  /** Канал пульта: 'CH5' или 'ST1'. Стерео на моно каналах занимает CHn и CHn+1. */
  ch: string;
  phantom: boolean;
}

export interface PatchSetup {
  console: Exclude<ConsoleId, 'analog'>;
  rack: RackId | null;
  /** Длина Cat5e от пульта до стейджбокса, м. */
  snakeLen: number;
  inputs: InSource[];
  outputs: OutRow[];
}

export interface InRow {
  src: InSource;
  /** Физический разъём, по каждой стороне стерео. */
  sockets: string[];
  channels: string[];
  phantom: boolean;
  cable: string;
  /** Как это сделать на пульте. */
  how: string[];
}

const chNum = (ch: string) => Number(ch.replace(/\D/g, ''));
const isST = (ch: string) => ch.startsWith('ST');

/** Каналы, которые занимает источник. */
export function channelsOf(s: InSource): string[] {
  if (isST(s.ch)) return [s.ch];
  const n = chNum(s.ch);
  return s.stereo ? [`CH${n}`, `CH${n + 1}`] : [`CH${n}`];
}

/** Физические разъёмы источника. Локальный вход жёстко равен каналу: Mic N → CH N, ST N → ST N. */
export function socketsOf(s: InSource, rack: RackId | null): string[] {
  if (s.loc === 'rack') {
    const r = rack ?? 'AR2412';
    return s.stereo ? [`${r} In ${s.socket}`, `${r} In ${s.socket + 1}`] : [`${r} In ${s.socket}`];
  }
  if (isST(s.ch)) return [`${s.ch} L/R (задняя панель)`];
  return channelsOf(s).map((c) => `Mic/Line ${chNum(c)} (задняя панель)`);
}

/** Автоматическое назначение по порядку: моно на CH1…, стерео плейбэк у пульта на ST1…, остальное стерео — на пары нечётный/чётный. */
export function autoAssign(p: PatchSetup): InSource[] {
  const prof = CONSOLES[p.console];
  let ch = 1;
  let st = 1;
  let sock = 1;
  return p.inputs.map((s) => {
    const loc: InSource['loc'] = p.rack && s.kind !== 'playback' ? 'rack' : 'local';
    let c: string;
    if (s.stereo && !IN_KINDS[s.kind].mic && st <= prof.stereo) {
      c = `ST${st++}`;
    } else {
      if (s.stereo && ch % 2 === 0) ch++;
      c = `CH${ch}`;
      ch += s.stereo ? 2 : 1;
    }
    const out: InSource = { ...s, loc, ch: c, socket: loc === 'rack' ? sock : 1, phantom: IN_KINDS[s.kind].phantom };
    if (loc === 'rack') sock += s.stereo ? 2 : 1;
    return out;
  });
}

export function inputRows(p: PatchSetup): InRow[] {
  return p.inputs.map((s) => {
    const sockets = socketsOf(s, p.rack);
    const channels = channelsOf(s);
    const how: string[] = [];
    if (s.loc === 'local') {
      how.push(isST(s.ch)
        ? `Кабель в ${s.ch} на задней панели. Стерео канал ${s.ch} на верхнем слое фейдеров.`
        : `Кабель в разъём ${chNum(s.ch)}${s.stereo ? ` и ${chNum(s.ch) + 1}` : ''} на задней панели. Локальный вход всегда приходит на канал с тем же номером.`);
      how.push(`Sel канала → Processing → Preamp → Fn → Source: Local (стоит по умолчанию).`);
    } else {
      how.push(`Кабель в ${sockets.join(' и ')} на стейджбоксе.`);
      how.push(`Setup → I/O Patch → dSNAKE In: вход ${s.socket}${s.stereo ? ` и ${s.socket + 1}` : ''} → ${channels.join(' и ')}.`);
      how.push(`Sel канала → Processing → Preamp → Fn → Source: dSNAKE.`);
    }
    if (s.phantom) how.push(`48V: Sel → Processing → Preamp, кнопку 48V удерживать 1 секунду.`);
    if (s.stereo && !isST(s.ch)) how.push(`Связать ${channels.join(' и ')} в стерео: Sel → Processing → Preamp, функция стерео связки каналов (Stereo Link; связываются соседние каналы, начиная с нечётного).`);
    return { src: s, sockets, channels, phantom: s.phantom, cable: IN_KINDS[s.kind].cable, how };
  });
}

/* ---------------- Выходы ---------------- */

export type DestKind = 'mains' | 'sub' | 'monitor' | 'iem' | 'record' | 'zone';

export const DEST_KINDS: Record<DestKind, string> = {
  mains: 'Порталы (основной звук)',
  sub: 'Сабвуферы',
  monitor: 'Сценический монитор',
  iem: 'In-ear (ушной монитор)',
  record: 'Запись / трансляция',
  zone: 'Доп. зона, задержки, фойе',
};

export interface OutRow {
  id: string;
  name: string;
  dest: DestKind;
  /** id шины: 'LR', 'Mix1', 'Mix5/6', 'MTX1'… */
  bus: string;
  /** Для моно разъёма от стерео шины: какая сторона. */
  leg: 'L' | 'R' | null;
  /** 'XLR:L', 'XLR:R', 'XLR:Mix3', 'ALT', 'AES', '2TRK', 'RACK:5'. */
  socket: string;
}

export interface SocketDef {
  id: string;
  label: string;
  stereo: boolean;
  /** Жёстко связан с шиной (сторона шины). */
  fixed?: { bus: string; leg: 'L' | 'R' | null };
  patchPath?: string;
}

export function socketsAvailable(p: PatchSetup): SocketDef[] {
  const s: SocketDef[] = [
    { id: 'XLR:L', label: 'XLR L (Main)', stereo: false, fixed: { bus: 'LR', leg: 'L' } },
    { id: 'XLR:R', label: 'XLR R (Main)', stereo: false, fixed: { bus: 'LR', leg: 'R' } },
  ];
  for (let i = 1; i <= 10; i++) {
    const bus = i <= 4 ? `Mix${i}` : `Mix${i % 2 ? i : i - 1}/${i % 2 ? i + 1 : i}`;
    s.push({ id: `XLR:Mix${i}`, label: `XLR Mix ${i}`, stereo: false, fixed: { bus, leg: i <= 4 ? null : i % 2 ? 'L' : 'R' } });
  }
  s.push({ id: 'ALT', label: 'Alt Out L/R (2×Jack TRS)', stereo: true, patchPath: 'Setup → I/O Patch → Surface → Alt Out' });
  s.push({ id: 'AES', label: 'AES Out (XLR, цифровой)', stereo: true, patchPath: 'Setup → I/O Patch → Surface → AES' });
  s.push({ id: '2TRK', label: '2TRK Out L/R (Jack TRS)', stereo: true, fixed: { bus: 'LR', leg: null } });
  if (p.rack) {
    for (let i = 1; i <= RACKS[p.rack].outputs; i++) s.push({ id: `RACK:${i}`, label: `${p.rack} Out ${i}`, stereo: false, patchPath: `Setup → I/O Patch → dSNAKE Out → выход ${i}` });
  }
  return s;
}

export function socketLabel(p: PatchSetup, id: string): string {
  return socketsAvailable(p).find((s) => s.id === id)?.label ?? id;
}

/** Что физически выходит из разъёма. */
export function signalLabel(p: PatchSetup, o: OutRow): string {
  const bus = findBus(CONSOLES[p.console], o.bus);
  if (!bus) return o.bus;
  const sock = socketsAvailable(p).find((s) => s.id === o.socket);
  if (bus.stereo && sock && !sock.stereo) return `${bus.label} ${o.leg ?? 'L'}`;
  return bus.label;
}

export interface OutCheck extends OutRow {
  socketLabel: string;
  signal: string;
  how: string;
}

/* ---------------- Проверки ---------------- */

export interface PatchResult {
  inputs: InRow[];
  outputs: OutCheck[];
  warnings: (CalcWarning & { row?: string })[];
  usage: { label: string; used: number; total: number }[];
}

export function checkPatch(p: PatchSetup): PatchResult {
  const prof = CONSOLES[p.console];
  const w: PatchResult['warnings'] = [];
  const inputs = inputRows(p);
  const chOwner = new Map<string, string>();
  const sockOwner = new Map<number, string>();

  for (const r of inputs) {
    const s = r.src;
    const k = IN_KINDS[s.kind];
    for (const c of r.channels) {
      if (isST(c) ? chNum(c) > prof.stereo || chNum(c) < 1 : chNum(c) > prof.mono || chNum(c) < 1) {
        w.push({ level: 'crit', row: s.id, text: `«${s.name}»: у ${prof.label} нет канала ${c}.` });
      }
      const prev = chOwner.get(c);
      if (prev) w.push({ level: 'crit', row: s.id, text: `«${s.name}» и «${prev}» назначены на один канал ${c}. На канал приходит только один источник.` });
      else chOwner.set(c, s.name);
    }
    if (s.loc === 'rack') {
      if (!p.rack) w.push({ level: 'crit', row: s.id, text: `«${s.name}» подключён в стейджбокс, а стейджбокс не выбран.` });
      const n = s.stereo ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const sk = s.socket + i;
        if (p.rack && (sk > RACKS[p.rack].inputs || sk < 1)) w.push({ level: 'crit', row: s.id, text: `«${s.name}»: у ${p.rack} нет входа ${sk} (всего ${RACKS[p.rack].inputs}).` });
        const prev = sockOwner.get(sk);
        if (prev) w.push({ level: 'crit', row: s.id, text: `«${s.name}» и «${prev}» воткнуты в один вход стейджбокса ${sk}. В разъём входит один кабель. (Обратное можно: один вход стейджбокса раздать на несколько каналов.)` });
        else sockOwner.set(sk, s.name);
      }
    }
    if (isST(s.ch) && k.mic) {
      w.push({ level: 'crit', row: s.id, text: `«${s.name}»: ${s.ch} — линейный стерео вход без микрофонного предусилителя и 48V. Микрофон или DI подключайте в моно канал.` });
    }
    if (isST(s.ch) && !s.stereo) {
      w.push({ level: 'info', row: s.id, text: `«${s.name}» — моно источник на стерео входе ${s.ch}: на стерео входах Qu левый вход дублируется в правый, если правый не подключён.` });
    }
    if (s.stereo && !isST(s.ch) && chNum(s.ch) % 2 === 0) {
      w.push({ level: 'warn', row: s.id, text: `«${s.name}»: стерео пара ${r.channels.join('+')} начинается с чётного канала, такие каналы не связываются в стерео. Начните с нечётного.` });
    }
    if (k.phantom && !s.phantom) w.push({ level: 'warn', row: s.id, text: `«${s.name}»: ${k.label.toLowerCase()} без 48V работать не будет. Включите фантомное питание.` });
    if (s.phantom && !k.mic) w.push({ level: 'warn', row: s.id, text: `«${s.name}»: 48V на линейном источнике не нужно и может повредить несимметричный выход. Выключите.` });
    if (s.phantom && isST(s.ch)) w.push({ level: 'crit', row: s.id, text: `«${s.name}»: на входах ${s.ch} нет фантомного питания.` });
    if (s.kind === 'playback' && s.loc === 'rack') w.push({ level: 'info', row: s.id, text: `«${s.name}»: плейбэк на сцене подключайте через DI-box, длинный несимметричный кабель собирает помехи.` });
  }

  if (p.rack && p.inputs.some((s) => s.loc === 'rack') || (p.rack && p.outputs.some((o) => o.socket.startsWith('RACK')))) {
    if (p.snakeLen > DSNAKE_MAX_M) w.push({ level: 'crit', text: `Cat5e до стейджбокса ${p.snakeLen} м — больше предела dSNAKE ${DSNAKE_MAX_M} м. Связь не гарантируется.` });
    else if (p.snakeLen > DSNAKE_REC_M) w.push({ level: 'warn', text: `Cat5e ${p.snakeLen} м: Allen & Heath рекомендует до ${DSNAKE_REC_M} м (предел ${DSNAKE_MAX_M} м). Нужен экранированный STP кабель хорошего качества.` });
  }

  /* --- выходы --- */
  const socks = socketsAvailable(p);
  const sockUsed = new Map<string, string>();
  const outputs: OutCheck[] = [];
  const busDest = new Map<string, Set<DestKind>>();
  for (const o of p.outputs) {
    const sd = socks.find((s) => s.id === o.socket);
    const bus: Bus | undefined = findBus(prof, o.bus);
    let how = '';
    if (!sd) {
      w.push({ level: 'crit', row: o.id, text: `«${o.name}»: разъёма ${o.socket.replace('RACK:', 'стейджбокса ')} нет в этой конфигурации.` });
    } else if (sd.fixed) {
      how = `Разъём жёстко связан с ${sd.fixed.bus === 'LR' ? 'LR' : sd.fixed.bus.replace('Mix', 'Mix ')}, в меню назначать не нужно.`;
      if (sd.id === '2TRK') how = '2TRK всегда несёт LR после мастер-фейдера.';
      const legOk = sd.fixed.leg === null || sd.fixed.leg === o.leg || !bus?.stereo;
      if (o.bus !== sd.fixed.bus) {
        w.push({ level: 'crit', row: o.id, text: `«${o.name}»: ${sd.label} всегда выдаёт ${sd.fixed.bus === 'LR' ? 'Main LR' : findBus(prof, sd.fixed.bus)?.label}, а не ${bus?.label ?? o.bus}. Возьмите разъём этой шины или Alt Out / выход стейджбокса.` });
      } else if (!legOk) {
        w.push({ level: 'warn', row: o.id, text: `«${o.name}»: на ${sd.label} выходит сторона ${sd.fixed.leg}, а указана ${o.leg}.` });
      }
    } else if (sd.patchPath) {
      how = `${sd.patchPath}: ${bus?.label ?? o.bus}${bus?.stereo && !sd.stereo ? ` ${o.leg ?? 'L'}` : ''}.`;
    }
    if (sd) {
      const prev = sockUsed.get(sd.id);
      if (prev) w.push({ level: 'crit', row: o.id, text: `«${o.name}» и «${prev}» на одном разъёме ${sd.label}. Один выход — один кабель; для двух приборов используйте сквозной выход (Thru) первого прибора.` });
      else sockUsed.set(sd.id, o.name);
    }
    if (!bus) {
      w.push({ level: 'crit', row: o.id, text: `«${o.name}»: у ${prof.label} нет шины ${o.bus}.` });
    } else {
      if (bus.kind === 'fx') w.push({ level: 'warn', row: o.id, text: `«${o.name}»: ${bus.label} — посыл на встроенный процессор эффектов, на акустику его не выводят.` });
      if (bus.kind === 'group') w.push({ level: 'warn', row: o.id, text: `«${o.name}»: группа — это подмикс, который обычно идёт в LR. Для отдельного выхода берите Mix или Matrix (либо переведите группу в Mix Mode).` });
      if (bus.stereo && sd && !sd.stereo && !o.leg && !sd.fixed) w.push({ level: 'info', row: o.id, text: `«${o.name}»: стерео шина на моно разъёме — выберите сторону L или R.` });
      const set = busDest.get(bus.id) ?? new Set<DestKind>();
      set.add(o.dest);
      busDest.set(bus.id, set);
      if ((o.dest === 'monitor' || o.dest === 'iem') && bus.kind === 'main') {
        w.push({ level: 'warn', row: o.id, text: `«${o.name}»: монитор от Main LR повторяет зал и меняется вместе с мастером. Дайте ему свой Mix (pre-fader).` });
      }
      if (o.dest === 'iem' && !bus.stereo) w.push({ level: 'info', row: o.id, text: `«${o.name}»: для in-ear удобнее стерео микс (Mix 5/6, 7/8, 9/10).` });
      if (o.dest === 'mains' && bus.kind !== 'main' && bus.kind !== 'matrix') w.push({ level: 'info', row: o.id, text: `«${o.name}»: основной звук обычно идёт с Main LR.` });
      if (o.dest === 'record' && bus.kind === 'main') {
        w.push({ level: 'info', row: o.id, text: prof.matrix
          ? `«${o.name}»: запись от LR зависит от мастер-фейдера и обработки зала. Для отдельного уровня — Matrix.`
          : `«${o.name}»: запись от LR зависит от мастер-фейдера. Матриц у Qu-16 нет; для отдельного уровня можно собрать свободный Mix post-fader.` });
      }
    }
    outputs.push({ ...o, socketLabel: sd?.label ?? o.socket, signal: signalLabel(p, o), how });
  }
  for (const [b, set] of busDest) {
    if (set.size > 1 && [...set].some((d) => d === 'monitor' || d === 'iem') && [...set].some((d) => d !== 'monitor' && d !== 'iem')) {
      w.push({ level: 'warn', text: `Шина ${findBus(prof, b)?.label} одновременно идёт на монитор и на ${[...set].filter((d) => d !== 'monitor' && d !== 'iem').map((d) => DEST_KINDS[d].toLowerCase()).join(', ')}. Изменение монитора поменяет и это направление.` });
    }
  }
  const mains = p.outputs.filter((o) => o.dest === 'mains');
  if (mains.length) {
    const legs = new Set(mains.map((o) => socks.find((s) => s.id === o.socket)?.fixed?.leg ?? o.leg));
    if (!(legs.has('L') && legs.has('R')) && !mains.some((o) => socks.find((s) => s.id === o.socket)?.stereo)) {
      w.push({ level: 'warn', text: 'На порталы выведена только одна сторона LR. Проверьте, есть ли второй портал.' });
    }
  }

  const monoUsed = new Set([...chOwner.keys()].filter((c) => !isST(c))).size;
  const stUsed = new Set([...chOwner.keys()].filter(isST)).size;
  const usage = [
    { label: 'Моно каналы', used: monoUsed, total: prof.mono },
    { label: 'Стерео входы ST', used: stUsed, total: prof.stereo },
  ];
  if (p.rack) usage.push({ label: `Входы ${p.rack}`, used: sockOwner.size, total: RACKS[p.rack].inputs });
  if (p.rack) usage.push({ label: `Выходы ${p.rack}`, used: p.outputs.filter((o) => o.socket.startsWith('RACK')).length, total: RACKS[p.rack].outputs });

  return { inputs, outputs, warnings: w, usage };
}

export const busOptions = (c: Exclude<ConsoleId, 'analog'>) => busesOf(CONSOLES[c]).map((b) => [b.id, b.label] as [string, string]);

/* ---------------- Примеры ---------------- */

let seq = 0;
export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function presetConference(console: PatchSetup['console'] = 'qu16'): PatchSetup {
  const inputs: InSource[] = [];
  for (let i = 1; i <= 6; i++) inputs.push({ id: `c${i}`, name: `Президиум ${i}`, kind: 'cond', stereo: false, loc: 'rack', socket: i, ch: `CH${i}`, phantom: true });
  inputs.push({ id: 'c7', name: 'Радио 1', kind: 'wireless', stereo: false, loc: 'rack', socket: 7, ch: 'CH7', phantom: false });
  inputs.push({ id: 'c8', name: 'Радио 2', kind: 'wireless', stereo: false, loc: 'rack', socket: 8, ch: 'CH8', phantom: false });
  inputs.push({ id: 'c9', name: 'Ноутбук', kind: 'playback', stereo: true, loc: 'local', socket: 1, ch: 'ST1', phantom: false });
  return {
    console, rack: 'AB168', snakeLen: 40, inputs,
    outputs: [
      { id: 'o1', name: 'Портал L', dest: 'mains', bus: 'LR', leg: 'L', socket: 'RACK:1' },
      { id: 'o2', name: 'Портал R', dest: 'mains', bus: 'LR', leg: 'R', socket: 'RACK:2' },
      { id: 'o3', name: 'Монитор президиума', dest: 'monitor', bus: 'Mix1', leg: null, socket: 'RACK:3' },
      { id: 'o4', name: 'Запись / трансляция', dest: 'record', bus: 'LR', leg: null, socket: 'ALT' },
    ],
  };
}

export function presetBand(console: PatchSetup['console'] = 'qu16'): PatchSetup {
  const names: [string, InKind, boolean][] = [
    ['Бочка', 'dyn', false], ['Малый', 'dyn', false], ['Хэт', 'cond', false], ['Overhead', 'cond', true],
    ['Бас', 'di-active', false], ['Гитара', 'dyn', false], ['Клавиши', 'di-passive', true],
    ['Вокал', 'dyn', false], ['Бэк-вокал', 'dyn', false], ['Плейбэк', 'playback', true],
  ];
  const base: PatchSetup = {
    console, rack: 'AR2412', snakeLen: 30, outputs: [],
    inputs: names.map(([name, kind, stereo], i) => ({ id: `b${i}`, name, kind, stereo, loc: 'local', socket: 1, ch: 'CH1', phantom: false })),
  };
  base.inputs = autoAssign(base);
  base.outputs = [
    { id: 'o1', name: 'Портал L', dest: 'mains', bus: 'LR', leg: 'L', socket: 'RACK:1' },
    { id: 'o2', name: 'Портал R', dest: 'mains', bus: 'LR', leg: 'R', socket: 'RACK:2' },
    { id: 'o3', name: 'Сабвуферы', dest: 'sub', bus: 'Mix4', leg: null, socket: 'RACK:3' },
    { id: 'o4', name: 'Монитор вокал', dest: 'monitor', bus: 'Mix1', leg: null, socket: 'RACK:4' },
    { id: 'o5', name: 'Монитор гитара', dest: 'monitor', bus: 'Mix2', leg: null, socket: 'RACK:5' },
    { id: 'o6', name: 'Монитор бас', dest: 'monitor', bus: 'Mix3', leg: null, socket: 'RACK:6' },
    { id: 'o7', name: 'In-ear клавиши L', dest: 'iem', bus: 'Mix5/6', leg: 'L', socket: 'RACK:7' },
    { id: 'o8', name: 'In-ear клавиши R', dest: 'iem', bus: 'Mix5/6', leg: 'R', socket: 'RACK:8' },
    { id: 'o9', name: 'Запись', dest: 'record', bus: 'LR', leg: null, socket: '2TRK' },
  ];
  return base;
}

export const defaultPatch = (): PatchSetup => presetBand('qu16');

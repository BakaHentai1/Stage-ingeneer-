/**
 * Модуль B. Генератор схем коммутации.
 * Чистые функции: из описания комплекта (Rig) строится Patch List входов, таблица выходов,
 * список кабелей, список сетевых подключений и проверки.
 */
import { pickStdLength } from '../calc/audio/cable';
import { cableLoss } from '../calc/audio/cable';
import { parallelZ } from '../calc/audio/impedance';
import type { CalcWarning } from '../calc/types';
import { fx, rn } from '../calc/types';

/* ---------------- Справочники ---------------- */

export type MixerId = 'qu16' | 'qu24' | 'analog';

export interface MixerProfile {
  id: MixerId;
  label: string;
  /** Моно входы mic/line. */
  monoInputs: number;
  /** Стерео линейные входы на пульте (ST). */
  stereoInputs: number;
  /** Моно миксы (AUX) для мониторов. */
  monoMixes: number;
  /** Стерео миксы (можно использовать как отдельный мониторный микс на пару мониторов или IEM). */
  stereoMixes: number;
  /** Поддержка цифрового стейджбокса. */
  stagebox: boolean;
  note: string;
}

export const MIXERS: Record<Exclude<MixerId, 'analog'>, MixerProfile> = {
  qu16: {
    id: 'qu16', label: 'Allen & Heath Qu-16', monoInputs: 16, stereoInputs: 3, monoMixes: 4, stereoMixes: 3, stagebox: true,
    note: '16 моно входов, ST1–ST3 стерео, Mix 1–4 моно, Mix 5/6, 7/8, 9/10 стерео, главный L/R. Стейджбокс по dSNAKE (Cat5e).',
  },
  qu24: {
    id: 'qu24', label: 'Allen & Heath Qu-24', monoInputs: 24, stereoInputs: 3, monoMixes: 4, stereoMixes: 3, stagebox: true,
    note: '24 моно входа, ST1–ST3 стерео, Mix 1–4 моно, Mix 5/6, 7/8, 9/10 стерео, главный L/R. Стейджбокс по dSNAKE (Cat5e).',
  },
};

export type StageboxId = 'AR2412' | 'AB168';
export const STAGEBOXES: Record<StageboxId, { label: string; inputs: number; outputs: number }> = {
  AR2412: { label: 'A&H AR2412 (24 вх / 12 вых)', inputs: 24, outputs: 12 },
  AB168: { label: 'A&H AB168 (16 вх / 8 вых)', inputs: 16, outputs: 8 },
};

export type SourceKind = 'vocal' | 'dyn' | 'cond' | 'di-active' | 'di-passive' | 'wireless' | 'line-bal' | 'playback';

export const SOURCE_KINDS: Record<SourceKind, { label: string; device: string; phantom: boolean; atFoh?: boolean; note?: string }> = {
  vocal: { label: 'Вокальный микрофон', device: 'Динамический микрофон', phantom: false },
  dyn: { label: 'Инстр. динамический микрофон', device: 'Динамический микрофон', phantom: false },
  cond: { label: 'Конденсаторный микрофон', device: 'Конденсаторный микрофон', phantom: true },
  'di-active': { label: 'Инструмент через активный DI', device: 'Активный DI-box (Jack TS → XLR)', phantom: true, note: 'Jack TS от инструмента до DI' },
  'di-passive': { label: 'Инструмент через пассивный DI', device: 'Пассивный DI-box (Jack TS → XLR)', phantom: false, note: 'Jack TS от инструмента до DI' },
  wireless: { label: 'Радиосистема', device: 'Приёмник радиосистемы, выход XLR', phantom: false },
  'line-bal': { label: 'Линейный симметричный', device: 'Выход XLR / Jack TRS', phantom: false },
  playback: { label: 'Плейбэк (ноутбук, телефон)', device: 'Ноутбук или телефон, mini-jack → 2×Jack TS', phantom: false, atFoh: true, note: 'Ставится у пульта; длиннее 5 м — через DI' },
};

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  stereo: boolean;
}

export type Transport = 'stagebox' | 'multicore' | 'direct';
export type SpeakerType = 'active' | 'passive';

export interface Rig {
  mixer: MixerId;
  /** Для аналогового пульта. */
  analogInputs: number;
  analogAux: number;
  transport: Transport;
  stagebox: StageboxId;
  multicoreIn: number;
  multicoreRet: number;
  /** Расстояние сцена — пульт (FOH), м. */
  distFoh: number;
  /** Средняя длина от источника до стейджбокса / мультикора, м. */
  stageLen: number;
  sources: Source[];

  mainsType: SpeakerType;
  /** Кабинетов на сторону. */
  mainsPerSide: number;
  /** Кабель от стейджбокса / сцены до порталов (XLR), м. */
  mainsLen: number;

  subs: number;
  subsType: SpeakerType;
  subsFeed: 'aux' | 'lr';

  monitors: number;
  monitorsType: SpeakerType;
  monLen: number;

  /** Пассивная акустика: импеданс, кабинетов на канал, мин. нагрузка, длина и сечение акустического кабеля. */
  passiveZ: number;
  perChannel: number;
  ampMinZ: number;
  spkLen: number;
  spkSection: number;
}

export const defaultRig = (): Rig => ({
  mixer: 'qu16',
  analogInputs: 16,
  analogAux: 4,
  transport: 'stagebox',
  stagebox: 'AR2412',
  multicoreIn: 16,
  multicoreRet: 4,
  distFoh: 30,
  stageLen: 8,
  sources: [
    { id: 's1', name: 'Бочка', kind: 'dyn', stereo: false },
    { id: 's2', name: 'Малый', kind: 'dyn', stereo: false },
    { id: 's3', name: 'Overhead', kind: 'cond', stereo: true },
    { id: 's4', name: 'Бас', kind: 'di-active', stereo: false },
    { id: 's5', name: 'Гитара', kind: 'dyn', stereo: false },
    { id: 's6', name: 'Клавиши', kind: 'di-passive', stereo: true },
    { id: 's7', name: 'Вокал', kind: 'vocal', stereo: false },
    { id: 's8', name: 'Бэк-вокал', kind: 'vocal', stereo: false },
    { id: 's9', name: 'Ведущий', kind: 'wireless', stereo: false },
    { id: 's10', name: 'Плейбэк', kind: 'playback', stereo: true },
  ],
  mainsType: 'active',
  mainsPerSide: 1,
  mainsLen: 10,
  subs: 2,
  subsType: 'active',
  subsFeed: 'aux',
  monitors: 3,
  monitorsType: 'active',
  monLen: 10,
  passiveZ: 8,
  perChannel: 1,
  ampMinZ: 4,
  spkLen: 10,
  spkSection: 2.5,
});

/* ---------------- Результат ---------------- */

export interface PatchRow {
  ch: string;
  name: string;
  device: string;
  phantom: boolean;
  /** Вход стейджбокса / мультикора / «у пульта». */
  inputAt: string;
  cable: string;
  len: number | null;
}

export interface OutputRow {
  out: string;
  bus: string;
  dest: string;
  cable: string;
  len: number | null;
}

export interface CableItem {
  kind: string;
  connectors: string;
  len: number;
  qty: number;
}

export interface PowerItem {
  device: string;
  qty: number;
  where: string;
}

export interface WiringResult {
  mixerLabel: string;
  transportLabel: string;
  inputs: PatchRow[];
  outputs: OutputRow[];
  cables: CableItem[];
  power: PowerItem[];
  amps: { channels: number; units: number; loadZ: number } | null;
  usage: { label: string; used: number; total: number }[];
  warnings: CalcWarning[];
}

export function mixerProfile(r: Rig): MixerProfile {
  if (r.mixer === 'analog') {
    return {
      id: 'analog', label: 'Аналоговый пульт', monoInputs: r.analogInputs, stereoInputs: 0, monoMixes: r.analogAux, stereoMixes: 0, stagebox: false,
      note: 'Число входов и AUX задаются вручную.',
    };
  }
  return MIXERS[r.mixer];
}

/** Стандартная длина или null, если длиннее 100 м (нужна бухта). */
function std(len: number): number | null {
  return pickStdLength(len) ?? null;
}

const XLR_MIC = 'XLR3 m–f, микрофонный';
const XLR_LINE = 'XLR3 m–f, линейный';
const JACK_TS = 'Jack TS — Jack TS, инструментальный';
const SPK = 'speakON NL4, акустический';

export function generate(r: Rig): WiringResult {
  const prof = mixerProfile(r);
  const warnings: CalcWarning[] = [];
  const cables = new Map<string, CableItem>();
  const addCable = (kind: string, connectors: string, len: number | null, qty = 1, rawLen?: number) => {
    const L = len ?? Math.ceil(rawLen ?? 0);
    const key = `${kind}|${connectors}|${L}`;
    const c = cables.get(key);
    if (c) c.qty += qty;
    else cables.set(key, { kind, connectors, len: L, qty });
  };

  let transport = r.transport;
  if (transport === 'stagebox' && !prof.stagebox) {
    warnings.push({ level: 'warn', text: 'У аналогового пульта нет цифрового стейджбокса: схема построена с аналоговым мультикором.' });
    transport = 'multicore';
  }
  const sb = STAGEBOXES[r.stagebox];
  const transportLabel =
    transport === 'stagebox' ? `Стейджбокс ${sb.label}, dSNAKE по Cat5e` :
    transport === 'multicore' ? `Аналоговый мультикор ${r.multicoreIn}/${r.multicoreRet}` : 'Отдельные кабели до пульта';

  /* ---- Входы ---- */
  const inputs: PatchRow[] = [];
  let mono = 0; // занятые моно каналы пульта
  let st = 0; // занятые стерео входы ST
  let remote = 0; // занятые входы стейджбокса / мультикора
  const stageInLen = std(r.stageLen);
  const directLen = std(r.stageLen + r.distFoh);

  for (const s of r.sources) {
    const k = SOURCE_KINDS[s.kind];
    const legs = s.stereo ? ['L', 'R'] : [''];
    // Плейбэк у пульта на Qu идёт в стерео вход ST, если он свободен.
    if (k.atFoh && s.stereo && prof.stereoInputs > st) {
      st++;
      inputs.push({
        ch: `ST${st}`, name: s.name, device: k.device, phantom: false, inputAt: 'у пульта',
        cable: 'mini-jack 3,5 → 2×Jack TS', len: 2,
      });
      addCable('Плейбэк', 'mini-jack 3,5 → 2×Jack TS', 2);
      continue;
    }
    for (const leg of legs) {
      mono++;
      const name = leg ? `${s.name} ${leg}` : s.name;
      let inputAt: string;
      let cable: string;
      let len: number | null;
      if (k.atFoh) {
        inputAt = 'у пульта';
        cable = 'Jack TS — XLR / Jack TS';
        len = 3;
        addCable('Плейбэк', 'Jack TS — Jack TS', 3);
      } else if (transport === 'direct') {
        inputAt = 'прямо в пульт';
        cable = XLR_MIC;
        len = directLen;
        addCable('Микрофонный', XLR_MIC, directLen, 1, r.stageLen + r.distFoh);
      } else {
        remote++;
        inputAt = transport === 'stagebox' ? `${r.stagebox} вх ${remote}` : `Мультикор вх ${remote}`;
        cable = XLR_MIC;
        len = stageInLen;
        addCable('Микрофонный', XLR_MIC, stageInLen, 1, r.stageLen);
      }
      if (s.kind === 'di-active' || s.kind === 'di-passive') addCable('Инструментальный', JACK_TS, 3);
      inputs.push({ ch: String(mono), name, device: k.device, phantom: k.phantom, inputAt, cable, len });
    }
  }

  const usage: WiringResult['usage'] = [{ label: 'Моно входы пульта', used: mono, total: prof.monoInputs }];
  if (prof.stereoInputs) usage.push({ label: 'Стерео входы ST', used: st, total: prof.stereoInputs });
  if (mono > prof.monoInputs) {
    warnings.push({ level: 'crit', text: `Источникам нужно ${mono} моно каналов, а у пульта ${prof.monoInputs}. Уберите источники, сведите стерео в моно или возьмите пульт больше.` });
  }
  if (transport === 'stagebox') {
    usage.push({ label: `Входы ${r.stagebox}`, used: remote, total: sb.inputs });
    if (remote > sb.inputs) warnings.push({ level: 'crit', text: `Сценических входов ${remote}, а у ${r.stagebox} только ${sb.inputs}.` });
    if (remote > prof.monoInputs && prof.monoInputs < sb.inputs) {
      warnings.push({ level: 'warn', text: `${prof.label} использует только ${prof.monoInputs} входов стейджбокса.` });
    }
  }
  if (transport === 'multicore') {
    usage.push({ label: 'Каналы мультикора', used: remote, total: r.multicoreIn });
    if (remote > r.multicoreIn) warnings.push({ level: 'crit', text: `Сценических входов ${remote}, а в мультикоре ${r.multicoreIn} каналов.` });
  }
  if (inputs.some((i) => i.phantom)) {
    warnings.push({ level: 'info', text: 'Фантомное питание 48 В включайте только на каналах с отметкой 48 В и при опущенном фейдере. Не подавайте 48 В на несимметричные и ленточные источники.' });
  }

  /* ---- Транспорт ---- */
  if (transport === 'stagebox') {
    const l = std(r.distFoh);
    addCable('Сетевой dSNAKE', 'etherCON — etherCON, Cat5e STP', l, 1, r.distFoh);
    addCable('Сетевой dSNAKE (резерв)', 'etherCON — etherCON, Cat5e STP', l, 1, r.distFoh);
    if (r.distFoh > 100) warnings.push({ level: 'crit', text: `Расстояние до пульта ${rn(r.distFoh)} м: для кабеля Cat5e это больше 100 м. Проверьте допустимую длину dSNAKE в руководстве A&H или перенесите пульт.` });
  } else if (transport === 'multicore') {
    addCable('Мультикор', `${r.multicoreIn}/${r.multicoreRet} каналов`, std(r.distFoh), 1, r.distFoh);
  } else if (r.distFoh + r.stageLen > 100) {
    warnings.push({ level: 'warn', text: 'Отдельные кабели длиннее 100 м: возьмите мультикор или стейджбокс.' });
  }

  /* ---- Выходы ---- */
  type Out = { bus: string; dest: string; type: SpeakerType; len: number; role: 'main' | 'sub' | 'mon' };
  const outs: Out[] = [];
  const mainsLabel = (side: string) => `${side === 'L' ? 'Левый' : 'Правый'} портал${r.mainsPerSide > 1 ? ` (${r.mainsPerSide} каб.)` : ''}`;
  outs.push({ bus: 'Main L', dest: mainsLabel('L'), type: r.mainsType, len: r.mainsLen, role: 'main' });
  outs.push({ bus: 'Main R', dest: mainsLabel('R'), type: r.mainsType, len: r.mainsLen, role: 'main' });

  const mixesAvail = prof.monoMixes + prof.stereoMixes;
  let mixUsed = 0;
  const nextMix = (): string | null => {
    if (mixUsed < prof.monoMixes) return `${r.mixer === 'analog' ? 'AUX' : 'Mix'} ${++mixUsed}`;
    if (mixUsed < mixesAvail) {
      const k = mixUsed++ - prof.monoMixes;
      const a = prof.monoMixes + 1 + k * 2;
      return `Mix ${a}/${a + 1} (стерео, моно-сумма)`;
    }
    return null;
  };
  if (r.subs > 0) {
    if (r.subsFeed === 'aux') {
      const bus = nextMix();
      outs.push({ bus: bus ?? '— нет свободного микса', dest: `Сабвуферы (${r.subs} шт)`, type: r.subsType, len: r.mainsLen, role: 'sub' });
      if (!bus) warnings.push({ level: 'crit', text: 'Нет свободного микса для сабвуферов: питайте их от L/R.' });
    } else {
      warnings.push({ level: 'info', text: 'Сабвуферы от L/R: сигнал на них берётся с выхода портала (Link/Thru) или через кроссовер.' });
    }
  }
  let noMix = 0;
  for (let i = 1; i <= r.monitors; i++) {
    const bus = nextMix();
    if (!bus) {
      noMix++;
      continue;
    }
    outs.push({ bus, dest: `Монитор ${i}`, type: r.monitorsType, len: r.monLen, role: 'mon' });
  }
  if (noMix) {
    warnings.push({
      level: 'warn',
      text: `Свободных миксов не хватает ещё на ${noMix} монитор(а). Подключите их по Link/Thru к соседним мониторам: они будут играть тот же микс.`,
    });
    addCable('Линейный (Link)', XLR_LINE, std(r.monLen), noMix, r.monLen);
  }
  usage.push({ label: r.mixer === 'analog' ? 'AUX' : 'Миксы (Mix 1–10)', used: mixUsed, total: mixesAvail });

  const outputs: OutputRow[] = [];
  let outNo = 0;
  const outsAvail = transport === 'stagebox' ? sb.outputs : transport === 'multicore' ? r.multicoreRet : Infinity;
  for (const o of outs) {
    outNo++;
    const at = transport === 'stagebox' ? `${r.stagebox} вых ${outNo}` : transport === 'multicore' ? `Возврат ${outNo}` : `Выход пульта`;
    const lenRaw = transport === 'direct' ? r.distFoh + o.len : o.len;
    const l = std(lenRaw);
    const dest = o.type === 'passive' ? `Усилитель → ${o.dest}` : o.dest;
    outputs.push({ out: at, bus: o.bus, dest, cable: XLR_LINE, len: l });
    addCable('Линейный', XLR_LINE, l, 1, lenRaw);
    // Кабели между кабинетами одной группы (Link/Thru) для активной акустики.
    const groupCount = o.role === 'main' ? r.mainsPerSide : o.role === 'sub' ? r.subs : 1;
    if (o.type === 'active' && groupCount > 1) addCable('Линейный (Link)', XLR_LINE, 2, groupCount - 1);
  }
  if (transport !== 'direct') {
    usage.push({ label: transport === 'stagebox' ? `Выходы ${r.stagebox}` : 'Возвраты мультикора', used: outNo, total: outsAvail });
    if (outNo > outsAvail) {
      warnings.push({ level: 'crit', text: `Нужно ${outNo} выходов, а доступно ${outsAvail}. Объедините мониторы по Link или используйте выходы пульта у FOH.` });
    }
  }

  /* ---- Пассивная акустика и усилители ---- */
  let amps: WiringResult['amps'] = null;
  const passiveCabs =
    (r.mainsType === 'passive' ? r.mainsPerSide * 2 : 0) +
    (r.subs && r.subsType === 'passive' ? r.subs : 0) +
    (r.monitorsType === 'passive' ? r.monitors : 0);
  if (passiveCabs > 0) {
    const per = Math.max(1, Math.floor(r.perChannel));
    const loadZ = parallelZ(Array(per).fill(r.passiveZ));
    // Каналы считаются по группам: каналы одной группы не делят с другой группой.
    const groupCh = (n: number) => Math.ceil(n / per);
    const channels =
      (r.mainsType === 'passive' ? 2 * groupCh(r.mainsPerSide) : 0) +
      (r.subs && r.subsType === 'passive' ? groupCh(r.subs) : 0) +
      (r.monitorsType === 'passive' ? r.monitors : 0);
    const units = Math.ceil(channels / 2);
    amps = { channels, units, loadZ };
    addCable('Акустический', SPK, std(r.spkLen), passiveCabs, r.spkLen);
    if (loadZ < r.ampMinZ - 1e-9) {
      warnings.push({ level: 'crit', text: `${per} кабинета по ${rn(r.passiveZ)} Ом на канал дают ${fx(loadZ, 2)} Ом, это ниже минимума усилителя ${rn(r.ampMinZ)} Ом.` });
    }
    const loss = cableLoss({ length: r.spkLen, section: r.spkSection, z: loadZ, lossMax: 0.5 });
    if (!loss.error && loss.warnings.length) {
      warnings.push({ level: 'warn', text: `Акустический кабель ${rn(r.spkLen)} м, ${fx(r.spkSection, 1)} мм² на нагрузку ${fx(loadZ, 1)} Ом: ${loss.warnings[0].text}` });
    }
    if (r.monitorsType === 'passive' && r.monitors > 0) {
      warnings.push({ level: 'info', text: 'Пассивным мониторам с разными миксами нужен отдельный канал усилителя на каждый.' });
    }
  }

  /* ---- Питание ---- */
  const power: PowerItem[] = [{ device: prof.label, qty: 1, where: 'FOH' }];
  if (transport === 'stagebox') power.push({ device: `Стейджбокс ${r.stagebox}`, qty: 1, where: 'сцена' });
  if (r.mainsType === 'active') power.push({ device: 'Активные порталы', qty: r.mainsPerSide * 2, where: 'сцена' });
  if (r.subs && r.subsType === 'active') power.push({ device: 'Активные сабвуферы', qty: r.subs, where: 'сцена' });
  if (r.monitors && r.monitorsType === 'active') power.push({ device: 'Активные мониторы', qty: r.monitors, where: 'сцена' });
  if (amps) power.push({ device: 'Усилители (2 канала)', qty: amps.units, where: 'сцена' });
  const wireless = r.sources.filter((s) => s.kind === 'wireless').length;
  if (wireless) power.push({ device: 'Приёмники радиосистем', qty: wireless, where: 'сцена' });
  const di = r.sources.filter((s) => s.kind === 'di-active').length;
  if (di) power.push({ device: 'Активные DI (от 48 В пульта)', qty: 0, where: 'питание по кабелю' });

  warnings.push({
    level: 'crit',
    text: 'Электропитание: звук, свет и LED подключайте к разным линиям, звук — к одной фазе с общей защитной землёй. Нагрузку на линии и автоматы рассчитывает и проверяет квалифицированный электрик.',
  });

  return {
    mixerLabel: prof.label,
    transportLabel,
    inputs,
    outputs,
    cables: [...cables.values()].sort((a, b) => a.kind.localeCompare(b.kind, 'ru') || a.len - b.len),
    power: power.filter((p) => p.qty > 0 || p.where === 'питание по кабелю'),
    amps,
    usage,
    warnings,
  };
}

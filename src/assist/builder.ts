/**
 * Модуль C. Визуальный конструктор коммутации: блоки оборудования, порты, виртуальные кабели и проверка.
 * Порты типизированы по уровню сигнала, чтобы проверять, что куда можно включать.
 */

export type Sig = 'mic' | 'line' | 'unbal' | 'spk' | 'dsnake';
export type Dir = 'in' | 'out' | 'io';

export const SIG_LABEL: Record<Sig, string> = {
  mic: 'микрофонный (XLR)', line: 'линейный симметричный', unbal: 'линейный несимметричный (Jack TS, mini-jack)', spk: 'акустический (Speakon)', dsnake: 'dSNAKE (Cat5e)',
};

export interface PortDef { id: string; label: string; dir: Dir; sig: Sig }

export type DevType =
  | 'mic-dyn' | 'mic-cond' | 'di-active' | 'wireless' | 'laptop' | 'instrument'
  | 'stagebox' | 'qu16' | 'active-spk' | 'active-mon' | 'active-sub' | 'amp' | 'passive-spk' | 'passive-mon';

export type Role = 'source' | 'stage' | 'console' | 'amp' | 'speaker';

export interface DevDef { label: string; role: Role; ports: PortDef[]; note?: string; phantom?: boolean }

const nums = (n: number, f: (i: number) => PortDef) => Array.from({ length: n }, (_, i) => f(i + 1));

export const DEVICES: Record<DevType, DevDef> = {
  'mic-dyn': { label: 'Динамический микрофон', role: 'source', ports: [{ id: 'out', label: 'XLR выход', dir: 'out', sig: 'mic' }] },
  'mic-cond': { label: 'Конденсаторный микрофон', role: 'source', phantom: true, ports: [{ id: 'out', label: 'XLR выход', dir: 'out', sig: 'mic' }], note: 'Нужно 48V на входе, куда он подключён.' },
  instrument: { label: 'Гитара / бас / клавиши', role: 'source', ports: [{ id: 'out', label: 'Jack TS выход', dir: 'out', sig: 'unbal' }] },
  'di-active': { label: 'Активный DI-box', role: 'source', phantom: true, ports: [{ id: 'in', label: 'Jack вход', dir: 'in', sig: 'unbal' }, { id: 'out', label: 'XLR выход', dir: 'out', sig: 'mic' }], note: 'Питается от 48V.' },
  wireless: { label: 'Приёмник радиосистемы', role: 'source', ports: [{ id: 'out', label: 'XLR выход', dir: 'out', sig: 'mic' }] },
  laptop: { label: 'Ноутбук', role: 'source', ports: [{ id: 'out', label: 'mini-jack выход', dir: 'out', sig: 'unbal' }] },
  stagebox: {
    label: 'Стейджбокс AR2412', role: 'stage',
    ports: [...nums(8, (i) => ({ id: `in${i}`, label: `Вход ${i}`, dir: 'in' as const, sig: 'mic' as const })), ...nums(4, (i) => ({ id: `out${i}`, label: `Выход ${i}`, dir: 'out' as const, sig: 'line' as const })), { id: 'dsnake', label: 'dSNAKE', dir: 'io', sig: 'dsnake' }],
    note: 'Показаны 8 из 24 входов и 4 из 12 выходов.',
  },
  qu16: {
    label: 'Пульт Qu-16', role: 'console',
    ports: [...nums(8, (i) => ({ id: `in${i}`, label: `Mic ${i}`, dir: 'in' as const, sig: 'mic' as const })), { id: 'st1', label: 'ST1 L/R', dir: 'in', sig: 'unbal' },
      { id: 'L', label: 'Out L', dir: 'out', sig: 'line' }, { id: 'R', label: 'Out R', dir: 'out', sig: 'line' }, ...nums(4, (i) => ({ id: `mix${i}`, label: `Mix ${i}`, dir: 'out' as const, sig: 'line' as const })),
      { id: 'dsnake', label: 'dSNAKE', dir: 'io', sig: 'dsnake' }],
    note: 'Показаны 8 из 16 входов.',
  },
  'active-spk': { label: 'Активный портал', role: 'speaker', ports: [{ id: 'in', label: 'XLR вход', dir: 'in', sig: 'line' }, { id: 'thru', label: 'XLR Thru', dir: 'out', sig: 'line' }] },
  'active-sub': { label: 'Активный сабвуфер', role: 'speaker', ports: [{ id: 'in', label: 'XLR вход', dir: 'in', sig: 'line' }, { id: 'thru', label: 'XLR Thru', dir: 'out', sig: 'line' }] },
  'active-mon': { label: 'Активный монитор', role: 'speaker', ports: [{ id: 'in', label: 'XLR вход', dir: 'in', sig: 'line' }] },
  amp: { label: 'Усилитель (2 канала)', role: 'amp', ports: [{ id: 'inA', label: 'Вход A', dir: 'in', sig: 'line' }, { id: 'inB', label: 'Вход B', dir: 'in', sig: 'line' }, { id: 'outA', label: 'Speakon A', dir: 'out', sig: 'spk' }, { id: 'outB', label: 'Speakon B', dir: 'out', sig: 'spk' }] },
  'passive-spk': { label: 'Пассивный портал', role: 'speaker', ports: [{ id: 'in', label: 'Speakon', dir: 'in', sig: 'spk' }] },
  'passive-mon': { label: 'Пассивный монитор', role: 'speaker', ports: [{ id: 'in', label: 'Speakon', dir: 'in', sig: 'spk' }] },
};

export interface Dev { id: string; type: DevType; name: string }
export interface Link { id: string; a: { dev: string; port: string }; b: { dev: string; port: string } }
export interface Build { devs: Dev[]; links: Link[] }

export interface Verdict { level: 'ok' | 'info' | 'warn' | 'crit'; text: string }

export function portOf(b: Build, end: { dev: string; port: string }): { dev: Dev; def: DevDef; port: PortDef } | null {
  const dev = b.devs.find((d) => d.id === end.dev);
  if (!dev) return null;
  const def = DEVICES[dev.type];
  const port = def.ports.find((p) => p.id === end.port);
  return port ? { dev, def, port } : null;
}

/** Можно ли соединить два порта. Возвращает уровень и объяснение. */
export function judgeLink(x: PortDef, y: PortDef, xd: DevDef, yd: DevDef): Verdict {
  if (x.sig === 'dsnake' || y.sig === 'dsnake') {
    if (x.sig !== y.sig) return { level: 'crit', text: 'dSNAKE соединяется только с dSNAKE (EtherCon, Cat5e).' };
    if (xd.role === yd.role) return { level: 'crit', text: 'dSNAKE соединяет пульт и стейджбокс, а не два одинаковых устройства.' };
    return { level: 'ok', text: 'Цифровая линия пульт — стейджбокс.' };
  }
  if (x.dir === y.dir) return { level: 'crit', text: x.dir === 'out' ? 'Выход в выход: два выхода нельзя соединять — сигнал не пойдёт, возможна поломка.' : 'Вход во вход: сигнала нет ни с одной стороны.' };
  const [o, i] = x.dir === 'out' ? [x, y] : [y, x];
  const id = x.dir === 'out' ? yd : xd;
  if (o.sig === 'spk') return i.sig === 'spk' ? { level: 'ok', text: 'Усилитель — пассивная акустика.' } : { level: 'crit', text: 'Акустический выход усилителя в линейный или микрофонный вход — десятки вольт, вход будет повреждён.' };
  if (i.sig === 'spk') return { level: 'crit', text: 'Пассивной акустике нужен усилитель: линейного или микрофонного сигнала ей мало.' };
  if (o.sig === 'mic' && i.sig === 'line') return id.role === 'speaker' ? { level: 'warn', text: 'Микрофон прямо в колонку: уровень слишком мал, нет регулировки — нужен пульт.' } : { level: 'warn', text: 'Микрофонный сигнал в линейный вход — будет очень тихо.' };
  if (o.sig === 'line' && i.sig === 'mic') return { level: 'info', text: 'Линия во вход Mic/Line: работает, Gain ниже. 48V на этом входе не включайте.' };
  if (o.sig === 'unbal' && i.sig === 'mic') return { level: 'warn', text: 'Несимметричный инструмент или ноутбук прямо в микрофонный вход: на длинном кабеле — шум и фон. Используйте DI-box.' };
  if (o.sig === 'unbal' && i.sig === 'line') return { level: 'info', text: 'Несимметричная линия: держите кабель коротким (до 3–5 м).' };
  return { level: 'ok', text: 'Совместимые разъёмы и уровни.' };
}

export interface BuildCheck { links: (Link & Verdict)[]; issues: Verdict[] }

export function checkBuild(b: Build): BuildCheck {
  const links: BuildCheck['links'] = [];
  const used = new Map<string, number>();
  for (const l of b.links) {
    const A = portOf(b, l.a);
    const B = portOf(b, l.b);
    if (!A || !B) continue;
    const v = judgeLink(A.port, B.port, A.def, B.def);
    links.push({ ...l, ...v });
    for (const e of [l.a, l.b]) used.set(`${e.dev}:${e.port}`, (used.get(`${e.dev}:${e.port}`) ?? 0) + 1);
  }
  const issues: Verdict[] = [];
  for (const [k, n] of used) {
    if (n > 1) {
      const [dev, port] = k.split(':');
      const p = portOf(b, { dev, port });
      issues.push({ level: 'crit', text: `${p?.dev.name}: к порту «${p?.port.label}» подключено ${n} кабеля. В разъём — один кабель; для раздачи — Thru или отдельный выход.` });
    }
  }
  const badLinks = links.filter((l) => l.level === 'crit').length;
  if (badLinks) issues.push({ level: 'crit', text: `Ошибочных кабелей: ${badLinks}. Подробности — в списке кабелей ниже.` });
  const mixers = b.devs.filter((d) => DEVICES[d.type].role === 'console');
  if (!mixers.length) issues.push({ level: 'warn', text: 'В схеме нет пульта.' });

  // Граф достижимости: сигнал идёт от выхода к входу; внутри устройства — со всех входов на все выходы (упрощение).
  const fwd = new Map<string, Set<string>>();
  const add = (a: string, z: string) => { if (!fwd.has(a)) fwd.set(a, new Set()); fwd.get(a)!.add(z); };
  for (const l of links) {
    if (l.level === 'crit') continue;
    const A = portOf(b, l.a)!;
    if (A.port.sig === 'dsnake') { add(l.a.dev, l.b.dev); add(l.b.dev, l.a.dev); continue; }
    const [o, i] = A.port.dir === 'out' ? [l.a, l.b] : [l.b, l.a];
    add(o.dev, i.dev);
  }
  const reach = (from: string) => {
    const seen = new Set([from]);
    const q = [from];
    while (q.length) for (const n of fwd.get(q.shift()!) ?? []) if (!seen.has(n)) { seen.add(n); q.push(n); }
    return seen;
  };
  const connected = (d: Dev) => b.links.some((l) => l.a.dev === d.id || l.b.dev === d.id);
  for (const d of b.devs) {
    const def = DEVICES[d.type];
    if (!connected(d)) { issues.push({ level: 'info', text: `${d.name}: не подключено.` }); continue; }
    if (def.role === 'source' && mixers.length && !mixers.some((m) => reach(d.id).has(m.id))) {
      issues.push({ level: 'warn', text: `${d.name}: сигнал не доходит до пульта. Проверьте цепочку (стейджбокс без dSNAKE до пульта?).` });
    }
    if (def.role === 'speaker' && mixers.length && !mixers.some((m) => reach(m.id).has(d.id))) {
      issues.push({ level: 'warn', text: `${d.name}: на колонку не приходит сигнал с пульта.` });
    }
    if (def.phantom) issues.push({ level: 'info', text: `${d.name}: включите 48V на канале, куда он подключён.` });
  }
  if (!issues.length && links.length && links.every((l) => l.level === 'ok' || l.level === 'info')) issues.push({ level: 'ok', text: 'Схема собрана правильно: все источники доходят до пульта, все колонки получают сигнал.' });
  return { links, issues };
}

export const sampleBuild = (): Build => ({
  devs: [
    { id: 'd1', type: 'mic-dyn', name: 'Вокал' },
    { id: 'd2', type: 'mic-cond', name: 'Хор' },
    { id: 'd3', type: 'stagebox', name: 'Стейджбокс' },
    { id: 'd4', type: 'qu16', name: 'Qu-16' },
    { id: 'd5', type: 'active-spk', name: 'Портал L' },
    { id: 'd6', type: 'active-spk', name: 'Портал R' },
    { id: 'd7', type: 'amp', name: 'Усилитель' },
    { id: 'd8', type: 'passive-mon', name: 'Монитор' },
  ],
  links: [
    { id: 'l1', a: { dev: 'd1', port: 'out' }, b: { dev: 'd3', port: 'in1' } },
    { id: 'l2', a: { dev: 'd2', port: 'out' }, b: { dev: 'd3', port: 'in2' } },
    { id: 'l3', a: { dev: 'd3', port: 'dsnake' }, b: { dev: 'd4', port: 'dsnake' } },
    { id: 'l4', a: { dev: 'd3', port: 'out1' }, b: { dev: 'd5', port: 'in' } },
    { id: 'l5', a: { dev: 'd3', port: 'out2' }, b: { dev: 'd6', port: 'in' } },
    { id: 'l6', a: { dev: 'd3', port: 'out3' }, b: { dev: 'd7', port: 'inA' } },
    { id: 'l7', a: { dev: 'd7', port: 'outA' }, b: { dev: 'd8', port: 'in' } },
  ],
});

import { describe, expect, it } from 'vitest';
import { autoAssign, checkPatch, presetBand, presetConference, socketsOf, type PatchSetup } from '../src/assist/patch';
import { busesOf, CONSOLES } from '../src/assist/qu';
import { buildRoute, ROUTE_DESTS, type RouteDest } from '../src/assist/route';

const crit = (p: PatchSetup) => checkPatch(p).warnings.filter((w) => w.level === 'crit');

describe('Профили Qu (по Reference Guide)', () => {
  it('Qu-16: 2 FX send, нет групп и матриц', () => {
    const ids = busesOf(CONSOLES.qu16).map((b) => b.id);
    expect(ids.filter((i) => i.startsWith('FX'))).toEqual(['FX1', 'FX2']);
    expect(ids.some((i) => i.startsWith('Grp') || i.startsWith('MTX'))).toBe(false);
    expect(ids).toContain('Mix5/6');
  });
  it('Qu-24: 4 FX send, 2 стерео группы, 2 стерео матрицы', () => {
    const b = busesOf(CONSOLES.qu24);
    expect(b.filter((x) => x.kind === 'fx')).toHaveLength(4);
    expect(b.filter((x) => x.kind === 'group' && x.stereo)).toHaveLength(2);
    expect(b.filter((x) => x.kind === 'matrix' && x.stereo)).toHaveLength(2);
  });
});

describe('Патчинг входов', () => {
  it('примеры без ошибок', () => {
    expect(crit(presetBand('qu16'))).toEqual([]);
    expect(crit(presetConference('qu16'))).toEqual([]);
    expect(crit(presetBand('qu24'))).toEqual([]);
  });
  it('локальный вход жёстко равен каналу', () => {
    const p = presetBand('qu16');
    const s = { ...p.inputs[0], loc: 'local' as const, ch: 'CH7' };
    expect(socketsOf(s, null)[0]).toContain('Mic/Line 7');
  });
  it('два источника на один канал — ошибка', () => {
    const p = presetBand('qu16');
    p.inputs[1] = { ...p.inputs[1], ch: p.inputs[0].ch };
    expect(crit(p).some((w) => w.text.includes('один канал'))).toBe(true);
  });
  it('два кабеля в один вход стейджбокса — ошибка, канал за пределами пульта — ошибка', () => {
    const p = presetConference('qu16');
    p.inputs[1] = { ...p.inputs[1], socket: p.inputs[0].socket };
    p.inputs[2] = { ...p.inputs[2], ch: 'CH17' };
    const t = crit(p).map((w) => w.text).join('\n');
    expect(t).toContain('один вход стейджбокса');
    expect(t).toContain('нет канала CH17');
  });
  it('микрофон на ST — ошибка; конденсатор без 48V — предупреждение', () => {
    const p = presetConference('qu16');
    p.inputs[0] = { ...p.inputs[0], ch: 'ST2', phantom: false, loc: 'local' };
    const w = checkPatch(p).warnings;
    expect(w.some((x) => x.level === 'crit' && x.text.includes('без микрофонного предусилителя'))).toBe(true);
    expect(w.some((x) => x.level === 'warn' && x.text.includes('без 48V'))).toBe(true);
  });
  it('стерео пара с чётного канала — предупреждение', () => {
    const p = presetBand('qu16');
    const i = p.inputs.findIndex((s) => s.stereo && s.ch.startsWith('CH'));
    p.inputs[i] = { ...p.inputs[i], ch: 'CH2' };
    expect(checkPatch(p).warnings.some((w) => w.text.includes('с чётного'))).toBe(true);
  });
  it('autoAssign: стерео на нечётные пары, плейбэк на ST, без пересечений', () => {
    const p = presetBand('qu16');
    const a = autoAssign(p);
    const oh = a.find((s) => s.name === 'Overhead')!;
    expect(Number(oh.ch.slice(2)) % 2).toBe(1);
    expect(a.find((s) => s.kind === 'playback')!.ch).toBe('ST1');
  });
  it('dSNAKE длиннее 120 м — ошибка, 110 м — предупреждение', () => {
    const p = presetConference('qu16');
    expect(crit({ ...p, snakeLen: 130 }).some((w) => w.text.includes('120'))).toBe(true);
    const w = checkPatch({ ...p, snakeLen: 110 }).warnings;
    expect(w.some((x) => x.level === 'warn' && x.text.includes('100'))).toBe(true);
  });
  it('AB168: входа 17 нет', () => {
    const p = presetConference('qu16');
    p.inputs[0] = { ...p.inputs[0], socket: 17 };
    expect(crit(p).some((w) => w.text.includes('нет входа 17'))).toBe(true);
  });
});

describe('Патчинг выходов', () => {
  it('фиксированный XLR Mix 3 не может нести Mix 1', () => {
    const p = presetBand('qu16');
    p.outputs[3] = { ...p.outputs[3], bus: 'Mix1', socket: 'XLR:Mix3' };
    expect(crit(p).some((w) => w.text.includes('всегда выдаёт'))).toBe(true);
  });
  it('2TRK только LR', () => {
    const p = presetBand('qu16');
    p.outputs.push({ id: 'z', name: 'Тест', dest: 'record', bus: 'Mix2', leg: null, socket: '2TRK' });
    p.outputs = p.outputs.filter((o) => o.id === 'z' || o.socket !== '2TRK');
    expect(crit(p).some((w) => w.text.includes('2TRK'))).toBe(true);
  });
  it('один разъём дважды — ошибка; выход стейджбокса сверх количества — ошибка', () => {
    const p = presetConference('qu16');
    p.outputs[1] = { ...p.outputs[1], socket: 'RACK:1' };
    p.outputs[2] = { ...p.outputs[2], socket: 'RACK:9' };
    const t = crit(p).map((w) => w.text).join('\n');
    expect(t).toContain('на одном разъёме');
    expect(t).toContain('нет в этой конфигурации');
  });
  it('монитор от LR — предупреждение; Qu-16 без матрицы', () => {
    const p = presetBand('qu16');
    p.outputs[3] = { ...p.outputs[3], bus: 'LR', leg: 'L' };
    expect(checkPatch(p).warnings.some((w) => w.level === 'warn' && w.text.includes('pre-fader'))).toBe(true);
    const q = presetBand('qu16');
    q.outputs.push({ id: 'm', name: 'Фойе', dest: 'zone', bus: 'MTX1', leg: null, socket: 'ALT' });
    expect(crit(q).some((w) => w.text.includes('нет шины MTX1'))).toBe(true);
  });
  it('Qu-24: матрица на Alt Out — без ошибок', () => {
    const q = presetBand('qu24');
    q.outputs.push({ id: 'm', name: 'Фойе', dest: 'zone', bus: 'MTX1', leg: null, socket: 'ALT' });
    expect(crit(q)).toEqual([]);
  });
});

describe('Путь сигнала', () => {
  const all = Object.keys(ROUTE_DESTS) as RouteDest[];
  it('все направления на Qu-24 строятся без ошибок и начинаются с физики', () => {
    for (const dest of all) {
      const r = buildRoute({ console: 'qu24', transport: 'rack', source: 'cond', speakers: 'passive', dest });
      expect(r.error).toBeUndefined();
      expect(r.steps[0].layer).toBe('phys');
      expect(r.steps.some((s) => s.layer === 'dig')).toBe(true);
    }
  });
  it('Qu-16: группа и матрица недоступны с объяснением', () => {
    expect(buildRoute({ console: 'qu16', transport: 'local', source: 'dyn', speakers: 'active', dest: 'group' }).error).toContain('DCA');
    expect(buildRoute({ console: 'qu16', transport: 'local', source: 'dyn', speakers: 'active', dest: 'matrix' }).error).toContain('нет матриц');
  });
  it('монитор берётся pre-fader, FX — post-fader; пассивная акустика через усилитель', () => {
    const mon = buildRoute({ console: 'qu16', transport: 'rack', source: 'dyn', speakers: 'passive', dest: 'aux-pre' });
    expect(mon.steps.some((s) => s.tap === 'pre-fader')).toBe(true);
    expect(mon.steps.some((s) => s.title === 'Усилитель мощности')).toBe(true);
    const fx = buildRoute({ console: 'qu16', transport: 'rack', source: 'dyn', speakers: 'active', dest: 'fx' });
    expect(fx.steps.find((s) => s.title === 'FX Send 1')?.tap).toBe('post-fader');
  });
  it('аналоговый пульт — только физика', () => {
    const r = buildRoute({ console: 'analog', transport: 'local', source: 'dyn', speakers: 'active', dest: 'lr' });
    expect(r.steps.every((s) => s.layer === 'phys')).toBe(true);
  });
});

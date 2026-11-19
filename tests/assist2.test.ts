import { describe, expect, it } from 'vitest';
import { PROBLEMS, validateTree } from '../src/assist/diag';
import { TASKS, score, type PatchTask } from '../src/assist/tasks';
import { checkBuild, DEVICES, judgeLink, sampleBuild } from '../src/assist/builder';
import { compOut, compressor, tempoDelay, levels, dbuToV } from '../src/calc/assist';
import { ELEMENTS, LESSONS, QUIZ } from '../src/assist/trainer';
import { autoAssign } from '../src/assist/patch';

describe('Диагностика', () => {
  it('все деревья целые, у каждой проблемы есть выводы', () => {
    for (const p of PROBLEMS) {
      expect(validateTree(p)).toEqual([]);
      expect(Object.values(p.nodes).some((n) => n.fix)).toBe(true);
    }
  });
  it('из каждого узла достижим вывод (нет тупиков и циклов без выхода)', () => {
    for (const p of PROBLEMS) {
      const memo = new Map<string, boolean>();
      const ok = (id: string, seen: Set<string>): boolean => {
        if (memo.has(id)) return memo.get(id)!;
        const n = p.nodes[id];
        if (n.fix) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        const r = (n.answers ?? []).every((a) => ok(a.next, seen));
        memo.set(id, r);
        return r;
      };
      expect(ok(p.start, new Set())).toBe(true);
    }
  });
});

describe('Тренажёр', () => {
  it('уроки и викторина ссылаются на существующие элементы', () => {
    for (const l of LESSONS) for (const s of l.steps) expect(ELEMENTS[s.el]).toBeTruthy();
    for (const q of QUIZ) expect(ELEMENTS[q.el]).toBeTruthy();
  });
  it('уроки про группы и матрицы помечены как Qu-24', () => {
    for (const l of LESSONS) if (/группа|матриц/i.test(l.title)) expect(l.qu24).toBe(true);
  });
});

describe('Задания', () => {
  const patchTasks = TASKS.filter((t): t is PatchTask => t.kind === 'patch');
  it('стартовое состояние каждого задания не решено', () => {
    for (const t of patchTasks) expect(score(t.verify(t.start())).done).toBe(false);
  });
  it('8 микрофонов: эталонное решение принимается', () => {
    const t = patchTasks.find((x) => x.id === 't8mic')!;
    const p = t.start();
    p.inputs = p.inputs.map((s, i) => ({ ...s, loc: 'rack', socket: i + 1, ch: `CH${i + 1}`, phantom: s.kind === 'cond' }));
    expect(t.verify(p).filter((i) => !i.ok)).toEqual([]);
  });
  it('конференция: эталонное решение принимается', () => {
    const t = patchTasks.find((x) => x.id === 'tconf')!;
    const p = t.start();
    p.inputs = autoAssign(p);
    p.outputs = [
      { id: 'o1', name: 'Портал L', dest: 'mains', bus: 'LR', leg: 'L', socket: 'RACK:1' },
      { id: 'o2', name: 'Портал R', dest: 'mains', bus: 'LR', leg: 'R', socket: 'RACK:2' },
      { id: 'o3', name: 'Монитор', dest: 'monitor', bus: 'Mix1', leg: null, socket: 'RACK:3' },
      { id: 'o4', name: 'Запись', dest: 'record', bus: 'LR', leg: null, socket: '2TRK' },
    ];
    expect(t.verify(p).filter((i) => !i.ok)).toEqual([]);
  });
  it('мониторы: эталонное решение принимается', () => {
    const t = patchTasks.find((x) => x.id === 'tmon')!;
    const p = t.start();
    p.outputs = p.outputs.map((o) => {
      if (o.id === 'm2') return { ...o, bus: 'Mix2' };
      if (o.id === 'm3') return { ...o, bus: 'Mix3', leg: null };
      if (o.id === 'm4') return { ...o, socket: 'RACK:6' };
      if (o.id === 'i1') return { ...o, bus: 'Mix5/6', leg: 'L' as const };
      if (o.id === 'i2') return { ...o, bus: 'Mix5/6', leg: 'R' as const };
      if (o.id === 's1') return { ...o, bus: 'Mix4', leg: null, socket: 'RACK:9' };
      return o;
    });
    // Mix4 занят монитором 4 — сабам нужен другой микс
    p.outputs = p.outputs.map((o) => (o.id === 's1' ? { ...o, bus: 'Mix7/8', leg: 'L' as const } : o));
    expect(t.verify(p).filter((i) => !i.ok)).toEqual([]);
  });
  it('поиск ошибок: исправленный патч принимается', () => {
    const t = patchTasks.find((x) => x.id === 'tfix')!;
    const p = t.start();
    p.inputs = p.inputs.map((s) => {
      if (s.id === 'f2') return { ...s, socket: 2 };
      if (s.id === 'f3') return { ...s, ch: 'CH3', phantom: true };
      if (s.id === 'f4') return { ...s, ch: 'CH5', phantom: true };
      if (s.id === 'f6') return { ...s, phantom: false };
      return s;
    });
    p.outputs = p.outputs.map((o) => {
      if (o.id === 'g2') return { ...o, socket: 'RACK:2' };
      if (o.id === 'g3') return { ...o, bus: 'Mix1', leg: null };
      if (o.id === 'g4') return { ...o, bus: 'LR' };
      return o;
    });
    expect(t.verify(p).filter((i) => !i.ok)).toEqual([]);
  });
  it('викторина: правильный ответ в пределах вариантов', () => {
    for (const t of TASKS) if (t.kind === 'quiz') for (const q of t.questions) expect(q.right).toBeLessThan(q.options.length);
  });
});

describe('Конструктор', () => {
  it('пример собран без ошибок', () => {
    const r = checkBuild(sampleBuild());
    expect(r.links.every((l) => l.level !== 'crit')).toBe(true);
    expect(r.issues.some((i) => i.level === 'crit' || i.level === 'warn')).toBe(false);
  });
  it('усилитель в линейный вход и линия в пассивную колонку — ошибка', () => {
    const amp = DEVICES.amp, spk = DEVICES['active-spk'], ps = DEVICES['passive-spk'], qu = DEVICES.qu16;
    expect(judgeLink(amp.ports[2], spk.ports[0], amp, spk).level).toBe('crit');
    expect(judgeLink(qu.ports.find((p) => p.id === 'L')!, ps.ports[0], qu, ps).level).toBe('crit');
    expect(judgeLink(qu.ports[0], qu.ports[1], qu, qu).level).toBe('crit');
  });
  it('стейджбокс без dSNAKE: источники не доходят до пульта', () => {
    const b = sampleBuild();
    b.links = b.links.filter((l) => l.id !== 'l3');
    expect(checkBuild(b).issues.some((i) => i.text.includes('не доходит до пульта'))).toBe(true);
  });
  it('два кабеля в один порт — ошибка', () => {
    const b = sampleBuild();
    b.links.push({ id: 'x', a: { dev: 'd2', port: 'out' }, b: { dev: 'd3', port: 'in1' } });
    expect(checkBuild(b).issues.some((i) => i.level === 'crit')).toBe(true);
  });
});

describe('Калькуляторы модуля C', () => {
  it('компрессор: 0 дБ при пороге −12 и 3:1 → −8 дБ, подавление 8 дБ', () => {
    expect(compOut(0, -12, 3)).toBeCloseTo(-8, 6);
    expect(compOut(-20, -12, 3)).toBe(-20);
    const r = compressor({ input: 0, thr: -12, ratio: 3, makeup: 4 });
    expect(r.results[0].value).toBeCloseTo(8, 6);
    expect(compressor({ input: 0, thr: -12, ratio: 0.5, makeup: 0 }).error).toBeTruthy();
  });
  it('дилэй: 120 BPM четверть 500 мс, восьмая с точкой 375 мс', () => {
    expect(tempoDelay(120, '1/4').results[0].value).toBeCloseTo(500, 6);
    expect(tempoDelay(120, '1/8d').results[0].value).toBeCloseTo(375, 6);
  });
  it('уровни: +4 dBu = 1,228 В, 0 dBu = 0,7746 В', () => {
    expect(dbuToV(4)).toBeCloseTo(1.228, 3);
    expect(dbuToV(0)).toBeCloseTo(0.7746, 4);
    expect(levels(0).results[1].value).toBeCloseTo(-2.218, 3);
  });
});

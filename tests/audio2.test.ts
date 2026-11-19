import { describe, expect, it } from 'vitest';
import { arrayGeometry, arrayLevel, designSplays, lineArray, configTool } from '../src/calc/audio/config';
import { subsForMain, powerAlleyNull, subsTool } from '../src/calc/audio/subs';
import { ampPower, ampPowerAt, ampTool } from '../src/calc/audio/amp';
import { impedance } from '../src/calc/audio/impedance';
import { BUILTIN_GEAR, findGear, splPair, _setCustomForTest, gearOptions } from '../src/calc/audio/gear';
import { modelFromValues } from '../src/screens/Gear';
import type { CalcResult } from '../src/calc/types';

const primary = (r: CalcResult) => r.results.find((x) => x.primary)!.value;
const byLabel = (r: CalcResult, s: string) => r.results.find((x) => x.label.startsWith(s))?.value;

// Контрольные примеры: значения посчитаны вручную, арифметика в названиях тестов.

describe('База акустики', () => {
  it('данные RCF как на rcf.it', () => {
    const hdl = findGear('rcf-hdl20a')!;
    expect([hdl.maxSpl, hdl.hAngle, hdl.vAngle, hdl.weight, hdl.dims[0], hdl.flyBar!.max]).toEqual([135, 100, 15, 30.2, 294, 16]);
    const sub = findGear('rcf-sub8006as')!;
    expect([sub.maxSpl, sub.fLow, sub.weight, sub.ampRms]).toEqual([141, 30, 96.4, 2500]);
    expect(findGear('rcf-art912a')!.maxSpl).toBe(130);
    expect(findGear('rcf-art915a')!.maxSpl).toBe(131);
    expect(BUILTIN_GEAR.every((m) => m.source.startsWith('https://www.rcf.it/'))).toBe(true);
  });
  it('пик и длительный: без указания вида — паспорт = пик, длительный = пик − 6', () => {
    expect(splPair({ maxSpl: 135, maxSplKind: 'unspec' }, 6)).toEqual({ peak: 135, cont: 129, assumed: true });
    expect(splPair({ maxSpl: 125, maxSplKind: 'cont' }, 6)).toEqual({ peak: 131, cont: 125, assumed: true });
    expect(splPair({ maxSpl: 135, maxSplKind: 'peak', contSpl: 128 }, 6)).toEqual({ peak: 135, cont: 128, assumed: false });
  });
  it('своя модель: проверка полей и появление в списке', () => {
    const bad = modelFromValues({ model: 'X', maxSpl: '200', kind: 'point', active: '1', hAngle: '90', vAngle: '40', fLow: '50', fHigh: '20000', weight: '10' } as never, 'u1');
    expect(typeof bad).toBe('string');
    const ok = modelFromValues({ brand: 'Test', model: 'P12', maxSpl: '128', maxSplKind: 'peak', contSpl: '', kind: 'point', active: '0', hAngle: '90', vAngle: '50', fLow: '55', fHigh: '20000', sens: '98', powerAes: '500', z: '8', weight: '20', dimH: '600', dimW: '380', dimD: '350', maxFlown: '', maxStacked: '', source: '' } as never, 'u1');
    expect(typeof ok).toBe('object');
    _setCustomForTest([ok as never]);
    expect(gearOptions(['point']).some((o) => o.value === 'u1')).toBe(true);
    // Пассивная своя модель подставляется в расчёт усилителя: 98 дБ, 500 Вт, 8 Ом.
    const r = ampTool.compute({ ...ampTool.defaults, model: 'u1', target: '95', distance: '15', headroom: '10' });
    expect(primary(r) as number).toBeCloseTo(Math.pow(10, (95 + 10 - 98 + 20 * Math.log10(15)) / 10), 6);
    _setCustomForTest([]);
  });
});

describe('Линейный массив', () => {
  it('геометрия: модуль 0,3 м, наклон 10°, верх 8 м → центр (−0,026; 7,852), ось на 35,43 м при ушах 1,6 м', () => {
    const [b] = arrayGeometry(8, 0.3, 1.6, [10]);
    expect(b.c.x).toBeCloseTo(-0.15 * Math.sin(Math.PI / 18), 6);
    expect(b.c.y).toBeCloseTo(8 - 0.15 * Math.cos(Math.PI / 18), 6);
    expect(b.hit).toBeCloseTo(b.c.x + (b.c.y - 1.6) / Math.tan(Math.PI / 18), 6);
    expect(b.hit).toBeCloseTo(35.43, 2);
  });
  it('модуль без наклона не попадает в зрителей', () => {
    expect(arrayGeometry(8, 0.3, 1.6, [0])[0].hit).toBe(Infinity);
  });
  it('углы: шаг рамы и максимум соблюдаются, оси идут от дальних рядов к ближним', () => {
    const d = designSplays(8, 8, 0.294, 1.6, 4, 35, 10, 1);
    expect(d.splays.every((s) => s >= 0 && s <= 10 && Number.isInteger(s))).toBe(true);
    const hits = arrayGeometry(8, 0.294, 1.6, d.tilts).map((b) => b.hit);
    for (let k = 1; k < hits.length; k++) expect(hits[k]).toBeLessThanOrEqual(hits[k - 1] + 1e-9);
    expect(hits[0]).toBeGreaterThan(30);
  });
  it('уровень 4 модулей по 129 дБ на 20 м: 129 + 6,02 − 26,02 = 109,0 … 129 + 12,04 − 26,02 = 115,02', () => {
    const l = arrayLevel(129, 4, 20);
    expect(l.low).toBeCloseTo(109.0, 2);
    expect(l.high).toBeCloseTo(115.02, 2);
  });
  it('направленность: 6 × 0,294 м = 1,764 м → 343 / 1,764 = 194 Гц', () => {
    const r = configTool.compute({ ...configTool.defaults, mode: 'line', model: 'rcf-hdl20a', count: '6' });
    expect(byLabel(r, 'Направленность по вертикали') as number).toBeCloseTo(194.4, 1);
    expect(byLabel(r, 'Вес массива') as number).toBeCloseTo(6 * 30.2 + 20.69, 6);
  });
  it('больше 16 HDL 20-A — критическое предупреждение', () => {
    const r = configTool.compute({ ...configTool.defaults, mode: 'line', model: 'rcf-hdl20a', count: '18' });
    expect(r.warnings.some((w) => w.level === 'crit' && w.text.includes('16'))).toBe(true);
  });
  it('по углу: Θ = arctg(6,4/4) − arctg(6,4/35) = 47,63°, при 10° нужно ⌈4,76⌉ + 1 = 6', () => {
    const r = lineArray({ trimH: 8, earH: 1.6, dNear: 4, dFar: 35, boxH: 0.294, boxD: 0.445, vAngle: 15, hAngle: 100, contSpl: 129, peakSpl: 135, target: 90, count: 0, maxSplay: 10, splayStep: 1, fCtrl: 0, maxFlown: 16, weight: 30.2, barWeight: 0, roomWidth: 0, offset: 0 }, 'x', []);
    expect(byLabel(r, 'Нужный вертикальный угол') as number).toBeCloseTo(47.63, 2);
    expect(primary(r)).toBe(6);
  });
  it('нельзя: массив ниже ушей', () => {
    expect(configTool.compute({ ...configTool.defaults, mode: 'line', model: 'rcf-hdl20a', trimH: '1' }).error).toBeTruthy();
  });
  it('точечный режим с ART 912-A: 130 − 6 = 124 дБ длительно, угол 100°', () => {
    const r = configTool.compute({ ...configTool.defaults, mode: 'point', model: 'rcf-art912a' });
    // Самое дальнее место: √(24² + 5²) = 24,52 м; 124 − 20·lg 24,52 = 96,21
    expect(byLabel(r, 'Уровень на самом дальнем') as number).toBeCloseTo(124 - 20 * Math.log10(Math.hypot(24, 5)), 6);
    expect(r.figures?.[0].kind).toBe('plan');
  });
});

describe('Сабвуферы', () => {
  it('баланс с Main PA: 16 × HDL (135) и SUB 8006 (141), +6 дБ → 16 · 10^0 = 16; без подъёма 8 модулей → ⌈8 · 10^(−0,3)⌉ = 5', () => {
    expect(subsForMain(135, 16, 141, 6)).toBe(16);
    expect(subsForMain(135, 8, 141, 0)).toBe(5);
  });
  it('провал L/R: 63 Гц, 25 м, стеки через 12 м → (343/63)·25/24 = 5,67 м', () => {
    expect(powerAlleyNull(63, 25, 12)).toBeCloseTo(5.671, 3);
  });
  it('SUB 8006-AS: 110 дБ на 25 м с запасом 3 дБ → 10^((113 + 27,96 − 141)/20) ≈ 1 шт', () => {
    const r = subsTool.compute(subsTool.defaults);
    expect(primary(r)).toBe(1);
  });
  it('кардиоида: кратно 3 и задержка = глубина 0,70 м / 343,4 м/с = 2,04 мс', () => {
    const r = subsTool.compute({ ...subsTool.defaults, target: '120', layout: 'cardioid' });
    expect((primary(r) as number) % 3).toBe(0);
    expect(r.warnings.some((w) => w.text.includes('2,04 мс'))).toBe(true);
  });
  it('L/R — чётное количество', () => {
    const r = subsTool.compute({ ...subsTool.defaults, target: '118', layout: 'lr' });
    expect((primary(r) as number) % 2).toBe(0);
  });
});

describe('Усилитель', () => {
  it('мощность на нагрузке: 1000 Вт/8 Ом и 1600 Вт/4 Ом; на 6 Ом — 1600·4/6 = 1066,7; на 16 Ом — 500; на 2 Ом нельзя', () => {
    expect(ampPowerAt(4, 1000, 1600, 0).p).toBeCloseTo(1600, 6);
    expect(ampPowerAt(6, 1000, 1600, 0).p).toBeCloseTo(1066.67, 2);
    expect(ampPowerAt(16, 1000, 1600, 0).p).toBeCloseTo(500, 6);
    expect(ampPowerAt(2, 1000, 1600, 0).ok).toBe(false);
  });
  it('2 кабинета по 8 Ом параллельно: нагрузка 4 Ом, мощность канала ×2', () => {
    const r = ampPower({ sens: 98, target: 100, distance: 20, headroom: 0, ratedPower: 1000, z: 8, count: 2, wiring: 'parallel' });
    expect(byLabel(r, 'Нагрузка на канал')).toBeCloseTo(4, 6);
    expect(byLabel(r, 'Нужно от канала') as number).toBeCloseTo(2 * 634.0, 0);
  });
  it('4 × 8 Ом параллельно на усилитель без 2 Ом — критическое предупреждение', () => {
    const r = ampPower({ sens: 98, target: 95, distance: 10, headroom: 6, ratedPower: 500, z: 8, count: 4, wiring: 'parallel', amp8: 600, amp4: 1000, amp2: 0 });
    expect(r.warnings.some((w) => w.level === 'crit' && w.text.includes('ниже минимальной'))).toBe(true);
  });
  it('слабый усилитель — предупреждение о клиппинге', () => {
    const r = ampPower({ sens: 95, target: 105, distance: 20, headroom: 10, ratedPower: 2000, z: 8, amp8: 500, amp4: 800 });
    expect(r.warnings.some((w) => w.text.includes('клиппировать'))).toBe(true);
  });
  it('активная модель: внешний усилитель не нужен', () => {
    expect(primary(ampTool.compute({ ...ampTool.defaults, model: 'rcf-art915a' }))).toBe('не нужен');
  });
});

describe('Импеданс: схема и сравнение', () => {
  it('4 × 8 Ом: параллельно 2, 2×2 = 8, последовательно 32', () => {
    const r = impedance({ mode: 'sp', list: [], z: 8, n: 2, m: 2, ampMin: 4, ampPower: 0 });
    const rows = r.tables![0].rows;
    expect(rows.map((x) => x[1])).toEqual(['2,00', '8,00', '32,00']);
    expect(r.tables![0].mark).toBe(1);
    expect(rows[0][2]).toContain('нельзя');
    const f = r.figures![0];
    expect(f.kind === 'wiring' && f.groups.length).toBe(2);
  });
});

/* ---------------- Калькуляторы 5–9 ---------------- */
import { cableLength, cableLoss, cableLengthTool, cableEnd, checkPorts, aggregate, lossRow, RHO_CCA } from '../src/calc/audio/cable';
import { coverage, qMolloy, criticalDistance } from '../src/calc/audio/coverage';
import { splAtDistance, nearFieldLimit, lineArrayLoss, splTool } from '../src/calc/audio/spl';
import { delayLine, delayTool } from '../src/calc/audio/delay';
import { calcToCsv } from '../src/core/csv';

describe('Кабели: разъёмы и список', () => {
  it('XLR: на выходе прибора кабель «мама», на входе «папа»', () => {
    expect(cableEnd('xlr3', 'src')).toBe('XLR3 мама');
    expect(cableEnd('xlr3', 'dst')).toBe('XLR3 папа');
  });
  it('симметричный XLR в RCA — предупреждение о несимметричной линии', () => {
    expect(checkPorts('line-bal', 'xlr3', 'rca').some((w) => w.text.includes('несимметричной'))).toBe(true);
    expect(checkPorts('mic', 'xlr3', 'xlr3')).toEqual([]);
  });
  it('запас на концы: (12 + 2)·1,15 + 2·1 = 18,1 м → 20 м', () => {
    const r = cableLength({ horizontal: 12, vertical: 2, reservePct: 15, runs: 1, type: 'mic', endReserve: 1 });
    expect(primary(r) as number).toBeCloseTo(18.1, 10);
    expect(byLabel(r, 'Готовый кабель')).toBe(20);
  });
  it('сводка: одинаковые кабели складываются', () => {
    const rows = aggregate([
      { purpose: 'A', type: 'mic', src: 'xlr3', dst: 'xlr3', len: 8, runs: 4 },
      { purpose: 'B', type: 'mic', src: 'xlr3', dst: 'xlr3', len: 9.5, runs: 2 },
      { purpose: 'C', type: 'mic', src: 'xlr3', dst: 'xlr3', len: 12, runs: 1 },
    ]);
    expect(rows).toEqual([
      ['Микрофонный, симметричный', 'XLR3 мама — XLR3 папа', '10 м', '6 шт'],
      ['Микрофонный, симметричный', 'XLR3 мама — XLR3 папа', '15 м', '1 шт'],
    ]);
  });
  it('список попадает в таблицы и CSV', () => {
    const list = JSON.stringify([{ purpose: 'Вокал', type: 'mic', src: 'xlr3', dst: 'xlr3', len: 16.1, runs: 2 }]);
    const r = cableLengthTool.compute({ ...cableLengthTool.defaults, list });
    expect(r.tables?.length).toBe(2);
    expect(calcToCsv('Кабели', r)).toContain('Вокал');
  });
});

describe('Потери в кабеле: сравнение', () => {
  it('2 кабинета по 8 Ом на 25 м 2,5 мм²: R = 0,35 Ом, нагрузка 4 Ом, 20·lg(4,35/4) = 0,7286 дБ', () => {
    const r = cableLoss({ length: 25, section: 2.5, z: 8, lossMax: 0.5, count: 2 });
    expect(primary(r) as number).toBeCloseTo(0.7286, 4);
    expect(byLabel(r, 'Потери напряжения') as number).toBeCloseTo((0.35 / 4.35) * 100, 6);
  });
  it('CCA: сопротивление в 0,028/0,0175 = 1,6 раза выше', () => {
    expect(lossRow(10, 1.5, 8, RHO_CCA).r / lossRow(10, 1.5, 8, 0.0175).r).toBeCloseTo(1.6, 6);
  });
  it('нагрев до 50 °C: ρ = 0,0175·(1 + 0,00393·30) = 0,019563', () => {
    const r = cableLoss({ length: 20, section: 2.5, z: 8, lossMax: 0.5, temp: 50 });
    expect(byLabel(r, 'Сопротивление линии') as number).toBeCloseTo((2 * 0.0175 * 1.1179 * 20) / 2.5, 6);
  });
  it('таблица всех сечений с отметкой рекомендуемого', () => {
    const r = cableLoss({ length: 50, section: 2.5, z: 8, lossMax: 0.5 });
    expect(r.tables![0].rows.length).toBe(7);
    expect(r.tables![0].mark).toBe(4); // 4 мм²
  });
});

describe('Покрытие: зал', () => {
  it('Q по Molloy для 90° × 40°: 180 / arcsin(sin45°·sin20°) = 12,86', () => {
    expect(qMolloy(90, 40)).toBeCloseTo(12.86, 2);
  });
  it('r_c = 0,057·√(12,86·6000/2) = 11,2 м', () => {
    expect(criticalDistance(12.86, 6000, 2)).toBeCloseTo(0.057 * Math.sqrt(12.86 * 3000), 6);
  });
  it('дыра по центру: порталы ±5 м, 90°, без разворота → покрытие сходится на 5 / tg45° = 5 м', () => {
    const r = coverage({ hAngle: 90, vAngle: 40, speakerH: 2.8, earH: 1.2, dNear: 3, dFar: 20, offset: 5 });
    expect(byLabel(r, 'Покрытие порталов сходится') as number).toBeCloseTo(5, 6);
    expect(r.warnings.some((w) => w.text.includes('front-fill'))).toBe(true);
  });
  it('боковые стены: зал 20 м, порталы ±5 м, 90° → стены с (10 − 5)/tg45° = 5 м', () => {
    const r = coverage({ hAngle: 90, vAngle: 40, speakerH: 2.8, earH: 1.2, dNear: 3, dFar: 20, offset: 5, roomW: 20 });
    expect(byLabel(r, 'Покрытие доходит до боковых') as number).toBeCloseTo(5, 6);
  });
  it('эхо задней стены: зал 30 м, первый ряд 3 м → 2·27/343 = 157 мс', () => {
    const r = coverage({ hAngle: 90, vAngle: 40, speakerH: 2.8, earH: 1.2, dNear: 3, dFar: 25, roomL: 30 });
    expect(byLabel(r, 'Запаздывание отражения') as number).toBeCloseTo((54 / 343) * 1000, 6);
  });
  it('зал короче последнего ряда — ошибка', () => {
    expect(coverage({ hAngle: 90, vAngle: 40, speakerH: 2.8, earH: 1.2, dNear: 3, dFar: 25, roomL: 20 }).error).toBeTruthy();
  });
});

describe('SPL: пиковый и длительный', () => {
  it('ART 912-A, 20 м: пик 130 − 26,02 = 103,98; длительный 124 − 26,02 = 97,98', () => {
    const r = splTool.compute({ ...splTool.defaults, gear: 'rcf-art912a', distance: '20' });
    expect(primary(r) as number).toBeCloseTo(97.979, 3);
    expect(byLabel(r, 'Пиковый уровень на r') as number).toBeCloseTo(103.979, 3);
  });
  it('пассивный: пики выше паспорта — предупреждение', () => {
    const r = splAtDistance({ sens: 98, power: 500, distance: 10, count: 1, sum: 'incoherent', model: 'point', maxSpl: 128, crest: 6 });
    // 98 + 27 = 124,99 длительно; пик 130,99 > 128
    expect(byLabel(r, 'Один кабинет на 1 м, пиковый')).toBe(128);
    expect(r.warnings.some((w) => w.text.includes('упрутся'))).toBe(true);
  });
  it('ближняя зона массива: 2,4 м, 1 кГц → 2,4²·1000/686 = 8,4 м; на 33,6 м потери 10·lg 8,4 + 20·lg 4', () => {
    const rt = nearFieldLimit(2.4, 1000);
    expect(rt).toBeCloseTo(8.3965, 3);
    expect(lineArrayLoss(4 * rt, rt)).toBeCloseTo(10 * Math.log10(rt) + 20 * Math.log10(4), 10);
    expect(lineArrayLoss(rt / 2, rt)).toBeCloseTo(10 * Math.log10(rt / 2), 10);
  });
  it('когерентное сложение — предупреждение об условиях', () => {
    const r = splAtDistance({ sens: 98, power: 100, distance: 10, count: 2, sum: 'coherent', model: 'point', maxSpl: 0 });
    expect(r.warnings.some((w) => w.text.includes('¼ длины волны'))).toBe(true);
  });
});

describe('Delay: геометрия', () => {
  it('по высотам: √(30² + 3²) = 30,15 м → 30,15/343,42·1000 = 87,79 мс + 10', () => {
    const r = delayLine({ distance: 0, temp: 20, offset: 10, sampleRate: 48000, geom: { mainH: 8, delayH: 5, horiz: 30 } });
    expect(byLabel(r, 'Расстояние по прямой') as number).toBeCloseTo(Math.hypot(30, 3), 10);
    expect(primary(r) as number).toBeCloseTo((Math.hypot(30, 3) / 343.42) * 1000 + 10, 6);
  });
  it('схема: delay с задержкой приходит позже main ровно на добавку', () => {
    const r = delayTool.compute(delayTool.defaults);
    const f = r.figures![0];
    if (f.kind !== 'timeline') throw new Error();
    expect(f.events[2].t - f.events[1].t).toBeCloseTo(10, 6);
  });
});

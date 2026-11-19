import { describe, expect, it } from 'vitest';
import { splAtDistance, splAt1m, distanceLoss, sumGain } from '../src/calc/audio/spl';
import { impedance, parallelZ, seriesZ, seriesParallelZ, parseImpedances } from '../src/calc/audio/impedance';
import { ampPower, requiredPower } from '../src/calc/audio/amp';
import { subsCount, subwoofers } from '../src/calc/audio/subs';
import { cableLength, cableLoss, lineResistance, lossDb, minSection, pickStdLength, routeLength } from '../src/calc/audio/cable';
import { coverage, coverageWidth } from '../src/calc/audio/coverage';
import { delayLine, delayMs, speedOfSound } from '../src/calc/audio/delay';
import { sideSpanDeg, speakerConfig } from '../src/calc/audio/config';
import type { CalcResult } from '../src/calc/types';

const primary = (r: CalcResult) => r.results.find((x) => x.primary)!.value as number;
const byLabel = (r: CalcResult, s: string) => r.results.find((x) => x.label.startsWith(s))!.value;

// Эталонные значения посчитаны вручную; в комментариях — арифметика.

describe('SPL', () => {
  it('уровень на 1 м от мощности: 98 + 10·lg(1000) = 128', () => {
    expect(splAt1m(98, 1000)).toBeCloseTo(128, 10);
  });
  it('затухание: 20·lg(20) = 26,0206; линейный 10·lg(20) = 13,0103', () => {
    expect(distanceLoss(20)).toBeCloseTo(26.0206, 4);
    expect(distanceLoss(20, 'line')).toBeCloseTo(13.0103, 4);
  });
  it('удвоение источников: +3,01 дБ некогерентно, +6,02 дБ когерентно', () => {
    expect(sumGain(2, 'incoherent')).toBeCloseTo(3.0103, 4);
    expect(sumGain(2, 'coherent')).toBeCloseTo(6.0206, 4);
  });
  it('128 дБ на 1 м → 101,98 дБ на 20 м', () => {
    const r = splAtDistance({ sens: 98, power: 1000, distance: 20, count: 1, sum: 'incoherent', model: 'point', maxSpl: 0 });
    expect(primary(r)).toBeCloseTo(101.979, 3);
  });
  it('ограничение паспортным максимумом', () => {
    const r = splAtDistance({ sens: 98, power: 1000, distance: 1, count: 1, sum: 'incoherent', model: 'point', maxSpl: 125 });
    expect(primary(r)).toBeCloseTo(125, 6);
    expect(r.warnings.some((w) => w.level === 'warn')).toBe(true);
  });
  it('ошибка при нулевом расстоянии', () => {
    expect(splAtDistance({ sens: 98, power: 1, distance: 0, count: 1, sum: 'incoherent', model: 'point', maxSpl: 0 }).error).toBeTruthy();
  });
});

describe('Импеданс', () => {
  it('8 ‖ 8 = 4; 4 × 8 параллельно = 2; 8 ‖ 16 = 5,333', () => {
    expect(parallelZ([8, 8])).toBeCloseTo(4, 10);
    expect(parallelZ([8, 8, 8, 8])).toBeCloseTo(2, 10);
    expect(parallelZ([8, 16])).toBeCloseTo(16 / 3, 10);
  });
  it('8 + 8 = 16; 2 последовательно × 2 параллельно по 8 Ом = 8', () => {
    expect(seriesZ([8, 8])).toBe(16);
    expect(seriesParallelZ(8, 2, 2)).toBe(8);
  });
  it('разбор списка: "8 8,5; 16" → [8, 8.5, 16]', () => {
    expect(parseImpedances('8 8,5; 16')).toEqual([8, 8.5, 16]);
    expect(parseImpedances('8, 8')).toEqual([8, 8]);
  });
  it('нагрузка ниже минимума усилителя — критическое предупреждение', () => {
    const r = impedance({ mode: 'parallel', list: [4, 4], z: 0, n: 0, m: 0, ampMin: 4, ampPower: 0 });
    expect(primary(r)).toBeCloseTo(2, 10);
    expect(r.warnings.some((w) => w.level === 'crit')).toBe(true);
  });
  it('мощность: 1000 Вт на 4 Ом → U = 63,25 В; на 8 Ом → 500 Вт', () => {
    const r = impedance({ mode: 'parallel', list: [16, 16], z: 0, n: 0, m: 0, ampMin: 4, ampPower: 1000 });
    expect(byLabel(r, 'Напряжение')).toBeCloseTo(63.2456, 3);
    expect(byLabel(r, 'Мощность в нагрузку')).toBeCloseTo(500, 6);
    expect(byLabel(r, 'На один кабинет')).toBeCloseTo(250, 6);
  });
});

describe('Мощность усилителя', () => {
  it('98 дБ, цель 100 дБ на 20 м без запаса: 10^((100−98+26,0206)/10) = 634,0 Вт', () => {
    expect(requiredPower(98, 100, 20, 0)).toBeCloseTo(634.0, 0);
  });
  it('500 Вт на 8 Ом: U = 63,25 В, I = 7,906 А', () => {
    const r = ampPower({ sens: 98, target: 98 - 26.0206 + 10 * Math.log10(500), distance: 20, headroom: 0, ratedPower: 1000, z: 8 });
    expect(primary(r)).toBeCloseTo(500, 1);
    expect(byLabel(r, 'Напряжение')).toBeCloseTo(63.25, 1);
    expect(byLabel(r, 'Ток')).toBeCloseTo(7.906, 2);
  });
  it('нужно больше паспортной мощности — критическое предупреждение', () => {
    const r = ampPower({ sens: 98, target: 110, distance: 30, headroom: 10, ratedPower: 500, z: 8 });
    expect(r.warnings.some((w) => w.level === 'crit')).toBe(true);
  });
});

describe('Сабвуферы', () => {
  it('131 дБ, цель 115 на 30 м: (115+29,54−131)/20 → 10^0,677 = 4,75 → 5 шт', () => {
    expect(subsCount(131, 115, 30, 0, 20)).toBe(5);
  });
  it('некогерентно: 10^(13,54/10) = 22,6 → 23 шт', () => {
    expect(subsCount(131, 115, 30, 0, 10)).toBe(23);
  });
  it('один сабвуфер, если уровня хватает', () => {
    expect(subsCount(131, 100, 10, 0, 20)).toBe(1);
  });
  it('уровень с найденным количеством не ниже цели', () => {
    const r = subwoofers({ maxSpl: 131, target: 115, distance: 30, headroom: 3 });
    expect(byLabel(r, 'Уровень с этим') as number).toBeGreaterThanOrEqual(118);
  });
});

describe('Кабели', () => {
  it('20 м, 2,5 мм²: R = 2·0,0175·20/2,5 = 0,28 Ом', () => {
    expect(lineResistance(20, 2.5)).toBeCloseTo(0.28, 10);
  });
  it('потери на 8 Ом: 20·lg(8,28/8) = 0,2988 дБ', () => {
    expect(lossDb(8, 0.28)).toBeCloseTo(0.2988, 4);
  });
  it('мин. сечение для 0,5 дБ, 50 м, 8 Ом: Rmax = 8·(10^0,025−1) = 0,4747 → A = 3,687 мм²', () => {
    expect(minSection(50, 8, 0.5)).toBeCloseTo(3.687, 2);
    const r = cableLoss({ length: 50, section: 2.5, z: 8, lossMax: 0.5 });
    expect(byLabel(r, 'Ближайшее стандартное')).toBe('4');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('трасса: (12 + 2)·1,15 = 16,1 м → готовый кабель 20 м', () => {
    expect(routeLength(12, 2, 15)).toBeCloseTo(16.1, 10);
    expect(pickStdLength(16.1)).toBe(20);
    const r = cableLength({ horizontal: 12, vertical: 2, reservePct: 15, runs: 8, type: 'mic' });
    expect(byLabel(r, 'Всего кабеля')).toBe(160);
  });
  it('UTP длиннее 100 м — критическое предупреждение', () => {
    const r = cableLength({ horizontal: 95, vertical: 5, reservePct: 10, runs: 1, type: 'utp' });
    expect(r.warnings.some((w) => w.level === 'crit')).toBe(true);
  });
});

describe('Покрытие', () => {
  it('90° на 10 м → ширина 20 м', () => {
    expect(coverageWidth(10, 90)).toBeCloseTo(20, 10);
  });
  it('наклон: подъём 1,6 м, последний ряд 20 м → arctg(0,08) = 4,574°', () => {
    const r = coverage({ hAngle: 90, vAngle: 40, speakerH: 2.8, earH: 1.2, dNear: 3, dFar: 20 });
    expect(byLabel(r, 'Наклон')).toBeCloseTo(4.574, 3);
  });
  it('разница уровней: 20·lg(√(400+2,56)/√(9+2,56)) = 20·lg(20,064/3,4) = 15,42 дБ', () => {
    const r = coverage({ hAngle: 90, vAngle: 40, speakerH: 2.8, earH: 1.2, dNear: 3, dFar: 20 });
    expect(byLabel(r, 'Разница')).toBeCloseTo(15.419, 3);
  });
});

describe('Задержка', () => {
  it('c(20 °C) = 343,42 м/с', () => {
    expect(speedOfSound(20)).toBeCloseTo(343.42, 6);
  });
  it('34,342 м при 20 °C → 100 мс', () => {
    expect(delayMs(34.342, 20)).toBeCloseTo(100, 6);
  });
  it('итог с добавкой 10 мс и в отсчётах 48 кГц', () => {
    const r = delayLine({ distance: 34.342, temp: 20, offset: 10, sampleRate: 48000 });
    expect(primary(r)).toBeCloseTo(110, 6);
    expect(byLabel(r, 'В отсчётах')).toBe(5280);
  });
});

describe('Конфигурация акустики', () => {
  it('угол портала: 2·arctg(5/3) = 118,07°', () => {
    expect(sideSpanDeg(20, 5, 3)).toBeCloseTo(118.07, 2);
  });
  it('90° кабинеты → 2 на портал, уровень 128 − 20·lg(24,515) = 100,21 дБ', () => {
    const r = speakerConfig({ roomWidth: 20, dFirst: 3, dLast: 24, offset: 5, hAngle: 90, maxSpl: 128, target: 98 });
    expect(primary(r)).toBe(2);
    expect(byLabel(r, 'Уровень на самом')).toBeCloseTo(100.21, 2);
    expect(byLabel(r, 'Запас')).toBeCloseTo(2.21, 2);
  });
  it('не хватает уровня — критическое предупреждение', () => {
    const r = speakerConfig({ roomWidth: 20, dFirst: 3, dLast: 40, offset: 5, hAngle: 90, maxSpl: 120, target: 100 });
    expect(r.warnings.some((w) => w.level === 'crit')).toBe(true);
  });
});

describe('Тексты предупреждений', () => {
  it('дробные числа пользователя выводятся с запятой', () => {
    const r = cableLoss({ length: 50, section: 2.5, z: 4, lossMax: 0.5 });
    expect(r.warnings[0].text).toContain('допустимых 0,5 дБ');
  });
});

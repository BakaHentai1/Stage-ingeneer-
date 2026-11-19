import { CalcResult, CalcWarning, ToolDef, fail, lg, num, requireFinite, fx } from '../types';

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

/** Ширина покрытия на расстоянии d при угле раскрытия θ: W = 2·d·tg(θ/2). */
export function coverageWidth(d: number, angleDeg: number): number {
  return 2 * d * Math.tan(rad(angleDeg / 2));
}

export interface CoverageInput {
  hAngle: number;
  vAngle: number;
  speakerH: number;
  earH: number;
  dNear: number;
  dFar: number;
}

export function coverage(i: CoverageInput): CalcResult {
  const err = requireFinite([
    ['Угол по горизонтали', i.hAngle], ['Угол по вертикали', i.vAngle], ['Высота кабинета', i.speakerH],
    ['Высота ушей', i.earH], ['До первого ряда', i.dNear], ['До последнего ряда', i.dFar],
  ]);
  if (err) return fail(err);
  if (i.hAngle <= 0 || i.hAngle >= 180 || i.vAngle <= 0 || i.vAngle >= 180) return fail('Углы раскрытия должны быть от 1 до 179°.');
  if (i.dNear <= 0 || i.dFar <= 0) return fail('Расстояния должны быть больше 0 м.');
  if (i.dFar <= i.dNear) return fail('Последний ряд должен быть дальше первого.');

  const dh = i.speakerH - i.earH;
  const wNear = coverageWidth(i.dNear, i.hAngle);
  const wFar = coverageWidth(i.dFar, i.hAngle);
  const sNear = Math.hypot(i.dNear, dh);
  const sFar = Math.hypot(i.dFar, dh);
  const tilt = deg(Math.atan2(dh, i.dFar));
  const angNear = deg(Math.atan2(dh, i.dNear));
  const offNear = angNear - tilt;
  const dL = 20 * lg(sFar / sNear);
  const warnings: CalcWarning[] = [];

  let nearLevel: 'ok' | 'warn' = 'ok';
  if (offNear > i.vAngle / 2) {
    nearLevel = 'warn';
    warnings.push({
      level: 'warn',
      text: `Первый ряд на ${fx(offNear, 1)}° ниже оси, это за пределами вертикального покрытия (±${fx(i.vAngle / 2, 1)}°). Нужен front-fill или кабинет с большим вертикальным углом.`,
    });
  }
  if (dL > 6) {
    warnings.push({
      level: 'warn',
      text: `Разница уровня между первым и последним рядом ${fx(dL, 1)} дБ. Наведение оси на дальние ряды частично компенсирует её; при разнице больше 6–10 дБ подумайте о delay-линии.`,
    });
  }
  if (i.speakerH > 3) {
    warnings.push({
      level: 'crit',
      text: 'Кабинет выше 3 м — это подвес или высокая стойка. Используйте только сертифицированный такелаж и проверенные точки подвеса. Проверка специалистом обязательна.',
    });
  }

  return {
    formulas: [
      'W = 2·d·tg(θ_г / 2)',
      'Наклон оси α = arctg((h_к − h_у) / d_посл)',
      'ΔL = 20·lg(s_посл / s_перв),  s = √(d² + (h_к − h_у)²)',
    ],
    inputs: [
      { label: 'Угол раскрытия по горизонтали θ_г', value: i.hAngle, unit: '°', digits: 0 },
      { label: 'Угол раскрытия по вертикали θ_в', value: i.vAngle, unit: '°', digits: 0 },
      { label: 'Высота кабинета (акуст. центр) h_к', value: i.speakerH, unit: 'м', digits: 2 },
      { label: 'Высота ушей слушателя h_у', value: i.earH, unit: 'м', digits: 2 },
      { label: 'До первого ряда d_перв', value: i.dNear, unit: 'м', digits: 1 },
      { label: 'До последнего ряда d_посл', value: i.dFar, unit: 'м', digits: 1 },
    ],
    results: [
      { label: 'Ширина покрытия на последнем ряду', value: wFar, unit: 'м', digits: 1, primary: true },
      { label: 'Ширина покрытия на первом ряду', value: wNear, unit: 'м', digits: 1 },
      { label: 'Наклон оси вниз (на последний ряд)', value: tilt, unit: '°', digits: 1 },
      { label: 'Первый ряд ниже оси на', value: offNear, unit: '°', digits: 1, level: nearLevel },
      { label: 'Разница уровня первый/последний ряд', value: dL, unit: 'дБ', digits: 1, level: dL > 6 ? 'warn' : 'ok' },
    ],
    limits: [
      'Угол раскрытия — паспортный, по уровню −6 дБ. На границе покрытия уровень на 6 дБ ниже, чем на оси.',
      'Угол раскрытия зависит от частоты: на НЧ он шире, на ВЧ может быть уже паспортного.',
      'Разница уровней считается по закону обратных квадратов без учёта направленности кабинета и отражений.',
      'Расстояния — по горизонтали от кабинета до рядов.',
    ],
    warnings,
  };
}

export const coverageTool: ToolDef = {
  id: 'coverage',
  title: 'Звуковое покрытие',
  short: 'ширина, наклон, первые ряды',
  fields: [
    { key: 'hAngle', label: 'Угол по горизонтали', unit: '°', type: 'number' },
    { key: 'vAngle', label: 'Угол по вертикали', unit: '°', type: 'number' },
    { key: 'speakerH', label: 'Высота кабинета', unit: 'м', type: 'number', step: 0.1 },
    { key: 'earH', label: 'Высота ушей', unit: 'м', type: 'number', step: 0.1, hint: '1,2 сидя, 1,6 стоя' },
    { key: 'dNear', label: 'До первого ряда', unit: 'м', type: 'number', step: 0.5 },
    { key: 'dFar', label: 'До последнего ряда', unit: 'м', type: 'number', step: 0.5 },
  ],
  defaults: { hAngle: '90', vAngle: '40', speakerH: '2.8', earH: '1.2', dNear: '3', dFar: '20' },
  compute: (v) =>
    coverage({
      hAngle: num(v.hAngle), vAngle: num(v.vAngle), speakerH: num(v.speakerH), earH: num(v.earH),
      dNear: num(v.dNear), dFar: num(v.dFar),
    }),
};

import { CalcResult, CalcWarning, ToolDef, fail, num, fx, rn } from '../types';

export type ImpedanceMode = 'parallel' | 'series' | 'sp';

export function seriesZ(list: number[]): number {
  return list.reduce((a, b) => a + b, 0);
}

export function parallelZ(list: number[]): number {
  return 1 / list.reduce((a, z) => a + 1 / z, 0);
}

/** n одинаковых кабинетов последовательно в группе, m групп параллельно. */
export function seriesParallelZ(z: number, n: number, m: number): number {
  return (z * n) / m;
}

/** Разбор списка импедансов. Разделители: пробел, «;» или «, » (запятая с пробелом). */
export function parseImpedances(s: string): number[] {
  return s
    .split(/;|\s+|,\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => Number(x.replace(',', '.')));
}

export interface ImpedanceInput {
  mode: ImpedanceMode;
  list: number[];
  z: number;
  n: number;
  m: number;
  /** Минимально допустимая нагрузка усилителя на канал, Ом. */
  ampMin: number;
  /** Мощность усилителя на канал при этой нагрузке (необязательно, 0 — не задана), Вт. */
  ampPower: number;
}

export function impedance(i: ImpedanceInput): CalcResult {
  const warnings: CalcWarning[] = [];
  let total: number;
  let formula: string;
  let countSpk: number;
  const inputs: CalcResult['inputs'] = [];

  if (i.mode === 'sp') {
    if (![i.z, i.n, i.m].every(Number.isFinite)) return fail('Заполните импеданс, число кабинетов в группе и число групп.');
    if (i.z <= 0) return fail('Импеданс должен быть больше 0 Ом.');
    if (i.n < 1 || i.m < 1 || !Number.isInteger(i.n) || !Number.isInteger(i.m)) return fail('Количество — целые числа от 1.');
    total = seriesParallelZ(i.z, i.n, i.m);
    formula = 'Z = Z₁ · n / m';
    countSpk = i.n * i.m;
    inputs.push(
      { label: 'Импеданс кабинета Z₁', value: i.z, unit: 'Ом', digits: 1 },
      { label: 'Последовательно в группе n', value: i.n, digits: 0 },
      { label: 'Групп параллельно m', value: i.m, digits: 0 },
    );
  } else {
    if (i.list.length === 0) return fail('Введите импедансы через пробел, например: 8 8 16.');
    if (i.list.some((z) => !Number.isFinite(z) || z <= 0)) return fail('Все импедансы должны быть положительными числами.');
    countSpk = i.list.length;
    if (i.mode === 'series') {
      total = seriesZ(i.list);
      formula = 'Z = Z₁ + Z₂ + … + Zₙ';
      if (new Set(i.list).size > 1) {
        warnings.push({
          level: 'warn',
          text: 'При последовательном соединении разных импедансов мощность делится пропорционально импедансу: громче будет кабинет с большим Z.',
        });
      }
    } else {
      total = parallelZ(i.list);
      formula = '1/Z = 1/Z₁ + 1/Z₂ + … + 1/Zₙ';
      if (new Set(i.list).size > 1) {
        warnings.push({
          level: 'info',
          text: 'При параллельном соединении разных импедансов больше мощности получит кабинет с меньшим Z.',
        });
      }
    }
    inputs.push({ label: 'Импедансы', value: i.list.join(' · '), unit: 'Ом' });
  }

  inputs.push({ label: 'Соединение', value: i.mode === 'parallel' ? 'параллельно' : i.mode === 'series' ? 'последовательно' : 'последовательно-параллельно' });
  if (i.ampMin > 0) inputs.push({ label: 'Мин. нагрузка усилителя', value: i.ampMin, unit: 'Ом', digits: 1 });

  const results: CalcResult['results'] = [];
  let level: 'ok' | 'crit' = 'ok';
  if (i.ampMin > 0 && total < i.ampMin - 1e-9) {
    level = 'crit';
    warnings.push({
      level: 'crit',
      text: `Нагрузка ${fx(total, 2)} Ом ниже минимально допустимой ${rn(i.ampMin)} Ом. Усилитель может уйти в защиту, перегреться или выйти из строя. Уменьшите число кабинетов на канал или измените схему соединения.`,
    });
  }
  results.push({ label: 'Общий импеданс', value: total, unit: 'Ом', digits: 2, primary: true, level });
  results.push({ label: 'Кабинетов на канал', value: countSpk, digits: 0 });

  const formulas = [formula];
  if (i.ampPower > 0 && i.ampMin > 0 && level === 'ok') {
    // Идеальный источник напряжения: U = √(P·Zmin) — напряжение, при котором усилитель даёт паспортную мощность на мин. нагрузке.
    const u = Math.sqrt(i.ampPower * i.ampMin);
    const pTotal = (u * u) / total;
    formulas.push('U = √(P_ус · Z_мин),  P = U² / Z');
    inputs.push({ label: 'Мощность усилителя при Z_мин', value: i.ampPower, unit: 'Вт', digits: 0 });
    results.push({ label: 'Напряжение на выходе', value: u, unit: 'В', digits: 1 });
    results.push({ label: 'Мощность в нагрузку (оценка)', value: pTotal, unit: 'Вт', digits: 0 });
    if (i.mode !== 'series' || new Set(i.list).size === 1) {
      results.push({ label: 'На один кабинет', value: pTotal / countSpk, unit: 'Вт', digits: 0 });
    }
  }

  return {
    formulas,
    inputs,
    results,
    limits: [
      'Используется номинальный импеданс. Реальный импеданс зависит от частоты и на отдельных частотах бывает на 15–25 % ниже номинала.',
      'Сопротивление кабеля не учтено (см. расчёт потерь в кабеле).',
      'Оценка мощности предполагает идеальный усилитель-источник напряжения; реальный усилитель на высокоомной нагрузке отдаёт меньше, на минимальной — паспортную мощность.',
    ],
    warnings,
  };
}

export const impedanceTool: ToolDef = {
  id: 'impedance',
  title: 'Импеданс',
  short: 'последовательно и параллельно',
  fields: [
    {
      key: 'mode', label: 'Соединение', type: 'select',
      options: [
        { value: 'parallel', label: 'Параллельно' },
        { value: 'series', label: 'Последовательно' },
        { value: 'sp', label: 'Последовательно-параллельно' },
      ],
    },
    { key: 'list', label: 'Импедансы кабинетов', unit: 'Ом, через пробел', type: 'text', showIf: (v) => v.mode !== 'sp', hint: 'Например: 8 8 16' },
    { key: 'z', label: 'Импеданс кабинета', unit: 'Ом', type: 'number', showIf: (v) => v.mode === 'sp' },
    { key: 'n', label: 'В группе последовательно', unit: 'шт', type: 'number', step: 1, showIf: (v) => v.mode === 'sp' },
    { key: 'm', label: 'Групп параллельно', unit: 'шт', type: 'number', step: 1, showIf: (v) => v.mode === 'sp' },
    { key: 'ampMin', label: 'Мин. нагрузка усилителя', unit: 'Ом', type: 'number', step: 0.5 },
    { key: 'ampPower', label: 'Мощность усилителя при мин. нагрузке', unit: 'Вт, 0 = нет', type: 'number' },
  ],
  defaults: { mode: 'parallel', list: '8 8', z: '8', n: '2', m: '2', ampMin: '4', ampPower: '0' },
  compute: (v) => {
    const mode = (['parallel', 'series', 'sp'].includes(v.mode) ? v.mode : 'parallel') as ImpedanceMode;
    return impedance({
      mode, list: parseImpedances(v.list ?? ''), z: num(v.z), n: num(v.n), m: num(v.m),
      ampMin: num(v.ampMin) || 0, ampPower: num(v.ampPower) || 0,
    });
  },
};

import { CalcResult, CalcWarning, ToolDef, fail, lg, num, requireFinite, rn, fx } from '../types';
import { findGear, gearName, gearOptions, sourceLine } from './gear';

export interface AmpInput {
  /** Чувствительность кабинета, дБ (1 Вт / 1 м). */
  sens: number;
  /** Требуемый уровень у слушателя, дБ SPL. */
  target: number;
  /** Расстояние до слушателя, м. */
  distance: number;
  /** Запас по пикам (headroom), дБ. */
  headroom: number;
  /** Долговременная (AES/RMS) мощность кабинета, Вт. */
  ratedPower: number;
  /** Номинальный импеданс, Ом. */
  z: number;
  /** Кабинетов на канал (по умолчанию 1). */
  count?: number;
  /** Соединение кабинетов на канале. */
  wiring?: 'parallel' | 'series';
  /** Паспортная мощность усилителя на канал при 8 / 4 / 2 Ом, Вт (0 — нет данных или не поддерживается). */
  amp8?: number;
  amp4?: number;
  amp2?: number;
  /** Каналов усилителя. */
  channels?: number;
}

/** Мощность, нужная для уровня L на расстоянии r: P = 10^((L + H − S + 20·lg r) / 10). */
export function requiredPower(sens: number, target: number, distance: number, headroom: number): number {
  return Math.pow(10, (target + headroom - sens + 20 * lg(distance)) / 10);
}

/** Мощность усилителя на нагрузку z по паспортным точкам 8/4/2 Ом. Между точками — как идеальный источник напряжения от ближайшей большей нагрузки. */
export function ampPowerAt(z: number, p8: number, p4: number, p2: number): { p: number; ok: boolean; minZ: number } {
  const pts = ([[8, p8], [4, p4], [2, p2]] as [number, number][]).filter(([, p]) => p > 0);
  if (!pts.length) return { p: 0, ok: false, minZ: 0 };
  const minZ = pts[pts.length - 1][0];
  if (z < minZ - 1e-9) return { p: 0, ok: false, minZ };
  // Ближайшая паспортная точка с Zp ≤ z (у неё известное напряжение U = √(P·Zp)); на большей нагрузке P = U² / z.
  const ref = pts.filter(([zp]) => zp <= z + 1e-9)[0] ?? pts[0];
  const u2 = ref[1] * ref[0];
  return { p: u2 / z, ok: true, minZ };
}

export function ampPower(i: AmpInput): CalcResult {
  const n = i.count ?? 1;
  const wiring = i.wiring ?? 'parallel';
  const err = requireFinite([
    ['Чувствительность', i.sens], ['Требуемый уровень', i.target], ['Расстояние', i.distance],
    ['Запас', i.headroom], ['Мощность кабинета', i.ratedPower], ['Импеданс', i.z], ['Кабинетов на канал', n],
  ]);
  if (err) return fail(err);
  if (i.distance <= 0) return fail('Расстояние должно быть больше 0 м.');
  if (i.ratedPower <= 0) return fail('Мощность кабинета должна быть больше 0 Вт.');
  if (i.z <= 0) return fail('Импеданс должен быть больше 0 Ом.');
  if (i.headroom < 0) return fail('Запас не может быть отрицательным.');
  if (n < 1 || !Number.isInteger(n) || n > 16) return fail('Кабинетов на канал — целое число от 1 до 16.');

  const p = requiredPower(i.sens, i.target, i.distance, i.headroom);
  const zLoad = wiring === 'parallel' ? i.z / n : i.z * n;
  const pChan = p * n;
  const u = Math.sqrt(pChan * zLoad);
  const current = Math.sqrt(pChan / zLoad);
  const recLow = 1.5 * i.ratedPower * n;
  const recHigh = 2 * i.ratedPower * n;
  const maxLevel = i.sens + 10 * lg(i.ratedPower) - 20 * lg(i.distance);
  const warnings: CalcWarning[] = [];
  let level: 'ok' | 'warn' | 'crit' = 'ok';

  if (p > i.ratedPower) {
    level = 'crit';
    warnings.push({
      level: 'crit',
      text: `Нужно ${Math.round(p)} Вт, а кабинет рассчитан на ${rn(i.ratedPower)} Вт. Один кабинет не обеспечит ${rn(i.target)} дБ на ${rn(i.distance)} м с запасом ${rn(i.headroom)} дБ: возьмите больше кабинетов, мощнее модель или уменьшите дистанцию.`,
    });
  } else if (p > 0.5 * i.ratedPower) {
    level = 'warn';
    warnings.push({ level: 'warn', text: 'Кабинет будет работать больше чем на половину паспортной мощности: запаса почти нет.' });
  }

  const results: CalcResult['results'] = [
    { label: 'Нужная мощность на кабинет', value: p, unit: 'Вт', digits: 0, primary: true, level },
    { label: 'Нагрузка на канал', value: zLoad, unit: 'Ом', digits: 2 },
    { label: 'Нужно от канала', value: pChan, unit: 'Вт', digits: 0 },
    { label: 'Рекомендуемый усилитель на канал', value: `${Math.round(recLow)}–${Math.round(recHigh)}`, unit: `Вт на ${fx(zLoad, 1)} Ом` },
    { label: 'Напряжение на нагрузке', value: u, unit: 'В', digits: 1 },
    { label: 'Ток в нагрузке', value: current, unit: 'А', digits: 2 },
    { label: 'Макс. уровень при P_AES на r', value: maxLevel, unit: 'дБ SPL', digits: 1 },
  ];
  const formulas = [
    'P = 10^((L + H − S + 20·lg r) / 10)',
    wiring === 'parallel' ? 'Z_нагр = Z / N  (параллельно)' : 'Z_нагр = Z · N  (последовательно)',
    'U = √(P·Z),  I = √(P / Z)',
    'P_ус ≈ (1,5…2) · P_AES · N  (практика производителей)',
  ];
  const bars: Extract<NonNullable<CalcResult['figures']>[number], { kind: 'bars' }>['bars'] = [
    { label: 'Нужно для уровня', value: pChan, tone: level === 'crit' ? 'crit' : 'info', note: `${rn(i.target)} дБ на ${rn(i.distance)} м + ${rn(i.headroom)} дБ` },
    { label: 'Паспорт кабинетов (AES)', value: i.ratedPower * n, tone: 'muted', note: `${n} × ${rn(i.ratedPower)} Вт` },
    { label: 'Рекомендуемый усилитель', value: recHigh, tone: 'ok', note: '2 × P_AES' },
  ];

  const amp8 = i.amp8 ?? 0, amp4 = i.amp4 ?? 0, amp2 = i.amp2 ?? 0;
  if (amp8 > 0 || amp4 > 0 || amp2 > 0) {
    const a = ampPowerAt(zLoad, amp8, amp4, amp2);
    formulas.push('P_ус(Z) = U² / Z,  U² = P_пасп · Z_пасп (ближайшая паспортная точка)');
    if (!a.ok) {
      level = 'crit';
      warnings.push({ level: 'crit', text: `Нагрузка ${fx(zLoad, 2)} Ом ниже минимальной для усилителя (${rn(a.minZ)} Ом по введённым данным). Риск перегрузки: усилитель уйдёт в защиту или выйдет из строя. Подключите меньше кабинетов на канал или последовательно.` });
      results.push({ label: 'Усилитель на этой нагрузке', value: 'недопустимо', level: 'crit' });
    } else {
      const ratio = a.p / (i.ratedPower * n);
      results.push({ label: 'Усилитель отдаст на эту нагрузку', value: a.p, unit: 'Вт', digits: 0, level: a.p < pChan ? 'crit' : 'ok' });
      results.push({ label: 'Запас по мощности усилителя', value: 10 * lg(a.p / pChan), unit: 'дБ', digits: 1, level: a.p < pChan ? 'crit' : 'ok' });
      results.push({ label: 'Усилитель / паспорт кабинетов', value: ratio, unit: '×', digits: 2, level: ratio > 2 ? 'warn' : ratio < 1 ? 'warn' : 'ok' });
      bars.push({ label: 'Ваш усилитель на этой нагрузке', value: a.p, tone: a.p < pChan ? 'crit' : 'accent' });
      if (a.p < pChan) {
        warnings.push({ level: 'crit', text: `Усилитель отдаёт ${Math.round(a.p)} Вт, а нужно ${Math.round(pChan)} Вт: на пиках он будет клиппировать. Клиппирование опасно для ВЧ-драйверов. Возьмите усилитель мощнее или снизьте требования.` });
      }
      if (ratio > 2) {
        warnings.push({ level: 'warn', text: `Усилитель в ${fx(ratio, 1)} раза мощнее паспорта кабинетов: риск теплового перегруза кабинета. Обязательно настройте лимитер усилителя по паспорту кабинета.` });
      } else if (ratio < 1) {
        warnings.push({ level: 'warn', text: 'Усилитель слабее паспорта кабинетов: для громкой программы его будут «дожимать» до клиппинга. Лучше 1,5–2 × P_AES.' });
      }
      if (zLoad < 4 - 1e-9) {
        warnings.push({ level: 'warn', text: 'Нагрузка ниже 4 Ом: усилитель сильнее греется, выходная мощность сильнее зависит от сопротивления кабеля. Проверьте охлаждение и сечение кабеля.' });
      }
    }
  }
  if (i.channels && i.channels > 0 && amp8 + amp4 + amp2 > 0) {
    results.push({ label: 'Кабинетов на весь усилитель', value: i.channels * n, unit: 'шт', digits: 0 });
  }
  warnings.push({
    level: 'info',
    text: 'Не подавайте на кабинет постоянную мощность выше паспортной: клиппированный сигнал перегревает ВЧ-драйверы быстрее, чем «чистая» мощность.',
  });

  return {
    formulas,
    inputs: [
      { label: 'Чувствительность S', value: i.sens, unit: 'дБ (1 Вт/1 м)', digits: 1 },
      { label: 'Требуемый уровень L', value: i.target, unit: 'дБ SPL', digits: 1 },
      { label: 'Расстояние r', value: i.distance, unit: 'м', digits: 1 },
      { label: 'Запас H', value: i.headroom, unit: 'дБ', digits: 1 },
      { label: 'Мощность кабинета P_AES', value: i.ratedPower, unit: 'Вт', digits: 0 },
      { label: 'Импеданс Z', value: i.z, unit: 'Ом', digits: 1 },
      { label: 'Кабинетов на канал N', value: n, digits: 0 },
      { label: 'Соединение', value: wiring === 'parallel' ? 'параллельно' : 'последовательно' },
      ...(amp8 + amp4 + amp2 > 0 ? [{ label: 'Усилитель 8 / 4 / 2 Ом', value: [amp8, amp4, amp2].map((x) => (x > 0 ? String(x) : '—')).join(' / '), unit: 'Вт' }] : []),
    ],
    results,
    explain: [
      `Чтобы кабинет с чувствительностью ${rn(i.sens)} дБ дал ${rn(i.target)} дБ на ${rn(i.distance)} м и ещё ${rn(i.headroom)} дБ на пики, ему нужно ${fx(p, 0)} Вт. Каждые +3 дБ — это удвоение мощности.`,
      `${n > 1 ? `${n} кабинета ${wiring === 'parallel' ? 'параллельно' : 'последовательно'} дают нагрузку ${fx(zLoad, 2)} Ом. ` : ''}Производители акустики советуют усилитель в 1,5–2 раза мощнее паспорта кабинета: запас на пики без клиппинга, а длительную мощность ограничивает лимитер.`,
    ],
    figures: [{ kind: 'bars', title: 'Мощность на канал: нужно, паспорт, усилитель', unit: 'Вт', bars }],
    limits: [
      'Свободное поле, точечный источник, слушатель на оси кабинета.',
      'Чувствительность и мощность — паспортные; реальная звуковая мощность падает из-за термокомпрессии на 1–3 дБ при длительной работе.',
      'Коэффициент 1,5–2 для усилителя — рекомендация многих производителей акустики, а не физический закон. Сверяйтесь с паспортом кабинета.',
      'Запас H учитывает пик-фактор программы: для речи обычно 6–10 дБ, для живой музыки 10–20 дБ.',
      'Мощность усилителя на нагрузке между паспортными точками оценена как у идеального источника напряжения; реальный усилитель может ограничивать ток.',
      'Сопротивление кабеля не учтено — см. «Потери в акустическом кабеле».',
    ],
    warnings,
  };
}

export const ampTool: ToolDef = {
  id: 'amp',
  title: 'Мощность усилителя',
  short: 'ватты, нагрузка, запас, перегрузка',
  fields: [
    { key: 'model', label: 'Акустика', type: 'select', optionsFn: () => gearOptions(['point', 'line', 'sub'], 'Пассивная, ввести вручную') },
    { key: 'sens', label: 'Чувствительность', unit: 'дБ 1 Вт/1 м', type: 'number', step: 0.5, showIf: (v) => v.model === 'manual' },
    { key: 'ratedPower', label: 'Мощность кабинета (AES/RMS)', unit: 'Вт', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'z', label: 'Импеданс кабинета', unit: 'Ом', type: 'number', showIf: (v) => v.model === 'manual' },
    { key: 'count', label: 'Кабинетов на канал', unit: 'шт', type: 'number', step: 1 },
    { key: 'wiring', label: 'Соединение на канале', type: 'select', options: [{ value: 'parallel', label: 'Параллельно' }, { value: 'series', label: 'Последовательно' }] },
    { key: 'target', label: 'Нужный уровень у слушателя', unit: 'дБ SPL', type: 'number' },
    { key: 'distance', label: 'Расстояние', unit: 'м', type: 'number', step: 0.5 },
    { key: 'headroom', label: 'Запас по пикам', unit: 'дБ', type: 'number', step: 1 },
    { key: 'amp8', label: 'Усилитель: мощность на 8 Ом', unit: 'Вт/канал, 0 = нет', type: 'number' },
    { key: 'amp4', label: 'Усилитель: мощность на 4 Ом', unit: 'Вт/канал, 0 = нет', type: 'number' },
    { key: 'amp2', label: 'Усилитель: мощность на 2 Ом', unit: 'Вт/канал, 0 = не держит', type: 'number' },
    { key: 'channels', label: 'Каналов усилителя', unit: 'шт', type: 'number', step: 1 },
  ],
  defaults: {
    model: 'manual', sens: '98', target: '95', distance: '15', headroom: '10', ratedPower: '500', z: '8', count: '1', wiring: 'parallel',
    amp8: '0', amp4: '0', amp2: '0', channels: '2',
  },
  compute: (v) => {
    const m = v.model === 'manual' ? undefined : findGear(v.model);
    if (m && m.active) {
      // Активная акустика: усилитель встроен, внешний не нужен.
      return {
        formulas: ['Усилитель встроен в кабинет'],
        inputs: [{ label: 'Модель', value: gearName(m) }],
        results: [
          { label: 'Внешний усилитель', value: 'не нужен', primary: true },
          { label: 'Встроенный, пик', value: m.ampPeak ?? '—', unit: m.ampPeak ? 'Вт' : '', digits: 0 },
          { label: 'Встроенный, RMS', value: m.ampRms ?? 'не указано', unit: m.ampRms ? 'Вт' : '', digits: 0 },
          { label: 'Макс. SPL на 1 м', value: m.maxSpl, unit: 'дБ', digits: 0 },
        ],
        explain: [
          `${gearName(m)} — активная: усилитель, процессор и защита уже внутри и настроены производителем. Подавайте линейный сигнал (XLR) и сетевое питание.`,
          'Уровень на дистанции для активной модели считайте в «SPL на дистанции» — там используется паспортный максимальный SPL.',
        ],
        limits: [sourceLine(m), ...m.notes],
        warnings: [{ level: 'warn', text: 'Питание: подключайте к линии с защитным заземлением; суммарный ток всех кабинетов на линии не должен превышать номинал автомата и кабеля. Проверку электрической схемы делает специалист.' }],
      };
    }
    return ampPower({
      sens: m?.sens ?? num(v.sens), target: num(v.target), distance: num(v.distance), headroom: num(v.headroom),
      ratedPower: m?.powerAes ?? num(v.ratedPower), z: m?.z ?? num(v.z), count: num(v.count) || 1,
      wiring: v.wiring === 'series' ? 'series' : 'parallel',
      amp8: num(v.amp8) || 0, amp4: num(v.amp4) || 0, amp2: num(v.amp2) || 0, channels: num(v.channels) || 0,
    });
  },
};

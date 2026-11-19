import { getSetting, setSetting } from '../../core/db';
import { ls } from '../../core/state';

/**
 * База акустики для модуля A.
 *
 * Встроенные модели — только данные из официальных страниц RCF (rcf.it, проверено 19.11.2026).
 * Чего производитель не публикует, здесь нет: поле остаётся пустым, а расчёт
 * просит ввести значение вручную или показывает, какое допущение сделано.
 */

export type SpeakerKind = 'line' | 'point' | 'sub';
/** Как производитель указал максимальный SPL. */
export type SplKind = 'peak' | 'cont' | 'unspec';

export interface SpeakerModel {
  id: string;
  brand: string;
  model: string;
  kind: SpeakerKind;
  /** Активная (со встроенным усилителем). */
  active: boolean;
  /** Паспортный максимальный SPL на 1 м, дБ. */
  maxSpl: number;
  maxSplKind: SplKind;
  /** Длительный SPL на 1 м, если производитель его указал. */
  contSpl?: number;
  /** Угол раскрытия по горизонтали / вертикали, ° (для модуля линейного массива — вертикаль одного модуля). */
  hAngle?: number;
  vAngle?: number;
  /** Диапазон частот, Гц. */
  fLow: number;
  fHigh: number;
  /** Встроенный усилитель, Вт (активная). */
  ampPeak?: number;
  ampRms?: number;
  /** Пассивная: чувствительность (1 Вт / 1 м), долговременная мощность AES/RMS, номинальный импеданс. */
  sens?: number;
  powerAes?: number;
  z?: number;
  /** Вес, кг, и размеры В×Ш×Г, мм. */
  weight: number;
  dims: [number, number, number];
  drivers: string;
  /** Подвес и стек по документации производителя. */
  maxFlown?: number;
  maxStacked?: number;
  flyBar?: { name: string; weight: number; max: number };
  source: string;
  notes: string[];
  custom?: boolean;
}

export const BUILTIN_GEAR: SpeakerModel[] = [
  {
    id: 'rcf-hdl20a', brand: 'RCF', model: 'HDL 20-A', kind: 'line', active: true,
    maxSpl: 135, maxSplKind: 'unspec', hAngle: 100, vAngle: 15, fLow: 55, fHigh: 20000,
    ampPeak: 1400, ampRms: 700, weight: 30.2, dims: [294, 705, 445],
    drivers: '2 × 10″ НЧ, компрессионный драйвер ВЧ (катушка 3″), раздел 800 Гц',
    maxFlown: 16, maxStacked: 4,
    flyBar: { name: 'FL-B HDL 20-18', weight: 20.69, max: 16 },
    source: 'https://www.rcf.it/en/products/product-detail/hdl-20-a',
    notes: [
      'Max SPL 135 дБ указан без пометки «пиковый» или «длительный».',
      'Подвес: до 16 модулей на раме FL-B HDL 20-18 (до 4 на FL-B LGT HDL 20); стек — до 4 модулей (руководство HDL20-A).',
      'Набор межмодульных углов в открытых данных не опубликован: углы берите из руководства и проверяйте в RCF Shape Designer.',
    ],
  },
  {
    id: 'rcf-sub8006as', brand: 'RCF', model: 'SUB 8006-AS', kind: 'sub', active: true,
    maxSpl: 141, maxSplKind: 'unspec', fLow: 30, fHigh: 120,
    ampPeak: 5000, ampRms: 2500, weight: 96.4, dims: [709, 1109, 700],
    drivers: '2 × 18″ (катушка 4″)',
    source: 'https://www.rcf.it/en/products/product-detail/sub-8006-as',
    notes: [
      'Max SPL 141 дБ указан без пометки «пиковый» или «длительный».',
      'В пульте сабвуфера есть режимы кардиоиды, фазы и задержки; предел высоты стека на странице модели не указан.',
    ],
  },
  {
    id: 'rcf-art912a', brand: 'RCF', model: 'ART 912-A', kind: 'point', active: true,
    maxSpl: 130, maxSplKind: 'unspec', hAngle: 100, vAngle: 60, fLow: 50, fHigh: 20000,
    ampPeak: 2100, weight: 19.5, dims: [642, 370, 363],
    drivers: '12″ НЧ + 1″ ВЧ (катушка 1,75″), раздел 1800 Гц',
    source: 'https://www.rcf.it/en/products/product-detail/art-912-a',
    notes: ['Max SPL 130 дБ указан без пометки «пиковый» или «длительный».', 'RMS-мощность усилителя производитель не указывает (2100 Вт — пиковая: 1400 НЧ + 700 ВЧ).'],
  },
  {
    id: 'rcf-art915a', brand: 'RCF', model: 'ART 915-A', kind: 'point', active: true,
    maxSpl: 131, maxSplKind: 'unspec', hAngle: 100, vAngle: 60, fLow: 45, fHigh: 20000,
    ampPeak: 2100, weight: 22.4, dims: [717, 415, 410],
    drivers: '15″ НЧ + 1″ ВЧ (катушка 1,75″), раздел 1800 Гц',
    source: 'https://www.rcf.it/en/products/product-detail/art-915-a',
    notes: ['Max SPL 131 дБ указан без пометки «пиковый» или «длительный».', 'RMS-мощность усилителя производитель не указывает (2100 Вт — пиковая: 1400 НЧ + 700 ВЧ).'],
  },
];

/* ---------------- Свои модели ---------------- */

const KEY = 'audioGear';
const LS_KEY = 'se:audioGear';
let custom: SpeakerModel[] = (ls.get<SpeakerModel[]>(LS_KEY) ?? []).filter(isModel);
const subs = new Set<() => void>();
let version = 0;

function isModel(x: unknown): x is SpeakerModel {
  const m = x as SpeakerModel;
  return !!m && typeof m.id === 'string' && typeof m.model === 'string' && typeof m.maxSpl === 'number';
}

function emit() {
  version++;
  subs.forEach((f) => f());
}

/** Загружает свои модели из базы (вызывается при старте и после восстановления копии). */
export async function loadGear(): Promise<void> {
  try {
    const list = await getSetting<SpeakerModel[]>(KEY);
    custom = Array.isArray(list) ? list.filter(isModel) : [];
    ls.set(LS_KEY, custom);
    emit();
  } catch {
    /* база недоступна — остаются модели из localStorage */
  }
}

export async function saveCustomModel(m: SpeakerModel): Promise<void> {
  const full = { ...m, custom: true };
  custom = [...custom.filter((x) => x.id !== m.id), full];
  ls.set(LS_KEY, custom);
  emit();
  await setSetting(KEY, custom);
}

export async function deleteCustomModel(id: string): Promise<void> {
  custom = custom.filter((x) => x.id !== id);
  ls.set(LS_KEY, custom);
  emit();
  await setSetting(KEY, custom);
}

/** Для тестов: задать свои модели без базы. */
export function _setCustomForTest(list: SpeakerModel[]) {
  custom = list;
  emit();
}

export function allGear(): SpeakerModel[] {
  return [...BUILTIN_GEAR, ...custom];
}

export function findGear(id: string | undefined): SpeakerModel | undefined {
  if (!id) return undefined;
  return allGear().find((m) => m.id === id);
}

export function gearVersion(): number {
  return version;
}

export function onGear(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

export const gearName = (m: SpeakerModel) => `${m.brand} ${m.model}`.trim();

/** Варианты для поля «Модель»: модели нужных типов + ручной ввод. */
export function gearOptions(kinds: SpeakerKind[], manualLabel = 'Ввести характеристики вручную'): { value: string; label: string }[] {
  return [
    ...allGear().filter((m) => kinds.includes(m.kind)).map((m) => ({ value: m.id, label: gearName(m) + (m.custom ? ' (своя)' : '') })),
    { value: 'manual', label: manualLabel },
  ];
}

/**
 * Пиковый и длительный SPL модели на 1 м.
 * Если производитель не уточнил вид максимума, считаем паспортное значение пиковым
 * (осторожный вариант), а длительное — ниже на пик-фактор crest.
 */
export function splPair(m: Pick<SpeakerModel, 'maxSpl' | 'maxSplKind' | 'contSpl'>, crest: number): { peak: number; cont: number; assumed: boolean } {
  if (m.contSpl !== undefined && Number.isFinite(m.contSpl)) {
    return { peak: m.maxSplKind === 'cont' ? m.contSpl + crest : m.maxSpl, cont: m.contSpl, assumed: m.maxSplKind === 'cont' };
  }
  if (m.maxSplKind === 'cont') return { peak: m.maxSpl + crest, cont: m.maxSpl, assumed: true };
  return { peak: m.maxSpl, cont: m.maxSpl - crest, assumed: true };
}

export const SPL_KIND_LABEL: Record<SplKind, string> = {
  peak: 'пиковый',
  cont: 'длительный',
  unspec: 'вид не указан производителем',
};

export const KIND_LABEL: Record<SpeakerKind, string> = {
  line: 'Модуль линейного массива',
  point: 'Широкополосная (точечный источник)',
  sub: 'Сабвуфер',
};

/** Строка источника данных для карточки расчёта. */
export function sourceLine(m: SpeakerModel): string {
  return m.custom ? `${gearName(m)}: характеристики введены пользователем.` : `${gearName(m)}: данные с официальной страницы ${m.source}`;
}

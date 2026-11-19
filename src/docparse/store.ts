import { db, getSetting, setSetting } from '../core/db';
import type { Category, DictEntry } from './catalog';
import type { Need, Unit } from './parse';

/**
 * Позиция склада. Хранится в хранилище inventory (оно создано заранее для модуля D,
 * поэтому новая версия базы не нужна). Ключ = id позиции словаря.
 */
export interface StockItem {
  id: string;
  kind: 'stock';
  dictId: string;
  name: string;
  cat: Category;
  /** Сколько есть штук (или комплектов). */
  pcs?: number;
  /** Сколько есть кейсов. */
  cases?: number;
  /** Что лежит в кейсе — подсказка для сборки. */
  caseNote?: string;
  /** Фото кейса/прибора (JPEG data URL, уменьшенное). */
  photo?: string;
  updatedAt: number;
}

export async function listStock(): Promise<StockItem[]> {
  const all = (await (await db()).getAll('inventory')) as unknown as StockItem[];
  return all.filter((x) => x.kind === 'stock');
}

export async function getStock(dictId: string): Promise<StockItem | undefined> {
  const x = (await (await db()).get('inventory', dictId)) as unknown as StockItem | undefined;
  return x?.kind === 'stock' ? x : undefined;
}

export async function saveStock(item: Omit<StockItem, 'id' | 'kind' | 'updatedAt'>): Promise<StockItem> {
  const full: StockItem = { ...item, id: item.dictId, kind: 'stock', updatedAt: Date.now() };
  await (await db()).put('inventory', full as unknown as Record<string, unknown> & { id: string });
  return full;
}

export async function deleteStock(dictId: string): Promise<void> {
  await (await db()).delete('inventory', dictId);
}

/* ---------- Пользовательский словарь ---------- */

const DICT_KEY = 'docDict.custom';

export async function getCustomDict(): Promise<DictEntry[]> {
  return (await getSetting<DictEntry[]>(DICT_KEY)) ?? [];
}

export async function setCustomDict(d: DictEntry[]): Promise<void> {
  await setSetting(DICT_KEY, d);
}

/** Добавляет слово к позиции (существующей или новой). */
export async function teach(entry: { id: string; name: string; cat: Category }, alias: string): Promise<void> {
  const d = await getCustomDict();
  const ex = d.find((e) => e.id === entry.id);
  if (ex) {
    if (!ex.aliases.includes(alias)) ex.aliases.push(alias);
  } else d.unshift({ ...entry, aliases: [alias], custom: true });
  await setCustomDict(d);
}

/* ---------- Последний разбор ---------- */

export interface ManualNeed {
  key: string;
  id: string;
  name: string;
  cat: Category;
  unit: Unit;
  qty: number;
}

export interface Analysis {
  fileName: string;
  /** Строки документа (для повторного разбора после «научить»). */
  rows: string[][];
  loadedAt: number;
  /** Правки количества: key → qty. 0 = убрать из списка. */
  overrides: Record<string, number>;
  /** Отмечено «погрузил». */
  packed: Record<string, boolean>;
  manual: ManualNeed[];
}

const LAST_KEY = 'docAnalysis.last';

export async function getLastAnalysis(): Promise<Analysis | null> {
  return (await getSetting<Analysis>(LAST_KEY)) ?? null;
}

export async function saveLastAnalysis(a: Analysis): Promise<void> {
  await setSetting(LAST_KEY, a);
}

/* ---------- Сравнение со складом ---------- */

export type Status = 'ok' | 'short' | 'unknown';

export interface Line extends Need {
  /** Количество после ручной правки. */
  need: number;
  have: number | null;
  shortBy: number;
  status: Status;
  stock?: StockItem;
  manual?: boolean;
}

export function stockQty(s: StockItem | undefined, unit: Unit): number | null {
  if (!s) return null;
  const v = unit === 'кейс' ? s.cases : s.pcs;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function compare(needs: Need[], stock: StockItem[], overrides: Record<string, number>): Line[] {
  const byId = new Map(stock.map((s) => [s.dictId, s]));
  return needs
    .map((n) => {
      const need = overrides[n.key] ?? n.qty;
      const s = byId.get(n.id);
      const have = stockQty(s, n.unit);
      const shortBy = have === null ? 0 : Math.max(0, need - have);
      const status: Status = have === null ? 'unknown' : shortBy > 0 ? 'short' : 'ok';
      return { ...n, need, have, shortBy, status, stock: s };
    })
    .filter((l) => l.need > 0);
}

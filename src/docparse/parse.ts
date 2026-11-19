import { matchDict, type Category, type CompiledEntry, type DictHit } from './catalog';
import type { Row } from './extract';

export type Unit = 'шт' | 'кейс' | 'компл';

/** Одна найденная позиция в строке заявки. */
export interface Found {
  id: string;
  name: string;
  cat: Category;
  qty: number;
  unit: Unit;
  /** Количество указано в тексте (false — подставлена 1). */
  explicit: boolean;
  /** Пометка «запас», «на всякий». */
  reserve: boolean;
  /** Уточнения из скобок и хвостов строки: «(3м – 10 штук, 1м – 15 штук)». */
  details: string[];
  /** Фрагмент, из которого взята позиция. */
  frag: string;
  /** Строка документа целиком. */
  raw: string;
  line: number;
  /** Зал / зона («1 ЗАЛ», «ХОЛЛ»). */
  zone: string;
  /** Раздел («ЗВУК», «СВЕТ»). */
  section: string;
}

export interface ParseResult {
  title: string;
  found: Found[];
  /** Строки без оборудования: заметки, сроки, пожелания. Их можно «научить». */
  notes: { line: number; raw: string; zone: string; section: string }[];
}

const UNIT_RE = /(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?\s*(штук[\p{L}]*|шт\.?|кейс[\p{L}]*|компл[\p{L}]*|к-т|прибор[\p{L}]*)(?![\p{L}])/giu;
const UNIT_REV_RE = /(штук[\p{L}]*|шт\.?)\s*(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?(?![\p{N}])/iu;
const DASH_AFTER_RE = /^\s*[–—=-]\s*(\d{1,4})(?![\p{N}]|[.,]\d)(?!\s*(?:м|m|см|мм|метр[\p{L}]*|"|”|''|а|a|м2|кв)(?![\p{L}\p{N}]))/u;
const NUM_BEFORE_RE = /(?:^|[^\p{L}\p{N}.,*xх×])(\d{1,4})\s*$/u;
const WORDS: Record<string, number> = {
  один: 1, одна: 1, одну: 1, два: 2, две: 2, пара: 2, пару: 2, парочку: 2, парочка: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, десять: 10,
};
const RESERVE_RE = /(запас|на\s+всякий|резерв|малоли)/iu;
const ZONE_RE = /(зал|холл|этаж|зона|площадк|фойе|улиц)/iu;
const SECTION_WORDS = /^(звук|свет|сила|питание|экран[\p{L}]*|видео|сцена|конфа|конференц[\p{L}]*|мебель|опоры|столы|ферм[\p{L}]*|коммутаци[\p{L}]*|led|монтаж|декор)/iu;

function unitOf(word: string): Unit {
  const w = word.toLowerCase();
  if (w.startsWith('кейс')) return 'кейс';
  if (w.startsWith('компл') || w === 'к-т') return 'компл';
  return 'шт';
}

export interface Qty {
  qty: number;
  unit: Unit;
  explicit: boolean;
}

/** Количество для позиции в сегменте. [a, b) — где в сегменте стоит название позиции. */
export function findQty(seg: string, a: number, b: number, taken: [number, number][]): Qty {
  const inTaken = (x: number, y: number) => taken.some(([p, q]) => x < q && y > p);
  // 1) «2 штуки», «8 кейсов», «2 комплекта», «6-8 штук»
  UNIT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UNIT_RE.exec(seg))) {
    if (inTaken(m.index, m.index + m[1].length)) continue;
    const lo = +m[1], hi = m[2] ? +m[2] : 0;
    if (m[2] && hi <= lo) {
      // «Телики 75 – 2 штуки»: это не диапазон, количество — второе число.
      return { qty: hi, unit: unitOf(m[3]), explicit: true };
    }
    const n = Math.max(lo, hi);
    return { qty: n, unit: unitOf(m[3]), explicit: true };
  }
  // 1b) «штук 6-8»
  const rv = UNIT_REV_RE.exec(seg);
  if (rv) return { qty: Math.max(+rv[2], rv[3] ? +rv[3] : 0), unit: 'шт', explicit: true };
  // 2) «RCF 945 – 2»
  const da = DASH_AFTER_RE.exec(seg.slice(b));
  if (da) return { qty: +da[1], unit: 'шт', explicit: true };
  // 3) «8 Тки», «80 ножек», но не «на 40», «10 на 4»
  const before = seg.slice(0, a);
  const nb = NUM_BEFORE_RE.exec(before);
  if (nb) {
    const pre = before.slice(0, before.lastIndexOf(nb[1]));
    if (!/(?:^|[^\p{L}])(?:на|по|[xх×*])\s*$/iu.test(pre)) return { qty: +nb[1], unit: 'шт', explicit: true };
  }
  // 4) словами: «пару», «два»
  const w = /(?<![\p{L}])(один|одна|одну|два|две|пара|пару|парочку|парочка|три|четыре|пять|шесть|семь|восемь|десять)(?![\p{L}])/iu.exec(seg);
  if (w) return { qty: WORDS[w[1].toLowerCase()], unit: 'шт', explicit: true };
  return { qty: 1, unit: 'шт', explicit: false };
}

/** Делит предложение на части по «+» и запятым (кроме десятичных). */
function splitPlus(s: string): string[] {
  return s.split(/\s*\+\s*|,(?!\d)/u).map((x) => x.trim()).filter(Boolean);
}

/** Делит строку на предложения: «;», точка с пробелом (кроме «0.5»), двойной пробел перед заглавной. */
function splitSentences(s: string): string[] {
  return s
    .split(/;|\.(?=\s+[^\s=]|$)|\s{2,}(?=[\p{Lu}])/u)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Вынимает содержимое скобок; возвращает текст без скобок и список уточнений с позициями. */
function takeParens(s: string): { text: string; parens: { at: number; text: string }[] } {
  const parens: { at: number; text: string }[] = [];
  let text = '';
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') {
      if (depth === 0) cur = '';
      else cur += ch;
      depth++;
    } else if (ch === ')' && depth > 0) {
      depth--;
      if (depth === 0) parens.push({ at: text.length, text: cur.trim() });
      else cur += ch;
    } else if (depth > 0) cur += ch;
    else text += ch;
  }
  if (depth > 0 && cur.trim()) parens.push({ at: text.length, text: cur.trim() });
  return { text, parens };
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function mkFound(h: DictHit, q: Qty, seg: string, raw: string, line: number, zone: string, section: string): Found {
  return {
    id: h.entry.id, name: h.entry.name, cat: h.entry.cat, qty: q.qty, unit: q.unit, explicit: q.explicit,
    reserve: RESERVE_RE.test(seg), details: [], frag: seg, raw, line, zone, section,
  };
}

const isUpper = (s: string) => s === s.toUpperCase() && /\p{Lu}/u.test(s);

export function parseRows(rows: Row[], dict: CompiledEntry[]): ParseResult {
  const found: Found[] = [];
  const notes: ParseResult['notes'] = [];
  let title = '';
  let zone = '';
  /** Зал задан отдельной строкой («1 ЗАЛ:») — держится до следующего зала. */
  let zoneSticky = false;
  let section = '';
  /** Позиция словаря, совпадающая с заголовком раздела («Опоры:»), — для строк без названия. */
  let sectionEntry: DictHit | null = null;

  const setHeader = (head: string, inline: boolean) => {
    const isZone = ZONE_RE.test(head);
    const isSection = SECTION_WORDS.test(head) || /(звук|свет|сила|экран|видео)/iu.test(head);
    if (isZone) {
      zone = head;
      zoneSticky = !isSection && !inline;
    } else if (!zoneSticky) zone = '';
    section = head;
    const hh = matchDict(dict, head);
    sectionEntry = hh.length === 1 ? hh[0] : null;
  };

  rows.forEach((row, i) => {
    const line = i + 1;
    // Таблица: последняя чисто числовая ячейка — количество.
    let tableQty: number | null = null;
    let cells = row.filter((c) => c.trim());
    if (cells.length >= 2) {
      for (let k = cells.length - 1; k >= 1; k--) {
        const n = /^\s*(\d{1,4})\s*(шт\.?)?\s*$/iu.exec(cells[k]);
        if (n) {
          tableQty = +n[1];
          cells = cells.filter((_, j) => j !== k);
          break;
        }
      }
      if (/^\s*\d{1,3}\s*[.)]?\s*$/.test(cells[0]) && cells.length > 1) cells = cells.slice(1);
    }
    const raw = clean(row.filter(Boolean).join(' | '));
    let text = clean(cells.join(cells.length > 1 ? '. ' : ''));
    if (!text) return;

    // Строка целиком в скобках — заметка («(я бы взял + 1 ццу …)»).
    if (/^\(/.test(text) && /\)\s*$/.test(text)) {
      notes.push({ line, raw, zone, section });
      return;
    }

    const lineHits = matchDict(dict, text);
    // Первая строка без оборудования — заголовок заявки.
    if (i === 0 && !lineHits.length && !/:\s*$/.test(text)) {
      title = text;
      return;
    }
    if (!title && i === 0) title = text;

    // Заголовок без двоеточия: «СИЛА», «ЗАЛ 2 НА МАСТЕР КЛАСС».
    const noColon = !text.includes(':');
    if (noColon && isUpper(text) && text.split(/\s+/).length <= 6 && !/\d\s*(шт|кейс)/iu.test(text)) {
      const pureSection = SECTION_WORDS.test(text) && text.split(/\s+/).length <= 2;
      if (pureSection || (ZONE_RE.test(text) && !lineHits.length)) {
        setHeader(text.replace(/[.:]+$/, ''), false);
        return;
      }
    }

    // Заголовок раздела: «ЗВУК:», «1 ЗАЛ:», «ЗВУК В ХОЛЛ: 2 колонки + …»
    let inlineZone: string | null = null;
    const hm = /^([^:]{1,45}):\s*(.*)$/u.exec(text);
    if (hm) {
      const head = hm[1].trim();
      const rest = hm[2];
      const words = head.split(/\s+/).length;
      const headerish = words <= 5 && (isUpper(head) || SECTION_WORDS.test(head) || ZONE_RE.test(head));
      const headHits = matchDict(dict, head);
      const firstRest = splitPlus(splitSentences(rest)[0] ?? '')[0] ?? '';
      const restStartsWithItem = matchDict(dict, firstRest).length > 0;
      if (headerish && (!headHits.length || restStartsWithItem || !rest.trim())) {
        if (!rest.trim()) {
          setHeader(head, false);
          return;
        }
        // Заголовок с содержимым в той же строке действует только на эту строку, если это зал.
        if (ZONE_RE.test(head)) inlineZone = head;
        else setHeader(head, true);
        text = rest;
      }
    }
    const lzone = inlineZone ?? zone;

    const { text: body, parens } = takeParens(text);
    const lineFound: Found[] = [];
    let pos = 0;
    const leftovers: string[] = [];

    for (const sentence of splitSentences(body)) {
      for (const group of sentence.split(/,(?!\d)/u).map((x) => x.trim()).filter(Boolean)) {
        const groupFound: Found[] = [];
        for (const seg0 of group.split(/\s*\+\s*/u).map((x) => x.trim()).filter(Boolean)) {
          let seg = seg0;
          const segStart = body.indexOf(seg, pos);
          if (segStart >= 0) pos = segStart + seg.length;
          // «Микшер Qu16 или можно MG16» — берём первый вариант, второй в уточнение.
          let alt = '';
          const orm = /\s+или\s+/iu.exec(seg);
          if (orm && matchDict(dict, seg.slice(0, orm.index)).length) {
            alt = seg.slice(orm.index).trim();
            seg = seg.slice(0, orm.index);
          }
          let hits: DictHit[] = matchDict(dict, seg);
          // Одна и та же позиция дважды в сегменте («Грузы: 15 грузов», «Кликер Micro Cue»).
          const allHits = hits;
          hits = hits.filter((h, k) => hits.findIndex((x) => x.entry.id === h.entry.id) === k);
          const taken = allHits.map((h) => [h.index, h.index + h.length] as [number, number]);
          const prev = groupFound[groupFound.length - 1] ?? lineFound[lineFound.length - 1];
          if (!hits.length) {
            const q = findQty(seg, 0, 0, []);
            const hasUnit = /\d\s*(штук|шт|кейс|компл)/iu.test(seg);
            if (q.explicit && prev && !prev.explicit && (hasUnit || /^\s*[–—=-]?\s*\d/.test(seg))) {
              // «-2 штуки», «= 27 кейсов» отдельно от названия — количество предыдущей позиции.
              Object.assign(prev, { qty: q.qty, unit: q.unit, explicit: true });
              prev.details.push(seg);
            } else if (q.explicit && hasUnit && sectionEntry && !prev) {
              // Раздел «Опоры:», строка «5 штук Ь Знак …» — количество позиции раздела.
              groupFound.push({ ...mkFound(sectionEntry, q, seg, raw, line, lzone, section), details: [seg] });
            } else if (prev) prev.details.push(seg);
            else leftovers.push(seg);
            continue;
          }
          let whole = findQty(seg, hits[0].index, hits[0].index + hits[0].length, taken);
          if (!whole.explicit) {
            // Повтор названия («Грузы: 15 грузов») — количество может стоять у повтора.
            for (const d of allHits.filter((x) => x !== hits[0] && x.entry.id === hits[0].entry.id)) {
              const q = findQty(seg, d.index, d.index + d.length, taken);
              if (q.explicit) {
                whole = q;
                break;
              }
            }
          }
          hits.forEach((h, k) => {
            let q: Qty;
            if (tableQty !== null && hits.length === 1) q = { qty: tableQty, unit: 'шт', explicit: true };
            else if (hits.length === 1) q = whole;
            else {
              const end = k + 1 < hits.length ? hits[k + 1].index : seg.length;
              const start = k > 0 ? hits[k - 1].index + hits[k - 1].length : 0;
              q = findQty(seg.slice(start, end), h.index - start, h.index - start + h.length, taken.map(([x, y]) => [x - start, y - start]));
              // «Тотемы – с юбками 2 штуки»: количество одно на весь сегмент.
              if (!q.explicit && k === 0) q = whole;
            }
            const f = mkFound(h, q, seg, raw, line, lzone, section);
            if (alt) f.details.push(alt);
            groupFound.push(f);
          });
        }
        // «Микшер Qu16 + Stage + UTP – 2 комплекта»: комплект относится ко всей связке.
        const last = groupFound[groupFound.length - 1];
        if (last && last.explicit && last.unit === 'компл') {
          for (const f of groupFound) if (!f.explicit) Object.assign(f, { qty: last.qty, unit: 'компл', explicit: true });
        }
        lineFound.push(...groupFound);
      }
    }

    // «15 на 2 + 4 стола … Итого: 19 столов» — остаётся только итог.
    const totals = lineFound.filter((f) => /(итого|всего)/iu.test(f.frag) && f.explicit);
    const lf = lineFound.filter((f) => !totals.some((t) => t !== f && t.id === f.id));

    // Уточнение по контексту: «стойки» после колонок — под колонки, после микрофонов — микрофонные.
    lf.forEach((f, k) => {
      if (f.id !== 'stand') return;
      const prev = lf.slice(0, k).reverse().find((p) => p.id !== 'stand' && p.id !== 'antenna');
      if (!prev) return;
      if (prev.cat === 'Микрофоны') Object.assign(f, { id: 'stand-mic', name: 'Стойка микрофонная', cat: 'Микрофоны' as Category });
      else if (prev.id === 'tv') Object.assign(f, { id: 'stand-tv', name: 'Стойка под телевизор', cat: 'Видео' as Category });
      else if (prev.id === 'prompter') Object.assign(f, { id: 'stand-prompter', name: 'Стойка под суфлёр', cat: 'Видео' as Category });
      else if (prev.cat === 'Звук') Object.assign(f, { id: 'stand-speaker', name: 'Стойка под колонку', cat: 'Звук' as Category });
    });
    // «Сплиттеры» в разделе СВЕТ — DMX.
    for (const f of lf) {
      if (f.id === 'splitter' && /свет/iu.test(section)) Object.assign(f, { id: 'splitter-dmx', name: 'Сплиттеры DMX', cat: 'Свет' as Category });
    }

    // Скобки — уточнения к ближайшей позиции слева.
    for (const p of parens) {
      let target: Found | undefined;
      for (const f of lf) {
        const at = body.indexOf(f.frag);
        if (at >= 0 && at <= p.at) target = f;
      }
      if (target ?? lf[0]) (target ?? lf[0]).details.push(p.text);
      else leftovers.push(`(${p.text})`);
    }
    for (const f of lf) if (f.details.some((d) => RESERVE_RE.test(d))) f.reserve = true;

    if (!lf.length) notes.push({ line, raw, zone: lzone, section });
    else if (leftovers.length) lf[0].details.unshift(...leftovers);
    found.push(...lf);
  });

  return { title, found, notes };
}

/* ---------- Сводка ---------- */

export interface NeedSource {
  line: number;
  frag: string;
  raw: string;
  zone: string;
  qty: number;
  explicit: boolean;
  details: string[];
}

export interface Need {
  key: string;
  id: string;
  name: string;
  cat: Category;
  unit: Unit;
  qty: number;
  /** Где-то количество не указано — подставлена 1. */
  guessed: boolean;
  reserve: boolean;
  sources: NeedSource[];
}

/**
 * Сводка по позициям. Одна позиция в одном зале, упомянутая и с количеством, и без
 * («Микрофоны + стойки. Стойки микрофонные – 4 штуки»), считается по явному количеству.
 */
export function aggregate(found: Found[]): Need[] {
  const map = new Map<string, Need>();
  const explicitIn = new Set(found.filter((f) => f.explicit).map((f) => `${f.id}|${f.unit}|${f.zone}`));
  for (const f of found) {
    const key = `${f.id}|${f.unit}`;
    const n = map.get(key) ?? { key, id: f.id, name: f.name, cat: f.cat, unit: f.unit, qty: 0, guessed: false, reserve: false, sources: [] };
    const counted = f.explicit || !explicitIn.has(`${f.id}|${f.unit}|${f.zone}`);
    if (counted) n.qty += f.qty;
    if (!f.explicit && counted) n.guessed = true;
    if (f.reserve) n.reserve = true;
    n.sources.push({ line: f.line, frag: f.frag, raw: f.raw, zone: f.zone, qty: counted ? f.qty : 0, explicit: f.explicit, details: f.details });
    map.set(key, n);
  }
  return [...map.values()];
}

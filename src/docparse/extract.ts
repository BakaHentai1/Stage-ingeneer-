import { unzipSync, strFromU8 } from 'fflate';

/**
 * Извлечение текста из документа прямо в браузере, без сервера.
 * Результат: строки документа, каждая строка — массив ячеек.
 * Абзац текста = строка из одной ячейки; строка таблицы = строка из нескольких ячеек.
 */
export type Row = string[];

export interface Extracted {
  rows: Row[];
  /** Формат, который удалось распознать. */
  format: 'docx' | 'doc' | 'xlsx' | 'text';
  /** Замечания о качестве извлечения (например, для старого .doc). */
  notes: string[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

const clean = (s: string) => s.replace(/[   ]/g, ' ').replace(/[ \t]+/g, ' ').trim();

/* ---------------- DOCX ---------------- */

/** Разбор word/document.xml: абзацы и таблицы (включая вложенные — их ячейки склеиваются в ячейку внешней таблицы). */
export function docxXmlToRows(xml: string): Row[] {
  const rows: Row[] = [];
  const tok = /<(\/?)w:(p|tr|tc|tbl|t|tab|br|cr)\b([^>]*?)(\/?)>|([^<]+)/g;
  let inText = false;
  let para = '';
  let tblDepth = 0;
  let cell: string[] | null = null; // абзацы текущей ячейки верхнего уровня
  let row: string[] | null = null;
  let m: RegExpExecArray | null;
  const endPara = () => {
    const t = clean(para);
    para = '';
    if (!t) return;
    if (tblDepth > 0 && cell) cell.push(t);
    else rows.push([t]);
  };
  while ((m = tok.exec(xml))) {
    if (m[5] !== undefined) {
      if (inText) para += decodeEntities(m[5]);
      continue;
    }
    const close = m[1] === '/';
    const selfClose = m[4] === '/';
    const tag = m[2];
    switch (tag) {
      case 't':
        if (selfClose) break;
        inText = !close;
        break;
      case 'tab':
        para += '\t';
        break;
      case 'br':
      case 'cr':
        para += '; ';
        break;
      case 'p':
        if (close || selfClose) endPara();
        break;
      case 'tbl':
        if (selfClose) break;
        tblDepth += close ? -1 : 1;
        break;
      case 'tr':
        if (tblDepth !== 1 || selfClose) break;
        if (!close) row = [];
        else if (row) {
          if (row.some((c) => c)) rows.push(row);
          row = null;
        }
        break;
      case 'tc':
        if (tblDepth !== 1 || selfClose) break;
        if (!close) cell = [];
        else if (cell && row) {
          row.push(cell.join('; '));
          cell = null;
        }
        break;
    }
  }
  return rows;
}

/* ---------------- XLSX ---------------- */

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function xlsxToRows(files: Record<string, Uint8Array>): Row[] {
  const shared: string[] = [];
  const ss = files['xl/sharedStrings.xml'];
  if (ss) {
    const x = strFromU8(ss);
    for (const si of x.match(/<si\b[\s\S]*?<\/si>/g) ?? []) {
      const parts = [...si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decodeEntities(t[1]));
      shared.push(parts.join(''));
    }
  }
  const sheets = Object.keys(files)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10));
  const rows: Row[] = [];
  for (const name of sheets) {
    const x = strFromU8(files[name]);
    for (const rm of x.match(/<row\b[\s\S]*?<\/row>/g) ?? []) {
      const row: string[] = [];
      for (const cm of rm.matchAll(/<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const body = cm[3] ?? '';
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
        const t = /\bt="(\w+)"/.exec(attrs)?.[1];
        let v = '';
        if (t === 's') v = shared[parseInt(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '-1', 10)] ?? '';
        else if (t === 'inlineStr') v = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((q) => decodeEntities(q[1])).join('');
        else v = decodeEntities(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '');
        const i = ref ? colIndex(ref) : row.length;
        while (row.length < i) row.push('');
        row[i] = clean(v);
      }
      if (row.some((c) => c)) rows.push(row);
    }
  }
  return rows;
}

/* ---------------- Старый .doc (Word 97–2003) ---------------- */

/**
 * Упрощённое извлечение текста из .doc без полного разбора формата:
 * ищем длинные фрагменты текста в UTF-16LE и в cp1251, берём вариант с бо́льшим числом букв.
 * Word отмечает конец абзаца символом \r, конец ячейки таблицы — \x07.
 */
export function docBinaryToRows(buf: Uint8Array): Row[] {
  const u16 = decodeRuns(new TextDecoder('utf-16le').decode(buf.byteLength % 2 ? buf.subarray(0, buf.byteLength - 1) : buf));
  let cp = '';
  try {
    cp = decodeRuns(new TextDecoder('windows-1251').decode(buf));
  } catch {
    /* декодер cp1251 недоступен */
  }
  const letters = (s: string) => (s.match(/[А-Яа-яЁёA-Za-z]/g) ?? []).length;
  const text = letters(cp) > letters(u16) * 1.3 ? cp : u16;
  const rows: Row[] = [];
  let row: string[] = [];
  for (const para of text.split('\r')) {
    if (para.includes('\x07')) {
      const parts = para.split('\x07');
      parts.slice(0, -1).forEach((p) => row.push(clean(p)));
      // Двойной \x07 (пустая последняя часть) — конец строки таблицы.
      const last = clean(parts[parts.length - 1]);
      if (parts.length >= 2 && parts[parts.length - 1] === '' && row.length) {
        if (row.some((c) => c)) rows.push(row.filter((c, i) => c || i < row.length - 1));
        row = [];
      } else if (last) row.push(last);
    } else {
      if (row.length) {
        if (row.some((c) => c)) rows.push(row);
        row = [];
      }
      const t = clean(para);
      if (t) rows.push([t]);
    }
  }
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

/** Оставляет только участки из «нормальных» символов длиной от 4. */
function decodeRuns(s: string): string {
  const ok = /[ -~ -ÿЀ-ӿ‐-…№\r\x07\t]/;
  let out = '';
  let run = '';
  const flush = () => {
    if (run.replace(/[\r\x07\s]/g, '').length >= 4 && /[\p{L}]{2}/u.test(run)) out += run;
    else if (/[\r\x07]/.test(run)) out += run.replace(/[^\r\x07]/g, '');
    run = '';
  };
  for (const ch of s) {
    if (ok.test(ch)) run += ch;
    else flush();
  }
  flush();
  return out;
}

/* ---------------- Текст / CSV ---------------- */

export function textToRows(text: string): Row[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  return lines
    .map((l) => {
      if (l.includes('\t')) return l.split('\t').map(clean);
      if ((l.match(/;/g) ?? []).length >= 2) return l.split(';').map((c) => clean(c.replace(/^"|"$/g, '')));
      return [clean(l)];
    })
    .filter((r) => r.some((c) => c));
}

/* ---------------- Точка входа ---------------- */

export async function extractFile(file: File): Promise<Extracted> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return extractBytes(file.name, buf);
}

export function extractBytes(name: string, buf: Uint8Array): Extracted {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  const isCfb = buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  if (isZip) {
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(buf, { filter: (f) => f.name.startsWith('word/document') || f.name.startsWith('xl/') });
    } catch {
      throw new Error('Файл повреждён или это не документ Word/Excel.');
    }
    if (files['word/document.xml']) return { rows: docxXmlToRows(strFromU8(files['word/document.xml'])), format: 'docx', notes: [] };
    if (Object.keys(files).some((k) => k.startsWith('xl/worksheets/'))) return { rows: xlsxToRows(files), format: 'xlsx', notes: [] };
    throw new Error('Внутри архива нет документа Word или таблицы Excel.');
  }
  if (isCfb) {
    if (ext === 'xls') throw new Error('Старый формат Excel (.xls) не поддерживается. Откройте файл и сохраните как .xlsx.');
    return {
      rows: docBinaryToRows(buf),
      format: 'doc',
      notes: ['Старый формат Word (.doc) читается упрощённо: проверьте результат. Надёжнее пересохранить файл как .docx.'],
    };
  }
  if (ext === 'pdf' || (buf[0] === 0x25 && buf[1] === 0x50)) throw new Error('PDF пока не поддерживается. Пришлите документ в Word (.docx) или скопируйте текст.');
  if (/^(jpe?g|png|heic|webp)$/.test(ext)) throw new Error('Фото пока не распознаются. Пришлите документ в Word (.docx) или скопируйте текст.');
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) {
    try {
      text = new TextDecoder('windows-1251').decode(buf);
    } catch {
      /* оставляем utf-8 */
    }
  }
  if (/^\{\\rtf/.test(text)) throw new Error('Формат RTF пока не поддерживается. Пересохраните файл как .docx.');
  return { rows: textToRows(text), format: 'text', notes: [] };
}

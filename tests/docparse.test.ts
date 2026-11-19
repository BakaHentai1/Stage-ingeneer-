import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { BASE_DICT, aliasToRegExp, compileDict, matchDict, mergeDict } from '../src/docparse/catalog';
import { docxXmlToRows, extractBytes, textToRows } from '../src/docparse/extract';
import { aggregate, parseRows } from '../src/docparse/parse';
import { compare, type StockItem } from '../src/docparse/store';
import { guessAlias } from '../src/screens/Request';

const dict = compileDict(BASE_DICT);
const parse = (text: string) => parseRows(textToRows(text), dict);
const need = (text: string, id: string, unit = 'шт') => aggregate(parse(text).found).find((n) => n.id === id && n.unit === unit);

describe('словарь', () => {
  it('alias: пробел/дефис между буквами и цифрами необязателен', () => {
    const re = aliasToRegExp('qu16');
    for (const s of ['Qu16', 'qu-16', 'QU 16']) expect(s.match(re)).not.toBeNull();
    expect('Qu160'.match(aliasToRegExp('qu16'))).toBeNull();
  });
  it('alias: * — любое окончание, кириллица без ложных совпадений внутри слов', () => {
    const re = aliasToRegExp('стойк*');
    expect('Стойки микрофонные'.match(re)).not.toBeNull();
    expect('отстойка'.match(aliasToRegExp('стойк*'))).toBeNull();
  });
  it('длинное совпадение важнее короткого', () => {
    const h = matchDict(dict, 'Микрофон на спич трибуну');
    expect(h).toHaveLength(1);
    expect(h[0].entry.id).toBe('mic-speech');
  });
  it('пользовательское слово побеждает общее', () => {
    const d = compileDict(mergeDict([{ id: 'light-tki', name: 'Тки', cat: 'Свет', aliases: ['тк'] }, { id: 'u-1', name: 'Капы силовые', cat: 'Питание', aliases: ['капы'] }]));
    expect(matchDict(d, 'Капы')[0].entry.id).toBe('u-1');
    expect(matchDict(d, 'ТК')[0].entry.id).toBe('light-tki');
  });
});

describe('количество', () => {
  it('«– 2 штуки», «8 кейсов», «8 Тки», «80 ножек на 40»', () => {
    expect(need('ЗВУК:\nRCF 945 – 2 штуки', 'rcf-945')?.qty).toBe(2);
    expect(need('СВЕТ:\nMax Wash – 8 кейсов', 'light-maxwash', 'кейс')?.qty).toBe(8);
    expect(need('СВЕТ:\n8 Тки.', 'light-tki')?.qty).toBe(8);
    expect(need('СЦЕНА:\n80 ножек на 40, 4 ножки на 20.', 'stage-legs')?.qty).toBe(84);
  });
  it('размер перед количеством: «Телики 75 – 2 штуки», «10 на 3м = 15 столов»', () => {
    expect(need('ВИДЕО:\nТелики 75 – 2 штуки', 'tv')?.qty).toBe(2);
    expect(need('СЦЕНА:\n10 на 3м = 15 столов.', 'stage-deck')?.qty).toBe(15);
  });
  it('модель с цифрами не путается с количеством: «Микшер Qu16», «Sub 8003 – 2 штуки»', () => {
    const r = parse('ЗВУК:\nМикшер Qu16. Sub 8003 – 2 штуки');
    const qu = r.found.find((f) => f.id === 'mixer-qu16')!;
    expect(qu.qty).toBe(1);
    expect(qu.explicit).toBe(false);
    expect(r.found.find((f) => f.id === 'rcf-sub-8003')!.qty).toBe(2);
  });
  it('количество отдельно от названия: «Прострелы 915  -2 штуки», «= 27 кейсов»', () => {
    expect(need('ЗВУК:\nПрострелы 915  -2 штуки', 'rcf-915')?.qty).toBe(2);
    expect(need('Экраны:\nAbsen 10 на 4м = 40м2. = 27 кейсов.', 'led-absen', 'кейс')?.qty).toBe(27);
  });
  it('диапазон «штук 6-8» → берём больше', () => {
    expect(need('СИЛА:\nсерые штук 6-8', 'power-grey')?.qty).toBe(8);
  });
  it('словами: «Капы парочку»', () => {
    expect(need('СИЛА:\nКапы парочку', 'power-kapy')?.qty).toBe(2);
  });
  it('«Итого» заменяет промежуточные числа', () => {
    expect(need('СЦЕНА:\n15 на 2 + 4 стола чтобы расширить. Итого: 19 столов.', 'stage-deck')?.qty).toBe(19);
  });
  it('комплект относится ко всей связке через «+»', () => {
    const r = parse('ЗВУК:\nМикшер Qu16 + Stage + UTP - 2 комплекта.');
    for (const id of ['mixer-qu16', 'stagebox', 'cable-utp']) {
      const f = r.found.find((x) => x.id === id)!;
      expect(f.qty).toBe(2);
      expect(f.unit).toBe('компл');
    }
  });
  it('«32 чабанки» — это ток, а не 32 штуки', () => {
    expect(need('Сила 63, 32 чабанки.', 'power-chabanka')?.qty).toBe(1);
  });
});

describe('контекст', () => {
  it('«стойки» после колонок — под колонки, после микрофонов — микрофонные', () => {
    const r = parse('ЗВУК:\nRCF 9155 – 2 штуки , стойки – 2 штуки.\nМикрофоны 4 штуки + Антенны + стойки.');
    expect(r.found.find((f) => f.line === 2 && f.cat === 'Звук' && f.id.startsWith('stand'))!.id).toBe('stand-speaker');
    expect(r.found.find((f) => f.line === 3 && f.id.startsWith('stand'))!.id).toBe('stand-mic');
  });
  it('сплиттеры в разделе СВЕТ — DMX', () => {
    expect(parse('СВЕТ:\nСплиттеры + Крыло в сборе.').found[0].id).toBe('splitter-dmx');
  });
  it('«или»: берём первый вариант, второй — в уточнение', () => {
    const r = parse('ЗВУК:\nМикшер Qu16 или можно MG16');
    expect(r.found.map((f) => f.id)).toEqual(['mixer-qu16']);
    expect(r.found[0].details.join()).toMatch(/MG16/);
  });
  it('залы: одинаковое оборудование суммируется по всем залам', () => {
    const text = 'Заявка на показ\n1 ЗАЛ:\nЗВУК:\nRCF 9155 – 2 штуки\n2 ЗАЛ:\nЗВУК:\nRCF 9155 – 2 штуки\nЗВУК В ХОЛЛ: 1 колонка – 1 стойка';
    const r = parse(text);
    expect(r.title).toBe('Заявка на показ');
    const n = aggregate(r.found).find((x) => x.id === 'rcf-9155')!;
    expect(n.qty).toBe(4);
    expect(n.sources.map((s) => s.zone)).toEqual(['1 ЗАЛ', '2 ЗАЛ']);
    expect(r.found.find((f) => f.id === 'speaker')!.zone).toBe('ЗВУК В ХОЛЛ');
  });
  it('упоминание без количества не удваивает явное в том же зале', () => {
    expect(need('ЗВУК:\nМикрофоны 4 штуки + стойки.  Стойки микрофонные – 4 штуки.', 'stand-mic')?.qty).toBe(4);
  });
  it('скобки — уточнения, а не отдельные позиции', () => {
    const r = parse('ЭКРАНЫ:\nТелевизоры: 9 штук – 43” (4 на суфлеры, 5 на выставку).');
    expect(r.found.map((f) => f.id)).toEqual(['tv']);
    expect(r.found[0].qty).toBe(9);
    expect(r.found[0].details[0]).toMatch(/суфлеры/);
  });
  it('строки без техники попадают в заметки', () => {
    const r = parse('Заявка\nЭто конфа.\nСЦЕНА БУДЕТ МЕСТНАЯ');
    expect(r.notes.map((n) => n.raw)).toEqual(['Это конфа.', 'СЦЕНА БУДЕТ МЕСТНАЯ']);
  });
});

describe('извлечение текста', () => {
  it('docx: абзацы и таблица', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>ЗВУК:</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">RCF 945 – </w:t></w:r><w:r><w:t>2 штуки &amp; стойки</w:t></w:r></w:p>' +
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Наименование</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Кол-во</w:t></w:r></w:p></w:tc></w:tr>' +
      '<w:tr><w:tc><w:p><w:r><w:t>Max Wash</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>6</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
    expect(docxXmlToRows(xml)).toEqual([['ЗВУК:'], ['RCF 945 – 2 штуки & стойки'], ['Наименование', 'Кол-во'], ['Max Wash', '6']]);
  });
  it('docx целиком из zip и количество из столбца таблицы', () => {
    const xml = '<w:document><w:body><w:p><w:r><w:t>СВЕТ:</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Max Wash</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>6</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
    const zip = zipSync({ 'word/document.xml': strToU8(xml), '[Content_Types].xml': strToU8('<Types/>') });
    const ex = extractBytes('заявка.docx', zip);
    expect(ex.format).toBe('docx');
    const n = aggregate(parseRows(ex.rows, dict).found).find((x) => x.id === 'light-maxwash')!;
    expect(n.qty).toBe(6);
  });
  it('PDF и фото — понятная ошибка', () => {
    expect(() => extractBytes('a.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toThrow(/PDF/);
    expect(() => extractBytes('a.jpg', new Uint8Array([0xff, 0xd8, 0xff]))).toThrow(/Фото/);
  });
  it('старый .doc: текст в UTF-16 с разметкой абзацев', () => {
    const body = 'ЗВУК:\rRCF 945 – 2 штуки\r';
    const u16 = new Uint8Array(body.length * 2);
    for (let i = 0; i < body.length; i++) {
      u16[i * 2] = body.charCodeAt(i) & 0xff;
      u16[i * 2 + 1] = body.charCodeAt(i) >> 8;
    }
    const buf = new Uint8Array(8 + u16.length + 4);
    buf.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    buf.set(u16, 8);
    const ex = extractBytes('a.doc', buf);
    expect(ex.format).toBe('doc');
    expect(ex.rows.map((r) => r.join('|'))).toContain('RCF 945 – 2 штуки');
  });
});

describe('сравнение со складом', () => {
  const stock: StockItem[] = [
    { id: 'light-maxwash', kind: 'stock', dictId: 'light-maxwash', name: 'Max Wash', cat: 'Свет', cases: 6, updatedAt: 0 },
    { id: 'rcf-945', kind: 'stock', dictId: 'rcf-945', name: 'RCF 945', cat: 'Звук', pcs: 4, updatedAt: 0 },
  ];
  it('хватает / не хватает / склад не указан', () => {
    const needs = aggregate(parse('СВЕТ:\nMax Wash – 8 кейсов\nЗВУК:\nRCF 945 – 2 штуки. Микшер Qu16').found);
    const lines = compare(needs, stock, {});
    const by = (id: string) => lines.find((l) => l.id === id)!;
    expect(by('light-maxwash')).toMatchObject({ need: 8, have: 6, shortBy: 2, status: 'short' });
    expect(by('rcf-945')).toMatchObject({ need: 2, have: 4, shortBy: 0, status: 'ok' });
    expect(by('mixer-qu16')).toMatchObject({ have: null, status: 'unknown' });
  });
  it('ручная правка количества и удаление (0)', () => {
    const needs = aggregate(parse('СВЕТ:\nMax Wash – 8 кейсов\nТки – 8 штук').found);
    const key = needs.find((n) => n.id === 'light-maxwash')!.key;
    const tki = needs.find((n) => n.id === 'light-tki')!.key;
    const lines = compare(needs, stock, { [key]: 5, [tki]: 0 });
    expect(lines.map((l) => l.id)).toEqual(['light-maxwash']);
    expect(lines[0].status).toBe('ok');
  });
});

describe('обучение', () => {
  it('заготовка слова без чисел и единиц', () => {
    expect(guessAlias('Железные 4.')).toBe('железные');
    expect(guessAlias('Ворки обычные – 4 штуки')).toBe('ворки обычные');
  });
});

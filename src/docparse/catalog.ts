/**
 * Словарь оборудования для разбора заявок начальника.
 * Записан «словами», как пишут в заявках: alias «max wash», «тки», «стойк*».
 *
 * Синтаксис alias:
 *  - регистр не важен; пробел или дефис между словами необязателен («qu16» = «Qu-16» = «qu 16»);
 *  - «*» в конце слова — любое окончание («стойк*» = стойка, стойки, стоек…);
 *  - строка, начинающаяся с «/», — регулярное выражение как есть.
 *
 * Порядок важен: более конкретные позиции стоят раньше общих
 * («пульт mq70» раньше «пульт*», «микрофон на спич*» раньше «микрофон*»).
 */

export type Category =
  | 'Звук'
  | 'Микрофоны'
  | 'Пульты'
  | 'Свет'
  | 'Экраны'
  | 'Видео'
  | 'Конференц'
  | 'Конструкции'
  | 'Сцена'
  | 'Питание'
  | 'Коммутация'
  | 'Мебель'
  | 'Прочее';

export const CATEGORIES: Category[] = [
  'Звук', 'Микрофоны', 'Пульты', 'Свет', 'Экраны', 'Видео', 'Конференц', 'Конструкции', 'Сцена', 'Питание', 'Коммутация', 'Мебель', 'Прочее',
];

export interface DictEntry {
  id: string;
  name: string;
  cat: Category;
  aliases: string[];
  /** Добавлено пользователем («научить»). */
  custom?: boolean;
}

export const BASE_DICT: DictEntry[] = [
  // ---------- Звук: акустика ----------
  { id: 'rcf-top-any', name: 'RCF топ 912/915/945 (любые)', cat: 'Звук', aliases: ['/rcf\\s*9\\d{2,3}a?(?:\\s*\\/\\s*9\\d{2,3}a?)+/'] },
  { id: 'rcf-9155', name: 'RCF 9155', cat: 'Звук', aliases: ['rcf 9155*', '9155'] },
  { id: 'rcf-945', name: 'RCF 945', cat: 'Звук', aliases: ['rcf 945*', '945a'] },
  { id: 'rcf-915', name: 'RCF 915', cat: 'Звук', aliases: ['rcf 915*', 'прострел* 915', '915a'] },
  { id: 'rcf-912', name: 'RCF 912', cat: 'Звук', aliases: ['rcf 912*', '912a'] },
  { id: 'rcf-sub-8003', name: 'Сабвуфер RCF 8003', cat: 'Звук', aliases: ['sub* 8003*', 'саб* 8003*', 'rcf 8003*', '8003*'] },
  { id: 'ev-zlx12p', name: 'Монитор EV ZLX-12P', cat: 'Звук', aliases: ['монитор* zlx 12*', 'zlx 12*', 'zlx*'] },
  { id: 'monitor-db', name: 'Мониторы dB Technologies', cat: 'Звук', aliases: ['монитор* db*', 'db technologies'] },
  { id: 'sub', name: 'Сабвуфер', cat: 'Звук', aliases: ['сабвуфер*', 'саб', 'сабы', 'сабов', 'sub', 'subs'] },
  { id: 'fill', name: 'Прострел (фронт-фил)', cat: 'Звук', aliases: ['прострел*', 'front fill*', 'фронтфил*'] },
  { id: 'monitor', name: 'Сценический монитор', cat: 'Звук', aliases: ['монитор*', 'wedge*'] },
  { id: 'speaker', name: 'Колонка (модель не указана)', cat: 'Звук', aliases: ['колонк*', 'колнк*', 'акустик*', 'ас', 'портал*'] },

  // ---------- Стойки ----------
  { id: 'stand-transition', name: 'Переходная стойка (саб–топ)', cat: 'Звук', aliases: ['переходн* стойк*', 'переходн* стоек', 'штанг*'] },
  { id: 'stand-speaker', name: 'Стойка под колонку', cat: 'Звук', aliases: ['стойк* под колонк*', 'стойк* под колнк*', 'стойк* под ас', 'стойк* для колонок'] },
  { id: 'stand-mic', name: 'Стойка микрофонная', cat: 'Микрофоны', aliases: ['стойк* микрофонн*', 'микрофонн* стойк*', 'стойк* под микрофон*', 'журавл*'] },
  { id: 'stand-prompter', name: 'Стойка под суфлёр', cat: 'Видео', aliases: ['стойк* суфлер*', 'стойк* суфлёр*', 'лежач* стойк*', 'стойк* под суфлер*'] },
  { id: 'stand-tv', name: 'Стойка под телевизор', cat: 'Видео', aliases: ['стойк* под тв', 'стойк* под телевизор*', 'стойк* под телик*', 'на стойках'] },
  { id: 'stand', name: 'Стойки (уточнить: под колонки или микрофонные)', cat: 'Звук', aliases: ['стойк*', 'стоек'] },

  // ---------- Пульты ----------
  { id: 'light-mq70', name: 'Световой пульт ChamSys MQ70', cat: 'Свет', aliases: ['пульт* mq 70', 'пуль mq 70', 'mq 70'] },
  { id: 'interp-console', name: 'Пульт переводчика', cat: 'Конференц', aliases: ['пульт* переводчик*'] },
  { id: 'mixer-qu16', name: 'Микшер Allen & Heath Qu-16', cat: 'Пульты', aliases: ['микшер* qu 16', 'qu 16'] },
  { id: 'mixer-qu24', name: 'Микшер Allen & Heath Qu-24', cat: 'Пульты', aliases: ['микшер* qu 24', 'qu 24'] },
  { id: 'mixer-mg16', name: 'Микшер Yamaha MG16', cat: 'Пульты', aliases: ['микшер* mg 16', 'mg 16*'] },
  { id: 'mixer-mg10', name: 'Микшер Yamaha MG10', cat: 'Пульты', aliases: ['микшер* mg 10', 'mg 10*'] },
  { id: 'mixer-dj', name: 'Микшер для DJ', cat: 'Пульты', aliases: ['микшер* для dj', 'микшер* для диджея', 'dj микшер*', 'диджейск* микшер*', 'dj пульт*'] },
  { id: 'stagebox', name: 'Стейджбокс', cat: 'Пульты', aliases: ['stage box*', 'stagebox*', 'stage', 'стейдж*', 'стейдж бокс*'] },
  { id: 'mixer', name: 'Микшер (модель не указана)', cat: 'Пульты', aliases: ['микшер*', 'микшерн* пульт*', 'звуков* пульт*'] },

  // ---------- Микрофоны ----------
  { id: 'mic-speech', name: 'Микрофон на трибуну (гусиная шея)', cat: 'Микрофоны', aliases: ['микрофон* на спич* трибун*', 'микрофон* на спич*', 'микрофон* на трибун*', 'гусин* ше*'] },
  { id: 'mic-slxd', name: 'Радиомикрофон Shure SLXD', cat: 'Микрофоны', aliases: ['микрофон* slxd', 'slxd', 'slx d', 'slx'] },
  { id: 'mic-blx', name: 'Радиомикрофон Shure BLX', cat: 'Микрофоны', aliases: ['микрофон* blx', 'blx'] },
  { id: 'mic-shure', name: 'Радиомикрофоны Shure (модель не указана)', cat: 'Микрофоны', aliases: ['микрофон* shure', 'shure'] },
  { id: 'antenna', name: 'Антенны для радиосистем', cat: 'Микрофоны', aliases: ['антенн*'] },
  { id: 'di-box', name: 'DI-бокс', cat: 'Микрофоны', aliases: ['di box*', 'di бокс*', 'ди бокс*', 'di'] },
  { id: 'mic-case', name: 'Микрофоны (кейс)', cat: 'Микрофоны', aliases: ['микрофон* 1 кейс', 'мкрофон*'] },
  { id: 'mic', name: 'Микрофоны (тип не указан)', cat: 'Микрофоны', aliases: ['микрофон*', 'радиомикрофон*', 'радик*'] },
  { id: 'sound-card', name: 'Звуковая карта', cat: 'Звук', aliases: ['звуков* карт*', 'аудиокарт*'] },

  // ---------- Свет ----------
  { id: 'light-tki', name: 'Тки (Т-образные стойки для света)', cat: 'Свет', aliases: ['тки', 'тка', 'т образн* стойк*'] },
  { id: 'light-totem', name: 'Тотемы', cat: 'Свет', aliases: ['тотем*'] },
  { id: 'light-maxwash', name: 'Max Wash', cat: 'Свет', aliases: ['max wash*', 'макс вош*', 'maxwash'] },
  { id: 'light-aura', name: 'Wash Aura', cat: 'Свет', aliases: ['wash aura', 'aura', 'аура'] },
  { id: 'light-beam', name: 'Beam', cat: 'Свет', aliases: ['beam*', 'бим*'] },
  { id: 'light-spot', name: 'Spot', cat: 'Свет', aliases: ['spot*', 'спот*'] },
  { id: 'light-strobe', name: 'Стробоскоп', cat: 'Свет', aliases: ['строб*', 'strobe*'] },
  { id: 'light-geyser', name: 'Гейзеры (генераторы дыма)', cat: 'Свет', aliases: ['гейзер*'] },
  { id: 'light-hazer', name: 'Хейзер', cat: 'Свет', aliases: ['хайзер*', 'хейзер*', 'hazer*', 'дым машин*', 'генератор* дыма'] },
  { id: 'light-videolight', name: 'Видеосвет', cat: 'Свет', aliases: ['видео свет*', 'видеосвет*'] },
  { id: 'light-par', name: 'PAR (пары)', cat: 'Свет', aliases: ['пары', 'пар', 'par*', 'led par*'] },
  { id: 'light-pixelbar', name: 'Пиксельные палки', cat: 'Свет', aliases: ['палк* пиксельн*', 'пиксельн* палк*', 'pixel bar*'] },
  { id: 'light-wing', name: 'Крыло (wing) для светового пульта', cat: 'Свет', aliases: ['крыло*', 'wing'] },
  { id: 'light-artgate', name: 'Арт-Гейт (Art-Net шлюз)', cat: 'Свет', aliases: ['арт гейт*', 'art gate*', 'artgate'] },
  { id: 'light-laptop', name: 'Ноутбук световой', cat: 'Свет', aliases: ['ноут* светов*', 'светов* ноут*'] },
  { id: 'light-console', name: 'Световой пульт', cat: 'Свет', aliases: ['светов* пульт*'] },

  // ---------- Экраны и видео ----------
  { id: 'led-p29', name: 'LED-экран P2.9 (кейсы)', cat: 'Экраны', aliases: ['/[pр]\\s*2[.,]9/'] },
  { id: 'led-absen', name: 'LED-экран Absen (кейсы)', cat: 'Экраны', aliases: ['absen*', 'абсен*'] },
  { id: 'led-corner', name: 'LED угловые кейсы', cat: 'Экраны', aliases: ['угловы*'] },
  { id: 'led-half', name: 'LED кабинеты 0.5', cat: 'Экраны', aliases: ['0.5 кабинет*', '0,5 кабинет*'] },
  { id: 'led-cookies', name: 'Печеньки (LED)', cat: 'Экраны', aliases: ['печеньк*'] },
  { id: 'led-vx1000', name: 'Видеопроцессор Novastar VX1000', cat: 'Экраны', aliases: ['карт* vx 1000', 'vx 1000'] },
  { id: 'led-mctrl4k', name: 'Novastar MCTRL4K', cat: 'Экраны', aliases: ['карт* mctrl 4k', 'mctrl 4k', 'mctrl*'] },
  { id: 'led-card', name: 'Карты (отправляющие для экрана)', cat: 'Экраны', aliases: ['карт*'] },
  { id: 'cvt', name: 'CVT (оптический конвертер)', cat: 'Экраны', aliases: ['cvt*'] },
  { id: 'fiber', name: 'Оптика (fiber)', cat: 'Экраны', aliases: ['fiber*', 'файбер*', 'оптик*'] },
  { id: 'media-server', name: 'Медиасервер', cat: 'Видео', aliases: ['медиа сервер*', 'медиасервер*', 'мини сервер*', 'сервак*', 'сервер*'] },
  { id: 'clicker', name: 'Кликер', cat: 'Видео', aliases: ['кликер*', 'micro cue*', 'clicker*'] },
  { id: 'prompter', name: 'Суфлёр', cat: 'Видео', aliases: ['суфлер*', 'суфлёр*'] },
  { id: 'tv', name: 'Телевизор', cat: 'Видео', aliases: ['телевизор*', 'телик*', 'тв', 'плазм*'] },
  { id: 'tv-bracket', name: 'Кронштейн для ТВ', cat: 'Видео', aliases: ['кронштейн*'] },
  { id: 'hdmi', name: 'HDMI-кабели', cat: 'Коммутация', aliases: ['hdmi*'] },
  { id: 'converter', name: 'Конвертеры', cat: 'Видео', aliases: ['конвертер*', 'converter*'] },
  { id: 'laptop', name: 'Ноутбук', cat: 'Видео', aliases: ['ноутбук*', 'ноут*', 'laptop*'] },

  // ---------- Конференц-система ----------
  { id: 'conf-ccu', name: 'CCU (центральный блок)', cat: 'Конференц', aliases: ['ccu', 'ццу'] },
  { id: 'conf-trans', name: 'Передатчик (Trans)', cat: 'Конференц', aliases: ['trans*', 'транс', 'трансмиттер*'] },
  { id: 'conf-expander', name: 'Экспандер', cat: 'Конференц', aliases: ['экспандер*', 'expander*'] },
  { id: 'conf-radiator', name: 'ИК-излучатели', cat: 'Конференц', aliases: ['излучател*'] },
  { id: 'conf-ir', name: 'ИК-приёмники с наушниками', cat: 'Конференц', aliases: ['ик с ушами', 'ик приемник*', 'ик приёмник*', 'ик'] },
  { id: 'conf-booth', name: 'Кабина переводчика', cat: 'Конференц', aliases: ['кабин*'] },
  { id: 'conf-stand', name: 'Подставка для переводчика', cat: 'Конференц', aliases: ['подставк* для переводчик*', 'подставк*'] },

  // ---------- Конструкции ----------
  { id: 'truss-q40', name: 'Ферма Q40', cat: 'Конструкции', aliases: ['ферм* q 40', 'q 40'] },
  { id: 'truss', name: 'Ферма', cat: 'Конструкции', aliases: ['ферм*'] },
  { id: 'spigot', name: 'Бобышки (соединители фермы)', cat: 'Конструкции', aliases: ['бобышк*'] },
  { id: 'hoist-heavy', name: 'Ворки тяжёлые (подъёмники Work LW)', cat: 'Конструкции', aliases: ['ворк* тяжел*', 'ворк* тяжёл*'] },
  { id: 'hoist', name: 'Ворки (подъёмники Work LW)', cat: 'Конструкции', aliases: ['ворк*', 'work lw*', 'подъемник* work*', 'подъёмник* work*'] },
  { id: 'clamp', name: 'Наручники (струбцины)', cat: 'Конструкции', aliases: ['наручник*', 'наручнк*', 'струбцин*', 'clamp*'] },
  { id: 'led-support', name: 'Опоры экрана', cat: 'Конструкции', aliases: ['опор*'] },
  { id: 'weight', name: 'Грузы', cat: 'Конструкции', aliases: ['груз*'] },
  { id: 'bolts', name: 'Болты', cat: 'Конструкции', aliases: ['болт*'] },
  { id: 'tie', name: 'Вязалка', cat: 'Конструкции', aliases: ['вязалк*'] },
  { id: 'screen-drape', name: 'Ширмы', cat: 'Конструкции', aliases: ['ширм*'] },

  // ---------- Сцена ----------
  { id: 'stage-deck', name: 'Столы сцены (подиум)', cat: 'Сцена', aliases: ['стол*'] },
  { id: 'stage-legs', name: 'Ножки для столов', cat: 'Сцена', aliases: ['ножк*', 'ножек', 'ножки'] },
  { id: 'carpet', name: 'Ковролин', cat: 'Сцена', aliases: ['ковролин*', 'корволин*', 'ковралин*'] },
  { id: 'skirt', name: 'Юбки', cat: 'Сцена', aliases: ['юбк*', 'юбок'] },

  // ---------- Питание ----------
  { id: 'power-chabanka', name: 'Чабанка (силовой дистрибьютор)', cat: 'Питание', aliases: ['/(?:(?:16|32|63|125)\\s*[аa]?\\s*)?чабанк[\\p{L}]*(?:\\s*(?:16|32|63|125)\\s*[аa](?![\\p{L}]))?/'] },
  { id: 'power-32a', name: 'Силовой ввод 32А', cat: 'Питание', aliases: ['32 а', '32 a'] },
  { id: 'power-63a', name: 'Силовой ввод 63А', cat: 'Питание', aliases: ['63 а', '63 a', 'сила 63'] },
  { id: 'power-kapy', name: 'Капы (резиновые кабель-каналы)', cat: 'Коммутация', aliases: ['капы', 'кап', 'капов', 'кабель канал*', 'кабельн* канал*'] },
  { id: 'power-grey', name: 'Серые удлинители', cat: 'Питание', aliases: ['серые', 'серых'] },
  { id: 'power-cable', name: 'Силовой кабель', cat: 'Питание', aliases: ['сила', 'силов* кабел*'] },
  { id: 'extension', name: 'Удлинители / пилоты', cat: 'Питание', aliases: ['удлинител*', 'пилот*'] },

  // ---------- Коммутация ----------
  { id: 'cable-utp', name: 'UTP-кабель', cat: 'Коммутация', aliases: ['utp*', 'витая пара', 'витуха'] },
  { id: 'splitter-dmx', name: 'Сплиттеры DMX', cat: 'Свет', aliases: ['сплиттер* dmx', 'dmx сплиттер*'] },
  { id: 'splitter', name: 'Сплиттеры', cat: 'Коммутация', aliases: ['сплиттер*', 'сплитер*'] },
  { id: 'cabling', name: 'Коммутация (коммутационные кабели)', cat: 'Коммутация', aliases: ['коммутаци*', 'коммутло*', 'коммутатор*', 'коммутационн* кабел*'] },
  { id: 'cable-xlr', name: 'XLR-кабели', cat: 'Коммутация', aliases: ['xlr*'] },
  { id: 'cable-jack', name: 'Jack-кабели', cat: 'Коммутация', aliases: ['jack*', 'джек*'] },

  // ---------- Мебель ----------
  { id: 'chair', name: 'Кресла', cat: 'Мебель', aliases: ['кресл*', 'кресел'] },
  { id: 'nightstand', name: 'Тумбы', cat: 'Мебель', aliases: ['тумб*'] },
  { id: 'lectern', name: 'Трибуна (спичка)', cat: 'Мебель', aliases: ['спичк*', 'спич трибун*', 'трибун*'] },
  { id: 'film', name: 'Плёнка для упаковки', cat: 'Прочее', aliases: ['пленк*', 'плёнк*'] },
];

/* ---------- Компиляция alias → RegExp ---------- */

const L = '\\p{L}';
const N = '\\p{N}';

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

/** «qu16» → q u [\s-]? 1 6: необязательный пробел/дефис на границе букв и цифр. */
function wordToRe(word: string): string {
  const star = word.endsWith('*');
  const w = star ? word.slice(0, -1) : word;
  let out = '';
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (i > 0) {
      const prev = w[i - 1];
      const a = /\p{L}/u.test(prev), b = /\p{N}/u.test(prev);
      const c = /\p{L}/u.test(ch), d = /\p{N}/u.test(ch);
      if ((a && d) || (b && c)) out += '[\\s-]?';
    }
    // ё и е взаимозаменяемы
    if (ch === 'е' || ch === 'ё') out += '[её]';
    else out += escapeRe(ch);
  }
  return out + (star ? `[${L}]*` : '');
}

export function aliasToRegExp(alias: string): RegExp {
  const t = alias.trim();
  const a = t.toLowerCase();
  let body: string;
  if (t.startsWith('/')) body = t.replace(/^\/|\/$/g, '');
  else body = a.split(/[\s-]+/).filter(Boolean).map(wordToRe).join('[\\s-]*');
  return new RegExp(`(?<![${L}${N}])(?:${body})(?![${L}${N}])`, 'giu');
}

export interface CompiledEntry extends DictEntry {
  res: RegExp[];
}

export function compileDict(entries: DictEntry[]): CompiledEntry[] {
  return entries.map((e) => ({ ...e, res: e.aliases.filter((a) => a.trim()).map(aliasToRegExp) }));
}

export interface DictHit {
  entry: CompiledEntry;
  index: number;
  length: number;
}

/**
 * Все непересекающиеся совпадения словаря в строке.
 * Более длинное совпадение важнее; при равной длине — то, что раньше в словаре.
 */
export function matchDict(dict: CompiledEntry[], text: string): DictHit[] {
  const cands: (DictHit & { order: number })[] = [];
  dict.forEach((entry, order) => {
    for (const re of entry.res) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (!m[0]) {
          re.lastIndex++;
          continue;
        }
        cands.push({ entry, index: m.index, length: m[0].length, order });
      }
    }
  });
  cands.sort((x, y) => y.length - x.length || x.order - y.order);
  const taken: [number, number][] = [];
  const hits: DictHit[] = [];
  for (const c of cands) {
    const a = c.index, b = c.index + c.length;
    if (taken.some(([x, y]) => a < y && b > x)) continue;
    taken.push([a, b]);
    hits.push({ entry: c.entry, index: c.index, length: c.length });
  }
  return hits.sort((x, y) => x.index - y.index);
}

/** Объединяет базовый словарь с пользовательскими дополнениями. Пользовательские стоят первыми. */
export function mergeDict(custom: DictEntry[]): DictEntry[] {
  const byId = new Map(BASE_DICT.map((e) => [e.id, e]));
  const extraAliases = new Map<string, string[]>();
  const newEntries: DictEntry[] = [];
  for (const c of custom) {
    if (byId.has(c.id)) extraAliases.set(c.id, [...(extraAliases.get(c.id) ?? []), ...c.aliases]);
    else newEntries.push(c);
  }
  // Пользовательские alias к существующим позициям выносим отдельными записями в начало,
  // чтобы они побеждали общие слова при равной длине.
  const boosted: DictEntry[] = [];
  for (const [id, aliases] of extraAliases) {
    const base = byId.get(id)!;
    boosted.push({ ...base, aliases });
  }
  return [...newEntries, ...boosted, ...BASE_DICT];
}

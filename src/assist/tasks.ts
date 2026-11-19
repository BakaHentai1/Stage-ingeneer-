/**
 * Модуль C. Практические задания: начальное состояние, требования и проверка решения.
 * Проверка объясняет каждую ошибку, а не просто «неверно».
 */
import { checkPatch, IN_KINDS, socketsAvailable, type InKind, type InSource, type OutRow, type PatchSetup } from './patch';
import { findBus, CONSOLES } from './qu';
import type { Level } from './trainer';

export interface CheckItem { ok: boolean; text: string; why?: string }

export interface PatchTask {
  id: string;
  kind: 'patch';
  level: Level;
  title: string;
  brief: string[];
  start: () => PatchSetup;
  verify: (p: PatchSetup) => CheckItem[];
}

export interface QuizTask {
  id: string;
  kind: 'quiz';
  level: Level;
  title: string;
  brief: string[];
  questions: { q: string; options: string[]; right: number; why: string }[];
}

export type Task = PatchTask | QuizTask;

const src = (id: string, name: string, kind: InKind, stereo = false): InSource => ({ id, name, kind, stereo, loc: 'local', socket: 1, ch: 'CH1', phantom: false });

/** Общие проверки: нет критических ошибок патча. */
function noCrit(p: PatchSetup): CheckItem[] {
  const crit = checkPatch(p).warnings.filter((w) => w.level === 'crit');
  return crit.length
    ? crit.map((w) => ({ ok: false, text: w.text, why: 'Это ошибка патча: в таком виде сигнал не пройдёт.' }))
    : [{ ok: true, text: 'Патч без ошибок: каналы и разъёмы не пересекаются.' }];
}

function phantomItems(p: PatchSetup): CheckItem[] {
  const out: CheckItem[] = [];
  for (const s of p.inputs) {
    const need = IN_KINDS[s.kind].phantom;
    if (need !== s.phantom) {
      out.push({ ok: false, text: `«${s.name}»: 48V ${s.phantom ? 'включено, а не нужно' : 'не включено'}.`, why: need ? 'Конденсаторный микрофон и активный DI питаются от фантома.' : 'Фантом нужен только конденсаторам и активным DI; на линейных выходах он вреден.' });
    }
  }
  if (!out.length) out.push({ ok: true, text: '48V включено ровно там, где нужно.' });
  return out;
}

function outCheck(p: PatchSetup, pred: (o: OutRow) => boolean, ok: string, bad: string, why: string): CheckItem {
  return p.outputs.some(pred) ? { ok: true, text: ok } : { ok: false, text: bad, why };
}

const legOf = (p: PatchSetup, o: OutRow) => socketsAvailable(p).find((s) => s.id === o.socket)?.fixed?.leg ?? o.leg;

function mainsLR(p: PatchSetup): CheckItem[] {
  const mains = p.outputs.filter((o) => o.dest === 'mains');
  const onLR = mains.filter((o) => o.bus === 'LR');
  const legs = new Set(onLR.map((o) => legOf(p, o)));
  if (legs.has('L') && legs.has('R')) return [{ ok: true, text: 'Порталы получают Main LR: левый — L, правый — R.' }];
  return [{ ok: false, text: 'Порталы должны получать Main LR, обе стороны: L и R.', why: 'Основной звук идёт с главной шины LR; один выход — одна сторона.' }];
}

export const TASKS: Task[] = [
  {
    id: 't8mic', kind: 'patch', level: 'base', title: 'Подключить 8 микрофонов в стейджбокс',
    brief: [
      'Пульт Qu-16, стейджбокс AR2412 на сцене.',
      'Все 8 источников подключите в стейджбокс, входы 1–8 по порядку списка.',
      'Каналы пульта CH1–CH8 в том же порядке: вход 1 → CH1 и т. д.',
      '48V — только там, где нужно.',
    ],
    start: () => ({
      console: 'qu16', rack: 'AR2412', snakeLen: 40, outputs: [],
      inputs: [src('a1', 'Вокал 1', 'dyn'), src('a2', 'Вокал 2', 'dyn'), src('a3', 'Бэк 1', 'dyn'), src('a4', 'Бэк 2', 'dyn'), src('a5', 'Хор L', 'cond'), src('a6', 'Хор R', 'cond'), src('a7', 'Радио 1', 'wireless'), src('a8', 'Радио 2', 'wireless')],
    }),
    verify: (p) => {
      const items: CheckItem[] = [];
      p.inputs.forEach((s, i) => {
        const n = i + 1;
        if (s.loc !== 'rack') items.push({ ok: false, text: `«${s.name}» подключён в пульт, а не в стейджбокс.`, why: 'Источники на сцене подключают в стейджбокс: короткие кабели, один Cat5e до пульта.' });
        else if (s.socket !== n) items.push({ ok: false, text: `«${s.name}»: вход стейджбокса ${s.socket}, а по заданию ${n}.` });
        if (s.ch !== `CH${n}`) items.push({ ok: false, text: `«${s.name}»: канал ${s.ch}, а по заданию CH${n}.`, why: 'Назначение входа стейджбокса на канал делается в Setup → I/O Patch → dSNAKE In.' });
      });
      if (!items.length) items.push({ ok: true, text: 'Все 8 источников в стейджбоксе, входы 1–8 на каналы CH1–CH8.' });
      return [...items, ...phantomItems(p), ...noCrit(p)];
    },
  },
  {
    id: 'tconf', kind: 'patch', level: 'mid', title: 'Конференция',
    brief: [
      'Qu-16, стейджбокс AB168 на сцене.',
      '6 конденсаторных микрофонов президиума и 2 радиомикрофона — в стейджбокс, каналы CH1–CH8.',
      'Ноутбук стоит у пульта: стерео вход ST.',
      'Порталы L и R — с выходов стейджбокса, сигнал Main LR.',
      'Монитор президиума — свой микс (не LR), с выхода стейджбокса.',
      'Запись — с выхода пульта, сигнал LR.',
    ],
    start: () => ({
      console: 'qu16', rack: 'AB168', snakeLen: 35,
      inputs: [1, 2, 3, 4, 5, 6].map((i) => src(`c${i}`, `Президиум ${i}`, 'cond')).concat([src('c7', 'Радио 1', 'wireless'), src('c8', 'Радио 2', 'wireless'), src('c9', 'Ноутбук', 'playback', true)]),
      outputs: [
        { id: 'o1', name: 'Портал L', dest: 'mains', bus: 'LR', leg: null, socket: 'XLR:L' },
        { id: 'o2', name: 'Портал R', dest: 'mains', bus: 'LR', leg: null, socket: 'XLR:L' },
        { id: 'o3', name: 'Монитор президиума', dest: 'monitor', bus: 'LR', leg: null, socket: 'XLR:R' },
        { id: 'o4', name: 'Запись', dest: 'record', bus: 'Mix1', leg: null, socket: 'ALT' },
      ],
    }),
    verify: (p) => {
      const items: CheckItem[] = [];
      const mics = p.inputs.filter((s) => s.kind !== 'playback');
      const badMic = mics.filter((s) => s.loc !== 'rack' || !/^CH[1-8]$/.test(s.ch));
      items.push(badMic.length ? { ok: false, text: `Не в стейджбоксе или вне CH1–CH8: ${badMic.map((s) => s.name).join(', ')}.`, why: 'Микрофоны — на сцене, значит в стейджбокс.' } : { ok: true, text: 'Все микрофоны в стейджбоксе на CH1–CH8.' });
      const lap = p.inputs.find((s) => s.kind === 'playback');
      if (lap) items.push(lap.loc === 'local' && lap.ch.startsWith('ST') ? { ok: true, text: 'Ноутбук на стерео входе пульта.' } : { ok: false, text: 'Ноутбук должен быть на стерео входе ST у пульта.', why: 'Источник у пульта не тянут на сцену; ST — линейный стерео вход.' });
      items.push(...mainsLR(p));
      const mainsRack = p.outputs.filter((o) => o.dest === 'mains').every((o) => o.socket.startsWith('RACK'));
      items.push(mainsRack ? { ok: true, text: 'Порталы с выходов стейджбокса.' } : { ok: false, text: 'Порталы стоят у сцены — берите выходы стейджбокса.', why: 'Иначе тянуть длинные линии от пульта, когда есть Cat5e.' });
      items.push(outCheck(p, (o) => o.dest === 'monitor' && findBus(CONSOLES[p.console], o.bus)?.kind === 'mix' && o.socket.startsWith('RACK'), 'Монитор президиума — свой Mix с выхода стейджбокса.', 'Монитор президиума должен получать свой Mix с выхода стейджбокса.', 'Монитор от LR повторяет зал и меняется вместе с мастером; свой Mix (pre-fader) настраивается отдельно.'));
      items.push(outCheck(p, (o) => o.dest === 'record' && o.bus === 'LR' && !o.socket.startsWith('RACK'), 'Запись с выхода пульта, сигнал LR.', 'Запись: сигнал LR с выхода пульта (Alt Out или 2TRK).', 'Рекордер стоит у пульта; 2TRK всегда несёт LR, Alt Out назначается на LR в Setup → I/O Patch → Surface.'));
      return [...items, ...phantomItems(p), ...noCrit(p)];
    },
  },
  {
    id: 'tmon', kind: 'patch', level: 'mid', title: 'Сценические мониторы и in-ear',
    brief: [
      'Qu-16, AR2412, порталы уже подключены.',
      '4 монитора — каждому свой моно микс Mix 1–4, с выходов стейджбокса.',
      'In-ear клавишника — стерео микс, обе стороны (L и R) на два выхода стейджбокса.',
      'Сабвуферы — отдельный выход стейджбокса.',
    ],
    start: () => ({
      console: 'qu16', rack: 'AR2412', snakeLen: 30, inputs: [src('v', 'Вокал', 'dyn')],
      outputs: [
        { id: 'p1', name: 'Портал L', dest: 'mains', bus: 'LR', leg: 'L', socket: 'RACK:1' },
        { id: 'p2', name: 'Портал R', dest: 'mains', bus: 'LR', leg: 'R', socket: 'RACK:2' },
        { id: 'm1', name: 'Монитор 1', dest: 'monitor', bus: 'Mix1', leg: null, socket: 'RACK:3' },
        { id: 'm2', name: 'Монитор 2', dest: 'monitor', bus: 'Mix1', leg: null, socket: 'RACK:4' },
        { id: 'm3', name: 'Монитор 3', dest: 'monitor', bus: 'LR', leg: 'L', socket: 'RACK:5' },
        { id: 'm4', name: 'Монитор 4', dest: 'monitor', bus: 'Mix4', leg: null, socket: 'XLR:Mix1' },
        { id: 'i1', name: 'In-ear L', dest: 'iem', bus: 'Mix2', leg: null, socket: 'RACK:7' },
        { id: 'i2', name: 'In-ear R', dest: 'iem', bus: 'Mix2', leg: null, socket: 'RACK:8' },
        { id: 's1', name: 'Сабвуферы', dest: 'sub', bus: 'LR', leg: 'L', socket: 'RACK:9' },
      ],
    }),
    verify: (p) => {
      const items: CheckItem[] = [];
      const mons = p.outputs.filter((o) => o.dest === 'monitor');
      const buses = mons.map((o) => o.bus);
      const okMono = mons.length === 4 && new Set(buses).size === 4 && buses.every((b) => /^Mix[1-4]$/.test(b));
      items.push(okMono ? { ok: true, text: 'У каждого монитора свой микс Mix 1–4.' } : { ok: false, text: 'Каждому из 4 мониторов — свой микс из Mix 1–4, без повторов.', why: 'Один микс на два монитора — оба музыканта слышат одно и то же; LR в мониторе повторяет зал.' });
      const monRack = mons.every((o) => o.socket.startsWith('RACK'));
      items.push(monRack ? { ok: true, text: 'Мониторы с выходов стейджбокса.' } : { ok: false, text: 'Мониторы стоят на сцене — подключайте их к выходам стейджбокса.' });
      const iem = p.outputs.filter((o) => o.dest === 'iem');
      const iemBus = iem.length === 2 && iem[0].bus === iem[1].bus && findBus(CONSOLES[p.console], iem[0].bus)?.stereo && new Set(iem.map((o) => o.leg)).size === 2;
      items.push(iemBus ? { ok: true, text: 'In-ear: стерео микс, стороны L и R.' } : { ok: false, text: 'In-ear: один стерео микс (Mix 5/6, 7/8 или 9/10), стороны L и R на два выхода.', why: 'Моно микс в стерео наушниках звучит «в голове»; стерео даёт панораму и меньше громкости.' });
      items.push(outCheck(p, (o) => o.dest === 'sub' && o.socket.startsWith('RACK'), 'Сабвуферы на выходе стейджбокса.', 'Сабвуферам нужен выход стейджбокса.', 'Сабы стоят у сцены.'));
      return [...items, ...noCrit(p)];
    },
  },
  {
    id: 'tfix', kind: 'patch', level: 'pro', title: 'Найти и исправить ошибки',
    brief: ['Коллега собрал патч для группы на Qu-16 с AR2412, но на саундчеке ничего не работает как надо.', 'Исправьте патч так, чтобы не осталось ни ошибок, ни предупреждений.'],
    start: () => ({
      console: 'qu16', rack: 'AR2412', snakeLen: 30,
      inputs: [
        { ...src('f1', 'Бочка', 'dyn'), loc: 'rack', socket: 1, ch: 'CH1' },
        { ...src('f2', 'Малый', 'dyn'), loc: 'rack', socket: 1, ch: 'CH2' },
        { ...src('f3', 'Overhead', 'cond', true), loc: 'rack', socket: 3, ch: 'CH4' },
        { ...src('f4', 'Бас', 'di-active'), loc: 'rack', socket: 5, ch: 'CH6' },
        { ...src('f5', 'Вокал', 'dyn'), loc: 'rack', socket: 6, ch: 'CH6' },
        { ...src('f6', 'Клавиши', 'line', true), loc: 'local', ch: 'ST1', phantom: true },
      ],
      outputs: [
        { id: 'g1', name: 'Портал L', dest: 'mains', bus: 'LR', leg: 'L', socket: 'RACK:1' },
        { id: 'g2', name: 'Портал R', dest: 'mains', bus: 'LR', leg: 'R', socket: 'RACK:1' },
        { id: 'g3', name: 'Монитор вокал', dest: 'monitor', bus: 'LR', leg: 'L', socket: 'RACK:3' },
        { id: 'g4', name: 'Запись', dest: 'record', bus: 'Mix2', leg: null, socket: '2TRK' },
      ],
    }),
    verify: (p) => {
      const w = checkPatch(p).warnings.filter((x) => x.level !== 'info');
      const ph = phantomItems(p).filter((i) => !i.ok);
      if (!w.length && !ph.length) return [{ ok: true, text: 'Ошибок и предупреждений нет. Всё исправлено.' }];
      return [...w.map((x) => ({ ok: false, text: x.text })), ...ph];
    },
  },
  {
    id: 'qaux', kind: 'quiz', level: 'mid', title: 'AUX, FX и маршрутизация',
    brief: ['Ответьте на вопросы. После каждого ответа — объяснение.'],
    questions: [
      { q: 'Вокалист жалуется: когда вы делаете тише вокал в зале, в мониторе он тоже пропадает. В чём причина?', options: ['Посыл в монитор post-fader', 'Мало Gain', 'Включён Gate', 'Монитор подключён к Alt Out'], right: 0, why: 'Post-fader посыл зависит от фейдера канала. Для монитора нужен pre-fader.' },
      { q: 'Как правильно подключить ревербератор на Qu?', options: ['Insert на каждом канале', 'Посыл FX1 post-fader, возврат FX1 в LR', 'Ревер на мастер LR', 'Pre-fader посыл в Mix 1'], right: 1, why: 'Send/Return: сухой сигнал остаётся в канале, ревер добавляется через возврат. Посыл post-fader — чтобы ревер следовал за фейдером.' },
      { q: 'У Qu-16 шин FX send две. Как задействовать FX3?', options: ['Никак', 'Через Mix 1–10 или Insert', 'Через матрицу', 'Через группу'], right: 1, why: 'У Qu-16 FX3 и FX4 питаются от Mix 1–10 или включаются в разрыв (Insert). Групп и матриц у Qu-16 нет.' },
      { q: 'Нужен отдельный уровень звука в фойе на Qu-24. Что взять?', options: ['Group', 'Matrix', 'PAFL', 'Direct Out'], right: 1, why: 'Матрица берёт LR (и миксы, группы) и даёт свой мастер и обработку — уровень фойе не зависит от зала.' },
      { q: 'Канал барабана назначен на Group 1/2 и на LR. Что будет?', options: ['Ничего страшного', 'Сигнал придёт в зал дважды', 'Сигнал пропадёт', 'Группа заглушит канал'], right: 1, why: 'Группа сама идёт в LR. Если канал назначен и туда, и туда — он звучит дважды, громче и с фазовыми проблемами.' },
      { q: 'Чем Direct Out отличается от посыла в Mix?', options: ['Ничем', 'Это индивидуальный выход одного канала', 'Он идёт только в наушники', 'Он всегда post-fader'], right: 1, why: 'Direct Out — выход одного канала (для мультитрек-записи, ME). Точка отбора выбирается, по умолчанию Post Delay.' },
      { q: 'Где слушать канал, не трогая зал?', options: ['Поднять в Mix 1', 'Кнопка PAFL', 'Mute', 'Alt Out'], right: 1, why: 'PAFL отправляет канал в наушники и на индикаторы, в зал он не идёт.' },
    ],
  },
];

/** Сколько пунктов выполнено. */
export function score(items: CheckItem[]): { ok: number; total: number; done: boolean } {
  const ok = items.filter((i) => i.ok).length;
  return { ok, total: items.length, done: ok === items.length };
}

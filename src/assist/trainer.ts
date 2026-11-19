/**
 * Модуль C. Тренажёр Allen & Heath Qu-16 / Qu-24: органы управления, уроки, викторина.
 * Схема поверхности упрощена (блоки по назначению), это не точная копия панели.
 * Назначение кнопок и меню — по Qu Mixer Reference Guide (AP9372) и Qu-16 User Guide.
 */

export type ElId =
  | 'superstrip' | 'screen' | 'k-home' | 'k-proc' | 'k-route' | 'k-fx' | 'k-scenes' | 'k-setup' | 'rotary' | 'qudrive'
  | 'layers' | 'assign' | 'prefade' | 'copy' | 'paste' | 'reset' | 'fn' | 'softkeys' | 'talk' | 'flip' | 'shutdown'
  | 'sel' | 'pafl' | 'mute' | 'meter' | 'fader' | 'mixkeys' | 'master';

export interface SurfaceEl {
  id: ElId;
  label: string;
  desc: string;
}

export const ELEMENTS: Record<ElId, SurfaceEl> = {
  superstrip: { id: 'superstrip', label: 'SuperStrip', desc: 'Ряд регуляторов быстрого доступа к обработке выбранного (Sel) канала: Gain, HPF, Gate, PEQ, компрессор, панорама. Меняет то, что выбрано кнопкой Sel.' },
  screen: { id: 'screen', label: 'Сенсорный экран', desc: 'Показывает и меняет параметры выбранного канала или микса. Значение крутится экранным регулятором или ручками SuperStrip.' },
  'k-home': { id: 'k-home', label: 'Home', desc: 'Главный экран: индикаторы, RTA, Qu-Drive (запись и воспроизведение на USB-диск).' },
  'k-proc': { id: 'k-proc', label: 'Processing', desc: 'Обработка выбранного канала: Preamp, HPF, Gate, PEQ, Comp, Delay; у миксов — GEQ.' },
  'k-route': { id: 'k-route', label: 'Routing', desc: 'Маршрутизация выбранного канала: назначение на LR и панорама, Direct Out, посылы в Mix и FX, (Qu-24) посылы в группы, назначение в Mute/DCA группы.' },
  'k-fx': { id: 'k-fx', label: 'FX', desc: 'Четыре встроенных процессора эффектов: библиотека эффектов, параметры, Back Panel — подключение как Send/Return или Insert.' },
  'k-scenes': { id: 'k-scenes', label: 'Scenes', desc: 'Сцены: сохранение (Store) и вызов (Recall) состояния пульта, фильтр и Safes — что не трогать при вызове.' },
  'k-setup': { id: 'k-setup', label: 'Setup', desc: 'Настройка системы: Audio (PAFL, Talkback, генератор сигнала), I/O Patch (Surface, dSNAKE In/Out), Control (Custom layer, SoftKeys), сеть, утилиты.' },
  rotary: { id: 'rotary', label: 'Экранный регулятор', desc: 'Крутит параметр, выбранный касанием на экране.' },
  qudrive: { id: 'qudrive', label: 'Qu-Drive (USB)', desc: 'Разъём USB для флешки или диска: стерео и мультитрек запись и воспроизведение, сохранение шоу.' },
  layers: { id: 'layers', label: 'Кнопки слоёв', desc: 'Нижний слой — моно каналы. Верхний — стерео входы ST, возвраты FX, мастера FX send и миксов. Обе кнопки вместе — Custom layer (собирается в Setup → Control).' },
  assign: { id: 'assign', label: 'Assign', desc: 'Модификатор назначения: удерживайте и нажимайте Sel каналов, чтобы назначить их на выбранный микс (по ключу Mix на мастер-секции).' },
  prefade: { id: 'prefade', label: 'Pre Fade', desc: 'Модификатор pre/post: удерживайте и нажимайте Sel каналов, чтобы переключать посыл в выбранный микс до или после фейдера.' },
  copy: { id: 'copy', label: 'Copy', desc: 'Копирование настроек: удерживайте Copy и нажмите Sel канала (или экранную кнопку блока обработки).' },
  paste: { id: 'paste', label: 'Paste', desc: 'Вставка скопированного: удерживайте Paste и нажмите Sel другого канала.' },
  reset: { id: 'reset', label: 'Reset', desc: 'Сброс к заводским значениям: удерживайте Reset и нажмите то, что надо сбросить. Осторожно на концерте.' },
  fn: { id: 'fn', label: 'Fn', desc: 'Дополнительные функции экрана: например, в Preamp — выбор источника канала (Local, dSNAKE, USB).' },
  softkeys: { id: 'softkeys', label: 'SoftKeys / Mute Groups', desc: 'Назначаемые кнопки (Setup → Control → SoftKeys). На Qu-16 по умолчанию — Mute Groups 1–4.' },
  talk: { id: 'talk', label: 'Talk', desc: 'Включает микрофон связи (Talkback). Куда он идёт — Setup → Audio → Talkback.' },
  flip: { id: 'flip', label: 'Fader Flip', desc: 'Переносит полосы GEQ выбранного микса на фейдеры — удобно вырезать частоты обратной связи.' },
  shutdown: { id: 'shutdown', label: 'Shut Down / Lock', desc: 'Корректное выключение (дождаться сообщения на экране, потом выключить питание) и блокировка поверхности.' },
  sel: { id: 'sel', label: 'Sel', desc: 'Выбор канала: экран и SuperStrip показывают его обработку. С модификаторами Assign, Pre Fade, Copy, Paste, Reset работает как цель.' },
  pafl: { id: 'pafl', label: 'PAFL', desc: 'Прослушка канала в наушниках (PFL — до фейдера, AFL — после). В зал не идёт.' },
  mute: { id: 'mute', label: 'Mute', desc: 'Выключение канала. Мигание означает, что канал заглушен группой (Mute Group или DCA).' },
  meter: { id: 'meter', label: 'Индикатор', desc: 'Уровень канала. Pk — до перегрузки около 3 дБ: при постоянном Pk уменьшайте Gain.' },
  fader: { id: 'fader', label: 'Фейдер', desc: 'Уровень канала в выбранный микс. При нажатом LR — в зал, при нажатом Mix 1 — посыл в Mix 1 (Sends on Fader).' },
  mixkeys: { id: 'mixkeys', label: 'Клавиши миксов', desc: 'Выбор микса на мастер-секции: LR, Mix 1–10, FX1–FX2 (на Qu-24 FX1–FX4, группы, матрицы). Фейдеры каналов становятся посылами в этот микс.' },
  master: { id: 'master', label: 'Мастер-фейдер', desc: 'Уровень выбранного микса (LR или Mix). Есть запас +10 дБ.' },
};

export type Level = 'base' | 'mid' | 'pro';
export const LEVELS: Record<Level, string> = { base: 'Начальный', mid: 'Средний', pro: 'Продвинутый' };

export interface Lesson {
  id: string;
  level: Level;
  title: string;
  /** Только для моделей с группами и матрицами. */
  qu24?: boolean;
  steps: { el: ElId; text: string }[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'tour', level: 'base', title: 'Знакомство с поверхностью',
    steps: [
      { el: 'fader', text: 'Каналы: фейдер, Mute, PAFL и Sel. На Qu-16 их 16 в слое, на Qu-24 — 24.' },
      { el: 'layers', text: 'Кнопки слоёв переключают, что стоит на фейдерах: моно каналы или стерео входы, возвраты FX и мастера миксов.' },
      { el: 'mixkeys', text: 'Клавиши миксов выбирают, куда «смотрят» фейдеры: LR (зал) или конкретный монитор.' },
      { el: 'screen', text: 'Экран показывает выбранный канал. Под ним кнопки разделов меню.' },
      { el: 'superstrip', text: 'SuperStrip — ручки быстрого доступа к обработке канала, выбранного Sel.' },
    ],
  },
  {
    id: 'gain', level: 'base', title: 'Gain staging одного канала',
    steps: [
      { el: 'master', text: 'Мастер LR пока внизу. Попросите артиста петь или играть так громко, как на концерте.' },
      { el: 'sel', text: 'Нажмите Sel канала.' },
      { el: 'pafl', text: 'Нажмите PAFL — вы слышите канал в наушниках, а индикатор показывает его уровень.' },
      { el: 'superstrip', text: 'Ручкой Gain в SuperStrip (или Processing → Preamp) поднимайте усиление, пока пики не будут у «0», без Pk.' },
      { el: 'meter', text: 'Если загорается Pk — уменьшите Gain. Gain — это не громкость, а рабочий уровень сигнала.' },
      { el: 'pafl', text: 'Снимите PAFL. Громкость в зале — только фейдером.' },
    ],
  },
  {
    id: 'mute', level: 'base', title: 'Mute, PAFL и Mute Groups',
    steps: [
      { el: 'mute', text: 'Mute выключает канал во всех миксах после точки mute.' },
      { el: 'pafl', text: 'PAFL можно слушать даже заглушенный канал: так проверяют микрофон перед выходом артиста.' },
      { el: 'softkeys', text: 'На Qu-16 SoftKeys по умолчанию — Mute Groups 1–4: одна кнопка глушит группу каналов. Назначение — Routing → Mute/DCA Assign.' },
    ],
  },
  {
    id: 'mon', level: 'mid', title: 'Сценический монитор на Mix 1',
    steps: [
      { el: 'mixkeys', text: 'Нажмите Mix 1 на мастер-секции. Фейдеры каналов показывают посылы в Mix 1.' },
      { el: 'fader', text: 'Поднимите посылы тех каналов, что нужны артисту в мониторе (обычно сначала его голос).' },
      { el: 'k-route', text: 'Посыл в монитор должен быть pre-fader. Проверить: Sel канала → Routing → Mix Sends.' },
      { el: 'prefade', text: 'Быстро: удерживайте Pre Fade и нажимайте Sel каналов.' },
      { el: 'master', text: 'Мастер-фейдер теперь управляет общим уровнем Mix 1.' },
      { el: 'mixkeys', text: 'Нажмите LR, чтобы вернуть фейдеры в зал. Частая ошибка — забыть это и «крутить зал» в мониторе.' },
    ],
  },
  {
    id: 'fx', level: 'mid', title: 'Реверберация через FX1',
    steps: [
      { el: 'k-fx', text: 'FX → FX1 → Library: выберите ревербератор. Back Panel: режим Send/Return.' },
      { el: 'mixkeys', text: 'Нажмите FX1 на мастер-секции. Фейдеры каналов — посылы в ревербератор.' },
      { el: 'fader', text: 'Добавьте посыл вокалу. Барабанам и басу ревер обычно меньше или не нужен.' },
      { el: 'layers', text: 'Верхний слой: найдите возврат FX1 и поднимите его — ревер появится в зале.' },
      { el: 'mixkeys', text: 'Вернитесь в LR.' },
    ],
  },
  {
    id: 'scenes', level: 'mid', title: 'Сохранить и вызвать сцену',
    steps: [
      { el: 'k-scenes', text: 'Scenes: выберите номер сцены и сохраните (Store), дайте имя.' },
      { el: 'k-scenes', text: 'Safes и фильтр сцен защищают то, что не должно меняться при вызове (например, Gain стейджбокса).' },
      { el: 'qudrive', text: 'Шоу целиком сохраняется на USB-диск: Setup → USB Data. Делайте копию перед мероприятием.' },
    ],
  },
  {
    id: 'copy', level: 'mid', title: 'Скопировать обработку канала',
    steps: [
      { el: 'copy', text: 'Удерживайте Copy и нажмите Sel канала-образца.' },
      { el: 'paste', text: 'Удерживайте Paste и нажмите Sel канала, куда переносите.' },
      { el: 'reset', text: 'Reset работает так же, но сбрасывает. Не перепутайте.' },
    ],
  },
  {
    id: 'geq', level: 'pro', title: 'Убрать заводку в мониторе (GEQ и Fader Flip)',
    steps: [
      { el: 'mixkeys', text: 'Выберите микс монитора (Mix 1).' },
      { el: 'k-proc', text: 'Processing → GEQ. RTA на экране Home помогает увидеть частоту.' },
      { el: 'flip', text: 'Fader Flip — полосы GEQ на фейдерах.' },
      { el: 'fader', text: 'Медленно поднимая уровень, найдите звенящую частоту и уберите её на 3–6 дБ узко.' },
      { el: 'flip', text: 'Снимите Fader Flip, иначе фейдеры продолжат крутить эквалайзер.' },
    ],
  },
  {
    id: 'dsnake', level: 'pro', title: 'Стейджбокс по dSNAKE',
    steps: [
      { el: 'k-setup', text: 'Setup → I/O Patch → dSNAKE In: назначьте входы стейджбокса на каналы.' },
      { el: 'sel', text: 'Sel канала.' },
      { el: 'fn', text: 'Processing → Preamp → Fn → Source: dSNAKE.' },
      { el: 'superstrip', text: 'Gain теперь управляет предусилителем в стейджбоксе. Pad −20 дБ — там же на экране Preamp.' },
      { el: 'k-setup', text: 'Выходы стейджбокса: Setup → I/O Patch → dSNAKE Out.' },
    ],
  },
  {
    id: 'rec', level: 'pro', title: 'Мультитрек-запись',
    steps: [
      { el: 'k-route', text: 'Routing → Direct Out: выберите точку отбора, отключите Follow fader, если нужна запись «как с микрофона».' },
      { el: 'qudrive', text: 'Вставьте USB-диск. Home → Qu-Drive: мультитрек запись.' },
      { el: 'k-setup', text: 'Для записи в компьютер по USB B — назначение в USB-патче.' },
    ],
  },
  {
    id: 'group', level: 'pro', title: 'Группа барабанов (Qu-24)', qu24: true,
    steps: [
      { el: 'sel', text: 'Sel канала барабана.' },
      { el: 'k-route', text: 'Routing → Grp Sends: назначьте на Group 1/2. Routing → Main: снимите LR, иначе сигнал придёт дважды.' },
      { el: 'layers', text: 'Мастер группы — на верхнем слое. Повесьте на группу компрессор и управляйте барабанами одним фейдером.' },
    ],
  },
  {
    id: 'matrix', level: 'pro', title: 'Матрица для фойе (Qu-24)', qu24: true,
    steps: [
      { el: 'layers', text: 'Найдите мастер Matrix 1 на верхнем слое, нажмите Sel.' },
      { el: 'k-route', text: 'Routing: отправьте LR в Matrix 1.' },
      { el: 'k-setup', text: 'Setup → I/O Patch → Surface: Alt Out = Matrix 1. Или выход стейджбокса.' },
      { el: 'master', text: 'Уровень фойе — мастер Matrix 1, он не зависит от зала.' },
    ],
  },
];

/** Вопросы викторины: найти орган управления по задаче. */
export const QUIZ: { q: string; el: ElId }[] = [
  { q: 'Послушать канал в наушниках, не трогая зал', el: 'pafl' },
  { q: 'Выбрать канал, чтобы увидеть его эквалайзер', el: 'sel' },
  { q: 'Сделать фейдеры посылами в монитор Mix 2', el: 'mixkeys' },
  { q: 'Назначить источник канала dSNAKE', el: 'fn' },
  { q: 'Поставить ревер на FX1', el: 'k-fx' },
  { q: 'Перейти к стерео входам и возвратам FX', el: 'layers' },
  { q: 'Перенести полосы GEQ на фейдеры', el: 'flip' },
  { q: 'Сохранить сцену', el: 'k-scenes' },
  { q: 'Назначить Alt Out', el: 'k-setup' },
  { q: 'Переключить посылы pre/post сразу на нескольких каналах', el: 'prefade' },
  { q: 'Включить связь со сценой', el: 'talk' },
  { q: 'Корректно выключить пульт', el: 'shutdown' },
  { q: 'Посмотреть Direct Out канала', el: 'k-route' },
  { q: 'Быстро покрутить Gain выбранного канала', el: 'superstrip' },
];

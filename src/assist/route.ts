/**
 * Модуль C. Маршрутизация: полный путь сигнала от источника до акустики
 * с разделением на физическую коммутацию (кабели, разъёмы) и цифровую маршрутизацию (внутри пульта).
 */
import { CONSOLES, type ConsoleId } from './qu';
import { IN_KINDS, type InKind } from './patch';

export type RouteDest = 'lr' | 'aux-pre' | 'aux-post' | 'fx' | 'group' | 'matrix' | 'pafl' | 'direct';

export const ROUTE_DESTS: Record<RouteDest, { label: string; short: string }> = {
  lr: { label: 'Main LR — порталы в зал', short: 'Main LR' },
  'aux-pre': { label: 'AUX / Mix pre-fader — сценический монитор', short: 'Монитор (AUX pre)' },
  'aux-post': { label: 'AUX / Mix post-fader — задержки, запись', short: 'AUX post' },
  fx: { label: 'FX — ревербератор, дилэй', short: 'FX' },
  group: { label: 'Mix Bus / Group — подгруппа', short: 'Группа' },
  matrix: { label: 'Matrix — фойе, трансляция', short: 'Matrix' },
  pafl: { label: 'Monitor (PAFL) — прослушка в наушниках', short: 'PAFL' },
  direct: { label: 'Direct Out — мультитрек-запись', short: 'Direct Out' },
};

export interface RouteSetup {
  console: ConsoleId;
  transport: 'local' | 'rack';
  source: InKind;
  speakers: 'active' | 'passive';
  dest: RouteDest;
}

export type Layer = 'phys' | 'dig';

export interface Step {
  layer: Layer;
  title: string;
  detail: string;
  /** Как это сделать на пульте / руками. */
  how?: string;
  /** Отметка точки отбора сигнала. */
  tap?: string;
}

export interface RouteResult {
  steps: Step[];
  notes: string[];
  /** Если маршрут невозможен на выбранном пульте. */
  error?: string;
}

export const defaultRoute = (): RouteSetup => ({ console: 'qu16', transport: 'rack', source: 'dyn', speakers: 'active', dest: 'lr' });

function speakerSteps(s: RouteSetup, outSocket: string, what: string): Step[] {
  const st: Step[] = [{ layer: 'phys', title: outSocket, detail: `Выходной разъём, линейный уровень. Кабель XLR — XLR до ${what}.` }];
  if (s.speakers === 'active') {
    st.push({ layer: 'phys', title: `Активная акустика: ${what}`, detail: 'Вход XLR на колонке. Усилитель встроен, нужна сеть 230 В.', how: 'Сначала включите пульт, потом акустику. Выключайте в обратном порядке.' });
  } else {
    st.push({ layer: 'phys', title: 'Усилитель мощности', detail: 'Линейный вход XLR. Проверьте нагрузку: импеданс кабинетов на канал не ниже минимума усилителя (модуль A).' });
    st.push({ layer: 'phys', title: `Пассивная акустика: ${what}`, detail: 'Акустический кабель (Speakon NL4 / NL2) от выхода усилителя. Линейный XLR в пассивную колонку не подключать.' });
  }
  return st;
}

function analogRoute(s: RouteSetup): RouteResult {
  const k = IN_KINDS[s.source];
  const steps: Step[] = [
    { layer: 'phys', title: k.label, detail: `Кабель ${k.cable}.` },
    { layer: 'phys', title: s.transport === 'rack' ? 'Мультикор: вход на сценической коробке' : 'Вход канала на пульте', detail: s.transport === 'rack' ? 'Аналоговый мультикор: номер входа коробки = номер жилы = вход пульта. Переназначить можно только переставив кабель.' : 'XLR (Mic) или Jack (Line). Номер разъёма = номер канала.' },
    { layer: 'phys', title: 'Предусилитель канала', detail: `Gain, Pad, 48V${k.phantom ? ' (нужно)' : ''}. Фантом на многих аналоговых пультах включается сразу на группу входов.` },
    { layer: 'phys', title: 'Insert (разрыв)', detail: 'Jack TRS: tip — посыл, ring — возврат. Сюда включают внешний компрессор или гейт.', tap: 'после предусилителя' },
    { layer: 'phys', title: 'HPF, EQ', detail: 'Обрезной фильтр и эквалайзер канала.' },
  ];
  if (s.dest === 'aux-pre') steps.push({ layer: 'phys', title: 'AUX pre-fader', detail: 'Ручка AUX в положении pre: уровень монитора не зависит от фейдера канала.', tap: 'до фейдера' });
  steps.push({ layer: 'phys', title: 'Mute, фейдер, панорама', detail: 'Канальный фейдер и Pan.' });
  switch (s.dest) {
    case 'lr':
      steps.push({ layer: 'phys', title: 'Кнопка L-R / Mix', detail: 'Назначение канала на главную шину.' });
      steps.push({ layer: 'phys', title: 'Мастер L/R', detail: 'Мастер-фейдер, выход Main L/R.' });
      steps.push(...speakerSteps(s, 'Main Out L/R', 'порталов'));
      break;
    case 'aux-pre':
      steps.push({ layer: 'phys', title: 'AUX master', detail: 'Общий уровень мониторной линии.' });
      steps.push(...speakerSteps(s, 'AUX Out', 'монитора'));
      break;
    case 'aux-post':
    case 'fx':
      steps.push({ layer: 'phys', title: 'AUX post-fader', detail: 'Посыл после фейдера: при уводе фейдера уходит и эффект.', tap: 'после фейдера' });
      steps.push({ layer: 'phys', title: 'AUX Out → внешний процессор', detail: 'Кабель Jack/XLR в вход эффекта.' });
      steps.push({ layer: 'phys', title: 'Возврат эффекта', detail: 'Выход процессора → Stereo Return или свободный канал, оттуда в L/R. Посыл этого канала в тот же AUX держите на нуле, иначе петля.' });
      break;
    case 'group':
      steps.push({ layer: 'phys', title: 'Кнопка подгруппы', detail: 'Канал на подгруппу; кнопку L-R при этом снимают, иначе сигнал придёт в зал дважды.' });
      steps.push({ layer: 'phys', title: 'Мастер подгруппы → L/R', detail: 'Фейдер подгруппы, назначение на L/R.' });
      break;
    case 'matrix':
      return { steps, notes: [], error: 'Матрица есть не на всех аналоговых пультах. Проверьте по своей модели.' };
    case 'pafl':
      steps.push({ layer: 'phys', title: 'PFL / Solo', detail: 'Сигнал в наушники и на индикаторы, в зал не идёт.' });
      break;
    case 'direct':
      steps.push({ layer: 'phys', title: 'Direct Out', detail: 'Есть не на всех аналоговых пультах; обычно Jack, до или после фейдера по переключателю.' });
      break;
  }
  return { steps, notes: CONSOLES.analog.facts };
}

export function buildRoute(s: RouteSetup): RouteResult {
  if (s.console === 'analog') return analogRoute(s);
  const c = CONSOLES[s.console];
  const k = IN_KINDS[s.source];
  const rack = s.transport === 'rack';
  const notes: string[] = [];

  if (s.dest === 'group' && !c.groups) {
    return { steps: [], notes: c.facts, error: `У ${c.label} нет групп (они есть у Qu-24 и старше). Для общего управления уровнем нескольких каналов используйте DCA: на Qu-16 их 4 (Routing → Mute/DCA Assign).` };
  }
  if (s.dest === 'matrix' && !c.matrix) {
    return { steps: [], notes: c.facts, error: `У ${c.label} нет матриц. Для фойе или трансляции используйте свободный Mix (post-fader) или Alt Out с назначением LR (Setup → I/O Patch → Surface).` };
  }
  const steps: Step[] = [
    { layer: 'phys', title: k.label, detail: `Кабель ${k.cable}.${k.phantom ? ' Требует 48V.' : ''}` },
  ];
  if (rack) {
    steps.push({ layer: 'phys', title: 'Вход стейджбокса (AR2412 / AB168 / AR84)', detail: 'Предусилитель и АЦП стоят в стейджбоксе, на сцене. Номер входа стейджбокса пока ни с чем не связан.' });
    steps.push({ layer: 'phys', title: 'dSNAKE: Cat5e STP', detail: 'Один кабель EtherCon до пульта, до 120 м (рекомендовано до 100 м). По нему идут все входы, выходы и управление предусилителями.' });
  } else {
    steps.push({ layer: 'phys', title: 'Вход Mic/Line на задней панели', detail: 'XLR для микрофона или Jack TRS для линии. Локальный вход N всегда приходит на канал N.' });
  }
  steps.push({
    layer: 'dig', title: 'Input Patch: источник канала',
    detail: rack ? 'Вход стейджбокса назначается на канал. Один вход можно раздать на несколько каналов.' : 'Источник канала Local — по умолчанию.',
    how: rack ? 'Setup → I/O Patch → dSNAKE In, затем Sel → Processing → Preamp → Fn → Source: dSNAKE.' : 'Sel → Processing → Preamp → Fn → Source: Local.',
  });
  steps.push({
    layer: 'dig', title: 'Preamp: Gain, 48V, полярность',
    detail: `Gain — первым делом, по пикам около «0» на индикаторе.${k.phantom ? ' 48V включить.' : ''}${rack ? ' У стейджбокса есть Pad −20 дБ.' : ''}`,
    how: 'Sel → Processing → Preamp. 48V: удерживать кнопку 1 секунду.',
  });
  steps.push({ layer: 'dig', title: 'HPF', detail: 'Обрезной фильтр 20 Гц — 2 кГц. Для вокала обычно 80–120 Гц.', how: 'Processing → HPF' });
  steps.push({ layer: 'dig', title: 'Gate', detail: 'Закрывает канал в паузах (бочка, томы).', how: 'Processing → Gate' });
  steps.push({ layer: 'dig', title: 'Insert', detail: 'Точка разрыва: сюда можно включить встроенный FX-процессор в режиме Insert.', how: 'FX → Back Panel', tap: 'Insert Send (на USB для записи)' });
  steps.push({ layer: 'dig', title: 'PEQ — 4 полосы', detail: 'LF, LM, HM, HF, ±15 дБ.', how: 'Processing → PEQ' });
  steps.push({ layer: 'dig', title: 'Compressor', detail: 'Порог, Ratio, атака, восстановление.', how: 'Processing → Comp' });
  steps.push({ layer: 'dig', title: 'Delay канала', detail: 'До 85 мс, для выравнивания по времени.', how: 'Processing → Delay' });

  const preTap = 'Источник pre-fader посылов задаётся для каждого микса: Post-Preamp, Pre-EQ, Post-EQ или Post-All.';
  const outSocket = (mix: string) => rack ? `Выход стейджбокса (Setup → I/O Patch → dSNAKE Out: ${mix})` : `XLR ${mix} на задней панели`;

  switch (s.dest) {
    case 'lr':
      steps.push({ layer: 'dig', title: 'Mute и фейдер канала', detail: 'Уровень канала в зал.' });
      steps.push({ layer: 'dig', title: 'Pan и назначение на LR', detail: 'Канал должен быть назначен на Main LR, иначе фейдер двигается, а в зале тишина.', how: 'Sel → Routing → Main (назначение LR, панорама)' });
      steps.push({ layer: 'dig', title: 'Мастер LR', detail: 'Обработка выхода: PEQ, GEQ, Comp, Delay. Мастер-фейдер LR.', how: 'Mix-клавиша LR на мастер-секции' });
      steps.push({ layer: 'dig', title: 'Output Patch', detail: rack ? 'LR назначается на выходы стейджбокса.' : 'XLR L и R на задней панели жёстко несут LR — назначать не нужно.', how: rack ? 'Setup → I/O Patch → dSNAKE Out' : undefined });
      steps.push(...speakerSteps(s, outSocket('LR'), 'порталов'));
      break;
    case 'aux-pre':
      steps.push({ layer: 'dig', title: 'Посыл в Mix 1 (pre-fader)', detail: `Посыл берётся до фейдера канала: правка зала не меняет монитор. ${preTap}`, tap: 'pre-fader', how: 'Нажмите Mix 1 на мастер-секции — фейдеры каналов станут посылами в Mix 1. Pre/Post посыла: Sel → Routing → Mix Sends.' });
      steps.push({ layer: 'dig', title: 'Мастер Mix 1', detail: 'Обработка микса (GEQ — для поиска частот обратной связи) и мастер-фейдер.', how: 'Mix 1 → Processing → GEQ; Fader Flip выводит GEQ на фейдеры' });
      steps.push({ layer: 'dig', title: 'Output Patch', detail: rack ? 'Mix 1 назначается на выход стейджбокса — монитор рядом, кабель короткий.' : 'XLR Mix 1 жёстко несёт Mix 1.', how: rack ? 'Setup → I/O Patch → dSNAKE Out' : undefined });
      steps.push(...speakerSteps(s, outSocket('Mix 1'), 'монитора'));
      break;
    case 'aux-post':
      steps.push({ layer: 'dig', title: 'Mute и фейдер канала', detail: 'Посыл берётся после фейдера: уводите фейдер — уходит и посыл.' });
      steps.push({ layer: 'dig', title: 'Посыл в Mix 2 (post-fader)', detail: 'Подходит для задержек (delay-линий), фойе, записи с балансом зала.', tap: 'post-fader', how: 'Mix 2 на мастер-секции, фейдеры = посылы. Pre/Post: Sel → Routing → Mix Sends.' });
      steps.push({ layer: 'dig', title: 'Мастер Mix 2 и Delay микса', detail: 'Задержка микса до 170 мс — для выравнивания delay-линий по времени (модуль A, «Задержка»).' });
      steps.push(...speakerSteps(s, outSocket('Mix 2'), 'линии задержки'));
      break;
    case 'fx':
      steps.push({ layer: 'dig', title: 'Mute и фейдер канала', detail: 'Посыл в эффект обычно post-fader.' });
      steps.push({ layer: 'dig', title: 'FX Send 1', detail: `Выделенная шина посыла на FX1. Шин FX send у ${c.label}: ${c.fxSends}.${c.fxSends < 4 ? ' FX3 и FX4 можно питать от Mix 1–10 или включить в Insert.' : ''}`, tap: 'post-fader', how: 'Sel канала → Routing → FX Sends, или Mix-клавиша FX1 — фейдеры станут посылами.' });
      steps.push({ layer: 'dig', title: 'FX1: процессор', detail: 'Тип эффекта из библиотеки (Reverb, Delay, Chorus…). Режим Send/Return.', how: 'FX → Library; FX → Back Panel: Send/Return' });
      steps.push({ layer: 'dig', title: 'FX Return 1 → LR', detail: 'Возврат эффекта — отдельный стерео фейдер на верхнем слое. Посыл с возврата обратно в FX1 держите выключенным, иначе петля.' });
      steps.push({ layer: 'dig', title: 'Мастер LR', detail: 'Эффект смешивается с сухим сигналом в зале.' });
      steps.push(...speakerSteps(s, outSocket('LR'), 'порталов'));
      notes.push('Мониторам эффект обычно не дают или дают меньше: возврат FX тоже имеет посылы в Mix.');
      break;
    case 'group':
      steps.push({ layer: 'dig', title: 'Mute и фейдер канала', detail: 'Уровень канала внутри группы.' });
      steps.push({ layer: 'dig', title: 'Посыл в Group 1/2', detail: 'Назначьте канал на группу и снимите прямое назначение на LR, иначе сигнал придёт в зал дважды.', how: 'Sel → Routing → Grp Sends; Routing → Main: снять LR' });
      steps.push({ layer: 'dig', title: 'Мастер Group 1/2', detail: 'Общая обработка (например, компрессор на барабаны) и общий фейдер.' });
      steps.push({ layer: 'dig', title: 'Group → LR', detail: 'Группа назначена на Main LR.' });
      steps.push(...speakerSteps(s, outSocket('LR'), 'порталов'));
      notes.push('Группу можно перевести в Mix Mode: тогда она станет ещё одним стерео миксом (до 5 стерео миксов на Qu-24). При смене режима настройки сбрасываются.');
      break;
    case 'matrix':
      steps.push({ layer: 'dig', title: 'Mute, фейдер, назначение на LR', detail: 'Канал идёт в LR, как обычно.', how: 'Sel → Routing → Main' });
      steps.push({ layer: 'dig', title: 'LR → Matrix 1', detail: 'В матрицу отправляются LR, миксы и группы. Посыл pre или post мастера источника.', tap: 'после мастера LR', how: 'Sel мастера Matrix 1 (верхний слой фейдеров) → Routing: посылы LR, миксов, групп' });
      steps.push({ layer: 'dig', title: 'Мастер Matrix 1', detail: 'Свой PEQ, GEQ, компрессор и задержка — уровень фойе или трансляции не зависит от зала.' });
      steps.push({ layer: 'dig', title: 'Output Patch', detail: 'Матрицу назначают на Alt Out, AES, USB или выход стейджбокса.', how: 'Setup → I/O Patch → Surface (Alt/AES) или dSNAKE Out' });
      steps.push(...speakerSteps(s, rack ? 'Выход стейджбокса' : 'Alt Out (Jack TRS)', 'фойе'));
      break;
    case 'pafl':
      steps.push({ layer: 'dig', title: 'Кнопка PAFL канала', detail: 'Канал попадает в шину прослушки. До фейдера (PFL) или после (AFL) — в настройках.', tap: 'PFL / AFL', how: 'Кнопка PAFL на канале; Setup → Audio → PAFL: PFL/AFL, Additive' });
      steps.push({ layer: 'dig', title: 'Шина PAFL', detail: 'В зал не идёт. Индикаторы показывают уровень прослушиваемого канала.' });
      steps.push({ layer: 'phys', title: 'Выход Phones', detail: 'Наушники звукорежиссёра. Громкость — регулятором Phones.' });
      notes.push('PAFL — главный инструмент поиска проблем: прослушайте канал до обработки, после, посыл в монитор.');
      break;
    case 'direct':
      steps.push({ layer: 'dig', title: 'Direct Out канала', detail: 'Индивидуальный выход канала. Точка отбора выбирается в меню (по умолчанию Post Delay). Follow fader / Follow mute — общие для всех каналов.', tap: 'Post Delay (по умолчанию)', how: 'Sel → Routing → Direct Out' });
      steps.push({ layer: 'dig', title: 'Назначение: USB, dSNAKE, ME', detail: 'Direct Out отправляют на USB для мультитрек-записи, на ME-систему персонального мониторинга или на выход стейджбокса.' });
      steps.push({ layer: 'phys', title: 'Компьютер или рекордер', detail: 'USB-кабель к компьютеру или флешка в Qu-Drive.' });
      notes.push('Для записи «как с микрофона», без обработки зала, отключите Follow fader и выберите ранний источник.');
      break;
  }
  return { steps, notes: [...notes] };
}

import { useMemo, useState } from 'preact/hooks';
import { ELEMENTS, LESSONS, LEVELS, QUIZ, type ElId, type Level } from '../../assist/trainer';
import { ls } from '../../core/state';

const KEY = 'se:trainer';

/** Упрощённая схема поверхности Qu: блоки по назначению, нажатие — выбор элемента. */
function Surface({ model, hl, onPick, mark }: { model: 'qu16' | 'qu24'; hl: ElId | null; onPick: (id: ElId) => void; mark?: { id: ElId; ok: boolean } | null }) {
  const cls = (id: ElId) => `el ${hl === id ? 'hl' : ''} ${mark?.id === id ? (mark.ok ? 'ok' : 'bad') : ''}`;
  const Key = ({ id, x, y, w = 50, h = 22, t }: { id: ElId; x: number; y: number; w?: number; h?: number; t?: string }) => (
    <g class={cls(id)} onClick={() => onPick(id)} role="button" aria-label={ELEMENTS[id].label}>
      <rect x={x} y={y} width={w} height={h} rx={4} />
      <text x={x + w / 2} y={y + h / 2 + 4} text-anchor="middle">{t ?? ELEMENTS[id].label}</text>
    </g>
  );
  const strips = 8;
  const mixLabels = model === 'qu24' ? ['LR', '1', '2', '3', '4', '5/6', '7/8', '9/10', 'FX1–4', 'Grp', 'MTX'] : ['LR', '1', '2', '3', '4', '5/6', '7/8', '9/10', 'FX1', 'FX2'];
  return (
    <div class="diagram-wrap">
      <svg class="surface" viewBox="0 0 640 340" role="img" aria-label="Схема поверхности пульта">
        <rect class="body" x={2} y={2} width={636} height={336} rx={10} />
        {/* SuperStrip */}
        <g class={cls('superstrip')} onClick={() => onPick('superstrip')} role="button" aria-label="SuperStrip">
          <rect x={12} y={12} width={290} height={84} rx={6} />
          {Array.from({ length: 10 }, (_, i) => <circle cx={32 + i * 28} cy={46} r={10} class="knob" />)}
          <text x={157} y={84} text-anchor="middle">SuperStrip: Gain · HPF · Gate · PEQ · Comp · Pan</text>
        </g>
        <g class={cls('screen')} onClick={() => onPick('screen')} role="button" aria-label="Экран">
          <rect x={312} y={12} width={170} height={110} rx={6} />
          <text x={397} y={70} text-anchor="middle">Сенсорный экран</text>
        </g>
        <Key id="k-home" x={490} y={12} w={66} h={16} t="Home" />
        <Key id="k-proc" x={490} y={31} w={66} h={16} t="Processing" />
        <Key id="k-route" x={490} y={50} w={66} h={16} t="Routing" />
        <Key id="k-fx" x={490} y={69} w={66} h={16} t="FX" />
        <Key id="k-scenes" x={490} y={88} w={66} h={16} t="Scenes" />
        <Key id="k-setup" x={490} y={107} w={66} h={16} t="Setup" />
        <g class={cls('rotary')} onClick={() => onPick('rotary')} role="button" aria-label="Экранный регулятор">
          <circle cx={590} cy={40} r={22} /><text x={590} y={78} text-anchor="middle">регулятор</text>
        </g>
        <Key id="qudrive" x={566} y={92} w={62} h={30} t="USB" />

        <Key id="layers" x={12} y={106} w={90} t="Слои" />
        <Key id="assign" x={110} y={106} w={44} t="Assign" />
        <Key id="prefade" x={158} y={106} w={44} t="PreFade" />
        <Key id="copy" x={206} y={106} w={30} t="Copy" />
        <Key id="paste" x={240} y={106} w={30} t="Paste" />
        <Key id="reset" x={274} y={106} w={30} t="Reset" />
        <Key id="fn" x={312} y={130} w={40} t="Fn" />
        <Key id="softkeys" x={358} y={130} w={110} t="SoftKeys / Mute Grp" />
        <Key id="talk" x={474} y={130} w={40} t="Talk" />
        <Key id="flip" x={520} y={130} w={50} t="Flip" />
        <Key id="shutdown" x={576} y={130} w={52} t="Shut Down" />

        {/* Каналы */}
        <text class="cap" x={12} y={170}>Каналы {model === 'qu24' ? '1–24' : '1–16'} (показаны 8)</text>
        {Array.from({ length: strips }, (_, i) => {
          const x = 12 + i * 50;
          return (
            <g>
              <g class={cls('sel')} onClick={() => onPick('sel')} role="button" aria-label="Sel"><rect x={x} y={178} width={42} height={16} rx={3} /><text x={x + 21} y={190} text-anchor="middle">Sel</text></g>
              <g class={cls('pafl')} onClick={() => onPick('pafl')} role="button" aria-label="PAFL"><rect x={x} y={198} width={42} height={16} rx={3} /><text x={x + 21} y={210} text-anchor="middle">PAFL</text></g>
              <g class={cls('mute')} onClick={() => onPick('mute')} role="button" aria-label="Mute"><rect x={x} y={218} width={42} height={16} rx={3} /><text x={x + 21} y={230} text-anchor="middle">Mute</text></g>
              <g class={cls('meter')} onClick={() => onPick('meter')} role="button" aria-label="Индикатор"><rect x={x + 32} y={240} width={8} height={88} rx={2} /></g>
              <g class={cls('fader')} onClick={() => onPick('fader')} role="button" aria-label="Фейдер">
                <rect x={x + 6} y={240} width={20} height={88} rx={3} class="slot" />
                <rect x={x + 2} y={286} width={28} height={12} rx={2} class="cap-f" />
              </g>
            </g>
          );
        })}
        {/* Мастер-секция */}
        <text class="cap" x={430} y={170}>Мастер-секция</text>
        <g class={cls('mixkeys')} onClick={() => onPick('mixkeys')} role="button" aria-label="Клавиши миксов">
          <rect x={426} y={176} width={202} height={70} rx={5} />
          {mixLabels.map((l, i) => {
            const x = 432 + (i % 6) * 32;
            const y = 184 + Math.floor(i / 6) * 28;
            return <g><rect x={x} y={y} width={28} height={20} rx={3} class="mk" /><text x={x + 14} y={y + 14} text-anchor="middle" class="sm">{l}</text></g>;
          })}
        </g>
        <g class={cls('master')} onClick={() => onPick('master')} role="button" aria-label="Мастер-фейдер">
          <rect x={500} y={252} width={56} height={80} rx={5} />
          <rect x={518} y={258} width={20} height={68} rx={3} class="slot" />
          <rect x={512} y={300} width={32} height={12} rx={2} class="cap-f" />
        </g>
      </svg>
    </div>
  );
}

type Mode = 'explore' | 'lesson' | 'quiz';

export function TrainerScreen() {
  const saved = ls.get<{ model: 'qu16' | 'qu24'; done: string[]; best: number }>(KEY) ?? { model: 'qu16' as const, done: [], best: 0 };
  const [model, setModel] = useState<'qu16' | 'qu24'>(saved.model);
  const [mode, setMode] = useState<Mode>('explore');
  const [pick, setPick] = useState<ElId | null>(null);
  const [lesson, setLesson] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string[]>(saved.done);
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState({ ok: 0, n: 0 });
  const [mark, setMark] = useState<{ id: ElId; ok: boolean } | null>(null);
  const order = useMemo(() => [...QUIZ].sort(() => Math.random() - 0.5), [mode]);

  const persist = (p: Partial<{ model: 'qu16' | 'qu24'; done: string[] }>) => ls.set(KEY, { model, done, best: saved.best, ...p });
  const L = LESSONS.find((l) => l.id === lesson);
  const hl = mode === 'lesson' && L ? L.steps[step].el : mode === 'explore' ? pick : null;

  const onPick = (id: ElId) => {
    if (mode === 'explore') setPick(id);
    else if (mode === 'quiz' && !mark) {
      const ok = order[qi].el === id;
      setMark({ id: ok ? id : order[qi].el, ok });
      setScore({ ok: score.ok + (ok ? 1 : 0), n: score.n + 1 });
    } else if (mode === 'lesson') setPick(id);
  };
  const finish = () => {
    if (!L) return;
    const d = done.includes(L.id) ? done : [...done, L.id];
    setDone(d);
    persist({ done: d });
    setLesson(null);
    setStep(0);
  };

  return (
    <div class="screen">
      <a class="back no-print" href="#/m/c">‹ Помощник звукорежиссёра</a>
      <div class="mhead"><span class="code">C</span><h1>Тренажёр Qu-16 / Qu-24</h1></div>

      <div class="seg">
        <button type="button" class={model === 'qu16' ? 'on' : ''} onClick={() => { setModel('qu16'); persist({ model: 'qu16' }); }}>Qu-16</button>
        <button type="button" class={model === 'qu24' ? 'on' : ''} onClick={() => { setModel('qu24'); persist({ model: 'qu24' }); }}>Qu-24</button>
        <span />
      </div>
      <div class="seg">
        <button type="button" class={mode === 'explore' ? 'on' : ''} onClick={() => { setMode('explore'); setLesson(null); }}>Изучение</button>
        <button type="button" class={mode === 'lesson' ? 'on' : ''} onClick={() => { setMode('lesson'); setPick(null); }}>Уроки</button>
        <button type="button" class={mode === 'quiz' ? 'on' : ''} onClick={() => { setMode('quiz'); setQi(0); setScore({ ok: 0, n: 0 }); setMark(null); }}>Викторина</button>
      </div>

      <Surface model={model} hl={hl} onPick={onPick} mark={mode === 'quiz' ? mark : null} />
      <p class="hint">Схема упрощена: блоки сгруппированы по назначению, расположение примерное. Сверяйтесь с вашим пультом.</p>

      {mode === 'explore' ? (
        <section class="panel">
          {pick ? (<><b>{ELEMENTS[pick].label}</b><p>{ELEMENTS[pick].desc}</p></>) : <p class="note">Нажмите на любой элемент схемы — появится объяснение.</p>}
        </section>
      ) : null}

      {mode === 'lesson' && !L ? (
        (Object.keys(LEVELS) as Level[]).map((lv) => (
          <>
            <h2 class="h">{LEVELS[lv]} уровень</h2>
            <div class="list">
              {LESSONS.filter((l) => l.level === lv).map((l) => {
                const na = l.qu24 && model === 'qu16';
                return (
                  <button type="button" class="row" disabled={na} onClick={() => { setLesson(l.id); setStep(0); setPick(null); }}>
                    <span><b>{l.title}</b><span class="meta">{na ? 'только Qu-24: у Qu-16 нет групп и матриц' : `${l.steps.length} шагов`}</span></span>
                    <span class={done.includes(l.id) ? 'acc' : 'chev'}>{done.includes(l.id) ? '✓' : '›'}</span>
                  </button>
                );
              })}
            </div>
          </>
        ))
      ) : null}

      {mode === 'lesson' && L ? (
        <section class="panel">
          <div class="panel-h"><div class="lbl">{L.title}</div><span class="meta mono">{step + 1}/{L.steps.length}</span></div>
          <p><b>{ELEMENTS[L.steps[step].el].label}.</b> {L.steps[step].text}</p>
          {pick && pick !== L.steps[step].el ? <p class="hint">Вы нажали «{ELEMENTS[pick].label}»: {ELEMENTS[pick].desc}</p> : null}
          <div class="actions">
            <button class="btn" type="button" disabled={step === 0} onClick={() => { setStep(step - 1); setPick(null); }}>Назад</button>
            {step < L.steps.length - 1
              ? <button class="btn primary" type="button" onClick={() => { setStep(step + 1); setPick(null); }}>Дальше</button>
              : <button class="btn primary" type="button" onClick={finish}>Урок пройден</button>}
            <button class="link" type="button" onClick={() => setLesson(null)}>К списку уроков</button>
          </div>
        </section>
      ) : null}

      {mode === 'quiz' ? (
        <section class="panel">
          {qi < order.length ? (
            <>
              <div class="panel-h"><div class="lbl">Вопрос {qi + 1} из {order.length}</div><span class="meta mono">{score.ok}/{score.n}</span></div>
              <p><b>Что нажать?</b> {order[qi].q}</p>
              {mark ? (
                <>
                  <p class={mark.ok ? 'ok-t' : 'bad-t'}>{mark.ok ? 'Верно.' : `Нет. Правильно: ${ELEMENTS[order[qi].el].label}.`} {ELEMENTS[order[qi].el].desc}</p>
                  <div class="actions"><button class="btn primary" type="button" onClick={() => { setQi(qi + 1); setMark(null); }}>Следующий</button></div>
                </>
              ) : <p class="hint">Нажмите на схеме.</p>}
            </>
          ) : (
            <>
              <b>Результат: {score.ok} из {score.n}</b>
              <div class="actions"><button class="btn primary" type="button" onClick={() => { setMode('explore'); setTimeout(() => setMode('quiz'), 0); setQi(0); setScore({ ok: 0, n: 0 }); }}>Ещё раз</button></div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

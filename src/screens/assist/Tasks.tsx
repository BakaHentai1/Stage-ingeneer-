import { useState } from 'preact/hooks';
import { TASKS, score, type CheckItem, type PatchTask, type QuizTask } from '../../assist/tasks';
import { LEVELS, type Level } from '../../assist/trainer';
import type { PatchSetup } from '../../assist/patch';
import { RACKS, CONSOLES } from '../../assist/qu';
import { ls } from '../../core/state';
import { PatchEditor } from './Patching';

const DONE = 'se:tasks-done';
const stateKey = (id: string) => `se:task:${id}`;

function markDone(id: string) {
  const d = ls.get<string[]>(DONE) ?? [];
  if (!d.includes(id)) ls.set(DONE, [...d, id]);
}

function PatchTaskView({ t }: { t: PatchTask }) {
  const [p, setP] = useState<PatchSetup>(() => ls.get<PatchSetup>(stateKey(t.id)) ?? t.start());
  const [res, setRes] = useState<CheckItem[] | null>(null);
  const set = (patch: Partial<PatchSetup>) => {
    const n = { ...p, ...patch };
    setP(n);
    ls.set(stateKey(t.id), n);
    setRes(null);
  };
  const check = () => {
    const r = t.verify(p);
    setRes(r);
    if (score(r).done) markDone(t.id);
    setTimeout(() => document.getElementById('task-res')?.scrollIntoView({ behavior: 'smooth' }), 30);
  };
  const s = res ? score(res) : null;
  return (
    <>
      <section class="panel">
        <div class="lbl">Задание</div>
        <ul class="planned">{t.brief.map((b) => <li>{b}</li>)}</ul>
        <p class="meta">{CONSOLES[p.console].label}{p.rack ? ` · ${RACKS[p.rack].label}` : ''}</p>
      </section>
      <PatchEditor p={p} set={set} />
      <div class="actions">
        <button class="btn primary" type="button" onClick={check}>Проверить решение</button>
        <button class="btn" type="button" onClick={() => { const n = t.start(); setP(n); ls.set(stateKey(t.id), n); setRes(null); }}>Начать заново</button>
      </div>
      {res && s ? (
        <section class="calc" id="task-res">
          <div class="calc-h"><span>{s.done ? 'Задание выполнено' : 'Есть ошибки'}</span><small>{s.ok}/{s.total}</small></div>
          <div class="sec">
            {res.map((i) => (
              <div class={`tk-item ${i.ok ? 'ok' : 'bad'}`}>
                <b>{i.ok ? '✓' : '✗'}</b>
                <span>{i.text}{i.why ? <em> {i.why}</em> : null}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function QuizView({ t }: { t: QuizTask }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<number | null>(null);
  const [ok, setOk] = useState(0);
  if (i >= t.questions.length) {
    if (ok === t.questions.length) markDone(t.id);
    return (
      <section class="panel">
        <b>Результат: {ok} из {t.questions.length}</b>
        <div class="actions"><button class="btn primary" type="button" onClick={() => { setI(0); setOk(0); setAns(null); }}>Ещё раз</button></div>
      </section>
    );
  }
  const q = t.questions[i];
  return (
    <section class="panel">
      <div class="panel-h"><div class="lbl">Вопрос {i + 1} из {t.questions.length}</div><span class="meta mono">{ok}</span></div>
      <p><b>{q.q}</b></p>
      <div class="tk-opts">
        {q.options.map((o, k) => (
          <button type="button" class={`btn tk-opt ${ans !== null ? (k === q.right ? 'right' : k === ans ? 'wrong' : '') : ''}`} disabled={ans !== null}
            onClick={() => { setAns(k); if (k === q.right) setOk(ok + 1); }}>{o}</button>
        ))}
      </div>
      {ans !== null ? (
        <>
          <p class={ans === q.right ? 'ok-t' : 'bad-t'}>{ans === q.right ? 'Верно.' : 'Неверно.'} {q.why}</p>
          <div class="actions"><button class="btn primary" type="button" onClick={() => { setI(i + 1); setAns(null); }}>Дальше</button></div>
        </>
      ) : null}
    </section>
  );
}

export function TasksScreen() {
  const [open, setOpen] = useState<string | null>(null);
  const done = ls.get<string[]>(DONE) ?? [];
  const T = TASKS.find((t) => t.id === open);
  return (
    <div class="screen">
      {T ? <button type="button" class="back link no-print" onClick={() => setOpen(null)}>‹ Все задания</button> : <a class="back no-print" href="#/m/c">‹ Помощник звукорежиссёра</a>}
      <div class="mhead"><span class="code">C</span><h1>{T ? T.title : 'Практические задания'}</h1></div>
      {T ? (T.kind === 'patch' ? <PatchTaskView t={T} /> : <QuizView t={T} />) : (
        (Object.keys(LEVELS) as Level[]).map((lv) => {
          const list = TASKS.filter((t) => t.level === lv);
          return list.length ? (
            <>
              <h2 class="h">{LEVELS[lv]} уровень</h2>
              <div class="list">
                {list.map((t) => (
                  <button type="button" class="row" onClick={() => setOpen(t.id)}>
                    <span><b>{t.title}</b><span class="meta">{t.kind === 'quiz' ? `${t.questions.length} вопросов` : 'собрать патч, проверка с объяснением'}</span></span>
                    <span class={done.includes(t.id) ? 'acc' : 'chev'}>{done.includes(t.id) ? '✓' : '›'}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null;
        })
      )}
    </div>
  );
}

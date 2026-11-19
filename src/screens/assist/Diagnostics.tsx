import { useState } from 'preact/hooks';
import { PROBLEMS, STAGES, type DiagNode } from '../../assist/diag';

const ORDER = Object.keys(STAGES) as DiagNode['stage'][];

export function DiagnosticsScreen() {
  const [pid, setPid] = useState<string | null>(null);
  const [hist, setHist] = useState<{ node: string; answer?: string }[]>([]);
  const P = PROBLEMS.find((p) => p.id === pid);

  if (!P) {
    return (
      <div class="screen">
        <a class="back no-print" href="#/m/c">‹ Помощник звукорежиссёра</a>
        <div class="mhead"><span class="code">C</span><h1>Диагностика</h1></div>
        <p class="note">Выберите проблему. Проверка идёт по пути сигнала: от источника к акустике, по одному вопросу.</p>
        <div class="list">
          {PROBLEMS.map((p) => (
            <button type="button" class="row" onClick={() => { setPid(p.id); setHist([{ node: p.start }]); }}>
              <span><b>{p.title}</b><span class="meta">{p.short}</span></span><span class="chev">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const cur = hist[hist.length - 1];
  const n = P.nodes[cur.node];
  const visited = new Set(hist.map((h) => P.nodes[h.node].stage));
  const answer = (label: string, next: string) => {
    const h = [...hist];
    h[h.length - 1] = { ...cur, answer: label };
    setHist([...h, { node: next }]);
  };

  return (
    <div class="screen">
      <button type="button" class="back link no-print" onClick={() => setPid(null)}>‹ Все проблемы</button>
      <div class="mhead"><span class="code">C</span><h1>{P.title}</h1></div>

      <div class="dg-path" aria-label="Путь сигнала">
        {ORDER.map((s) => <span class={`dg-st ${s === n.stage ? 'cur' : visited.has(s) ? 'seen' : ''}`}>{STAGES[s]}</span>)}
      </div>

      {hist.length > 1 ? (
        <ol class="dg-hist">
          {hist.slice(0, -1).map((h) => <li><span>{P.nodes[h.node].q}</span> <b>{h.answer}</b></li>)}
        </ol>
      ) : null}

      <section class={`panel ${n.fix ? 'dg-fix' : ''}`}>
        <div class="lbl">{STAGES[n.stage]}</div>
        {n.q ? <p class="dg-q">{n.q}</p> : null}
        {n.hint ? <p class="hint">{n.hint}</p> : null}
        {n.fix ? <p class="dg-q">{n.fix}</p> : null}
        {n.danger ? <div class="alert crit"><b>!</b><span>{n.danger}</span></div> : null}
        {n.answers ? (
          <div class="actions">
            {n.answers.map((a) => <button class="btn primary" type="button" onClick={() => answer(a.label, a.next)}>{a.label}</button>)}
          </div>
        ) : null}
        <div class="actions">
          {hist.length > 1 ? <button class="btn" type="button" onClick={() => setHist(hist.slice(0, -1).map((h, i, a) => (i === a.length - 1 ? { node: h.node } : h)))}>Шаг назад</button> : null}
          {n.fix ? <button class="btn" type="button" onClick={() => setHist([{ node: P.start }])}>Проблема осталась — начать заново</button> : null}
        </div>
      </section>
    </div>
  );
}

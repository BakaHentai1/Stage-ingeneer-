import type { CalcTable, Figure, Pt } from '../calc/types';

const W = 600;
const f1 = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

/** Рисунки карточки расчёта (SVG). Все размеры в метрах переводятся в пиксели одним масштабом. */
export function FigureView({ f }: { f: Figure }) {
  return (
    <figure class="fig">
      <figcaption>{f.title}</figcaption>
      <div class="diagram-wrap">{draw(f)}</div>
    </figure>
  );
}

function draw(f: Figure) {
  switch (f.kind) {
    case 'side': return <Side f={f} />;
    case 'plan': return <Plan f={f} />;
    case 'chart': return <Chart f={f} />;
    case 'bars': return <Bars f={f} />;
    case 'wiring': return <Wiring f={f} />;
    case 'timeline': return <Timeline f={f} />;
  }
}

/* ---------- Вид сбоку ---------- */
function Side({ f }: { f: Extract<Figure, { kind: 'side' }> }) {
  const zoom = f.audience.x2 <= f.audience.x1;
  const xs = [0, f.audience.x2, ...f.boxes.map((b) => b.c.x - b.d), ...f.rays.map((r) => r.to.x)];
  const ys = [...f.boxes.map((b) => b.c.y), ...f.rays.map((r) => r.to.y)];
  const xMin = Math.min(...xs) - (zoom ? 0.5 : 0.5);
  const xMax = Math.max(...xs) * (zoom ? 1 : 1.04) + (zoom ? 0.6 : 0.5);
  const yLow = zoom ? Math.min(...ys) - 0.2 : 0;
  const yMax = zoom ? Math.max(...ys) + 0.3 - yLow : Math.max(f.top, 2) * 1.1;
  const pad = 28;
  // Один масштаб по обеим осям, чтобы углы на рисунке были настоящими.
  const k = Math.min((W - pad * 2) / (xMax - xMin), (420 - pad * 2) / yMax);
  const H = Math.max(zoom ? 120 : 200, yMax * k + pad * 2);
  const ky = k;
  const X = (x: number) => pad + (x - xMin) * k;
  const Y = (y: number) => H - pad - (y - yLow) * ky;
  return (
    <svg class="diagram fg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={f.title}>
      {zoom ? null : <>
        <line class="floor" x1={X(xMin)} y1={Y(0)} x2={X(xMax)} y2={Y(0)} />
        <line class="aud" x1={X(f.audience.x1)} y1={Y(f.audience.y)} x2={X(f.audience.x2)} y2={Y(f.audience.y)} />
        <text class="lbl" x={X((f.audience.x1 + f.audience.x2) / 2)} y={Y(f.audience.y) + 14} text-anchor="middle">зрители (уши)</text>
      </>}
      {f.rays.map((r) => <line class={`ray r-${r.tone}`} x1={X(r.from.x)} y1={Y(r.from.y)} x2={X(r.to.x)} y2={Y(r.to.y)} />)}
      {f.boxes.map((b) => {
        // Прямоугольник кабинета, повернутый на наклон оси (вниз — по часовой в SVG).
        const w = b.d * k, h = b.h * ky;
        return (
          <g transform={`translate(${X(b.c.x)},${Y(b.c.y)}) rotate(${b.tilt})`}>
            <rect class="cab" x={-w} y={-h / 2} width={w} height={h} />
          </g>
        );
      })}
      {f.boxes.map((b) => (b.label ? <text class="lbl" x={X(b.c.x - b.d) - 4} y={Y(b.c.y) + 4} text-anchor="end">{b.label}</text> : null))}
      {(f.marks ?? []).map((m) => (
        <g>
          <circle class={`dot d-${m.tone ?? 'ok'}`} cx={X(m.x)} cy={Y(m.y)} r={3.5} />
          <text class="lbl" x={X(m.x)} y={Y(m.y) - 8} text-anchor="middle">{m.text}</text>
        </g>
      ))}
      {zoom ? null : <text class="lbl" x={pad} y={14}>высота, м: 0…{f1(yMax)} · дальность, м: 0…{f1(xMax)}</text>}
    </svg>
  );
}

/* ---------- Вид сверху ---------- */
function Plan({ f }: { f: Extract<Figure, { kind: 'plan' }> }) {
  const pad = 24;
  const k = Math.min((W - pad * 2) / f.room.w, 380 / f.room.d);
  const H = f.room.d * k + pad * 2 + 18;
  const X = (x: number) => W / 2 + x * k;
  const Y = (y: number) => pad + 18 + y * k;
  const R = Math.hypot(f.room.w, f.room.d) * 1.2;
  const id = `clip${Math.round(f.room.w * 100)}x${Math.round(f.room.d * 100)}`;
  const wedge = (p: Pt, aim: number, spread: number) => {
    const a1 = ((aim - spread / 2) * Math.PI) / 180, a2 = ((aim + spread / 2) * Math.PI) / 180;
    const e1 = { x: p.x + R * Math.sin(a1), y: p.y + R * Math.cos(a1) };
    const e2 = { x: p.x + R * Math.sin(a2), y: p.y + R * Math.cos(a2) };
    return `M${X(p.x)},${Y(p.y)} L${X(e1.x)},${Y(e1.y)} L${X(e2.x)},${Y(e2.y)} Z`;
  };
  return (
    <svg class="diagram fg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={f.title}>
      <defs><clipPath id={id}><rect x={X(-f.room.w / 2)} y={Y(0)} width={f.room.w * k} height={f.room.d * k} /></clipPath></defs>
      <rect class="room" x={X(-f.room.w / 2)} y={Y(0)} width={f.room.w * k} height={f.room.d * k} />
      <text class="lbl" x={W / 2} y={pad + 8} text-anchor="middle">СЦЕНА</text>
      <g clip-path={f.noClip ? undefined : `url(#${id})`}>
        {f.sources.filter((s) => s.spread > 0).map((s) => <path class={`cone c-${s.tone ?? 'main'}`} d={wedge(s.p, s.aim, s.spread)} />)}
        {(f.zones ?? []).map((z) => <circle class={`zone-c z-${z.tone}`} cx={X(z.p.x)} cy={Y(z.p.y)} r={z.r * k} />)}
        {(f.lines ?? []).map((l) => <line class={`pl l-${l.tone}`} x1={X(l.a.x)} y1={Y(l.a.y)} x2={X(l.b.x)} y2={Y(l.b.y)} />)}
      </g>
      {(f.lines ?? []).filter((l) => l.label).map((l) => (
        <text class="lbl" x={X((l.a.x + l.b.x) / 2) + 4} y={Y((l.a.y + l.b.y) / 2) - 4}>{l.label}</text>
      ))}
      {f.sources.map((s) => (
        <g>
          <rect class={`src-b c-${s.tone ?? 'main'}`} x={X(s.p.x) - 6} y={Y(s.p.y) - 5} width={12} height={10} rx={2} />
          <text class="lbl" x={X(s.p.x)} y={Y(s.p.y) + 17} text-anchor="middle">{s.label}</text>
        </g>
      ))}
      {(f.marks ?? []).map((m) => (
        <g>
          <circle class={`dot d-${m.tone ?? 'ok'}`} cx={X(m.p.x)} cy={Y(m.p.y)} r={3.5} />
          <text class="lbl" x={X(m.p.x) + 6} y={Y(m.p.y) + 4}>{m.text}</text>
        </g>
      ))}
      <text class="lbl" x={X(f.room.w / 2)} y={H - 4} text-anchor="end">{f1(f.room.w)} × {f1(f.room.d)} м</text>
    </svg>
  );
}

/* ---------- График ---------- */
function niceTicks(min: number, max: number, n = 5): number[] {
  const span = max - min;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function Chart({ f }: { f: Extract<Figure, { kind: 'chart' }> }) {
  const H = 260, l = 44, r = 12, t = 14, b = 34;
  const lx = (v: number) => (f.x.log ? Math.log10(v) : v);
  const x0 = lx(f.x.min), x1 = lx(f.x.max);
  const X = (v: number) => l + ((lx(v) - x0) / (x1 - x0)) * (W - l - r);
  const Y = (v: number) => t + (1 - (v - f.y.min) / (f.y.max - f.y.min)) * (H - t - b);
  const xt = f.x.log
    ? [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].filter((v) => v >= f.x.min && v <= f.x.max)
    : niceTicks(f.x.min, f.x.max);
  const yt = niceTicks(f.y.min, f.y.max);
  const clampY = (v: number) => Math.max(f.y.min, Math.min(f.y.max, v));
  return (
    <svg class="diagram fg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={f.title}>
      {yt.map((v) => <g><line class="grid" x1={l} x2={W - r} y1={Y(v)} y2={Y(v)} /><text class="lbl" x={l - 4} y={Y(v) + 3} text-anchor="end">{f1(v)}</text></g>)}
      {xt.map((v) => <g><line class="grid" y1={t} y2={H - b} x1={X(v)} x2={X(v)} /><text class="lbl" x={X(v)} y={H - b + 13} text-anchor="middle">{f1(v)}</text></g>)}
      <text class="lbl" x={W - r} y={H - 4} text-anchor="end">{f.x.label}</text>
      <text class="lbl" x={4} y={10}>{f.y.label}</text>
      {(f.hlines ?? []).filter((h) => h.y >= f.y.min && h.y <= f.y.max).map((h) => (
        <g><line class={`pl l-${h.tone}`} x1={l} x2={W - r} y1={Y(h.y)} y2={Y(h.y)} /><text class="lbl" x={W - r - 2} y={Y(h.y) - 3} text-anchor="end">{h.label}</text></g>
      ))}
      {(f.vlines ?? []).filter((h) => h.x >= f.x.min && h.x <= f.x.max).map((h) => (
        <g><line class={`pl l-${h.tone}`} y1={t} y2={H - b} x1={X(h.x)} x2={X(h.x)} /><text class="lbl" x={X(h.x) + 3} y={t + 10}>{h.label}</text></g>
      ))}
      {f.series.map((s) => (
        <polyline class={`ser s-${s.tone} ${s.dash ? 'dash' : ''}`} points={s.pts.filter(([x]) => x >= f.x.min && x <= f.x.max).map(([x, y]) => `${X(x)},${Y(clampY(y))}`).join(' ')} />
      ))}
      <g transform={`translate(${l + 6},${t + 6})`}>
        {f.series.map((s, i) => (
          <g transform={`translate(0,${i * 14})`}>
            <line class={`ser s-${s.tone} ${s.dash ? 'dash' : ''}`} x1={0} x2={16} y1={4} y2={4} />
            <text class="t" x={20} y={8}>{s.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- Столбцы ---------- */
function Bars({ f }: { f: Extract<Figure, { kind: 'bars' }> }) {
  const W = 380, row = 34, l = 6, lab = 150, r = 74;
  const H = f.bars.length * row + 16 + (f.ref ? 14 : 0);
  const max = Math.max(...f.bars.map((b) => b.value), f.ref?.value ?? 0) * 1.05 || 1;
  const X = (v: number) => l + lab + (v / max) * (W - l - lab - r);
  return (
    <svg class="diagram fg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={f.title}>
      {f.bars.map((b, i) => (
        <g transform={`translate(0,${8 + i * row})`}>
          <text class="t" x={l} y={13}>{b.label.length > 22 ? b.label.slice(0, 21) + '…' : b.label}</text>
          {b.note ? <text class="lbl" x={l} y={26}>{b.note.length > 26 ? b.note.slice(0, 25) + '…' : b.note}</text> : null}
          <rect class={`bar s-${b.tone}`} x={X(0)} y={4} width={Math.max(1, X(Math.max(0, b.value)) - X(0))} height={14} rx={2} />
          <text class="t" x={X(Math.max(0, b.value)) + 4} y={15}>{f1(b.value)} {f.unit}</text>
        </g>
      ))}
      {f.ref ? (
        <g>
          <line class="pl l-crit" x1={X(f.ref.value)} x2={X(f.ref.value)} y1={4} y2={H - 14} />
          <text class="lbl" x={X(f.ref.value)} y={H - 3} text-anchor="middle">{f.ref.label}</text>
        </g>
      ) : null}
    </svg>
  );
}

/* ---------- Схема соединения кабинетов ---------- */
function Wiring({ f }: { f: Extract<Figure, { kind: 'wiring' }> }) {
  const shown = f.groups.slice(0, 6);
  const rows = Math.min(6, Math.max(...shown.map((g) => g.length)));
  const bw = 62, bh = 30, gap = 14;
  const top = 34, ampW = 96;
  const H = top + rows * (bh + gap) + 40;
  const col = (i: number) => ampW + 50 + i * (bw + 26);
  const plusY = top - 12, minusY = H - 18;
  const lastX = col(shown.length - 1) + bw / 2;
  return (
    <svg class="diagram fg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={f.title}>
      <rect class="box" x={8} y={H / 2 - 30} width={ampW} height={60} rx={6} />
      <text class="t" x={8 + ampW / 2} y={H / 2 - 4} text-anchor="middle">{f.amp}</text>
      <text class="lbl" x={8 + ampW / 2} y={H / 2 + 12} text-anchor="middle">канал</text>
      <path class="w-plus" d={`M${8 + ampW},${H / 2 - 14} H${ampW + 26} V${plusY} H${lastX}`} />
      <path class="w-minus" d={`M${8 + ampW},${H / 2 + 14} H${ampW + 32} V${minusY} H${lastX}`} />
      <text class="lbl" x={ampW + 12} y={plusY - 4}>+</text>
      <text class="lbl" x={ampW + 12} y={minusY + 14}>−</text>
      {shown.map((g, i) => {
        const x = col(i), cx = x + bw / 2;
        const items = g.slice(0, rows);
        const lastY = top + (items.length - 1) * (bh + gap) + bh;
        return (
          <g>
            <line class="w-plus" x1={cx} x2={cx} y1={plusY} y2={top} />
            {items.map((s, j) => {
              const y = top + j * (bh + gap);
              return (
                <g>
                  <rect class="node spk" x={x} y={y} width={bw} height={bh} rx={4} />
                  <text class="t" x={cx} y={y + 19} text-anchor="middle">{s}</text>
                  {j < items.length - 1 ? <line class="w-ser" x1={cx} x2={cx} y1={y + bh} y2={y + bh + gap} /> : null}
                </g>
              );
            })}
            <line class="w-minus" x1={cx} x2={cx} y1={lastY} y2={minusY} />
            {g.length > rows ? <text class="lbl" x={cx} y={lastY + 12} text-anchor="middle">…ещё {g.length - rows}</text> : null}
          </g>
        );
      })}
      {f.groups.length > shown.length ? <text class="lbl" x={W - 8} y={H / 2} text-anchor="end">…ещё групп: {f.groups.length - shown.length}</text> : null}
    </svg>
  );
}

/* ---------- Время прихода ---------- */
function Timeline({ f }: { f: Extract<Figure, { kind: 'timeline' }> }) {
  const W = 380, H = 60 + f.events.length * 22, l = 16, r = 16;
  const X = (t: number) => l + (t / f.span) * (W - l - r);
  return (
    <svg class="diagram fg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={f.title}>
      <line class="floor" x1={l} x2={W - r} y1={30} y2={30} />
      {niceTicks(0, f.span).map((v) => <g><line class="grid" x1={X(v)} x2={X(v)} y1={26} y2={H - 6} /><text class="lbl" x={X(v)} y={20} text-anchor="middle">{f1(v)} мс</text></g>)}
      {f.events.map((e, i) => (
        <g>
          <circle class={`dot d-${e.tone === 'accent' ? 'warn' : e.tone === 'info' ? 'ok' : e.tone}`} cx={X(e.t)} cy={30} r={5} />
          <line class={`pl l-muted`} x1={X(e.t)} x2={X(e.t)} y1={30} y2={50 + i * 22} />
          <text class="t" x={X(e.t) > W / 2 ? X(e.t) - 4 : X(e.t) + 4} text-anchor={X(e.t) > W / 2 ? 'end' : 'start'} y={54 + i * 22}>{e.label}: {f1(e.t)} мс</text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Таблица ---------- */
export function TableView({ t }: { t: CalcTable }) {
  return (
    <div class="fig">
      <div class="figcap">{t.title}</div>
      <div class="tbl">
        <table style={{ minWidth: `${Math.min(520, t.head.length * 92)}px` }}>
          <thead><tr>{t.head.map((h) => <th>{h}</th>)}</tr></thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr class={t.mark === i ? 'mark' : ''}>{r.map((c) => <td class={typeof c === 'number' ? 'mono' : ''}>{typeof c === 'number' ? f1(c) : c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.note ? <p class="note">{t.note}</p> : null}
    </div>
  );
}

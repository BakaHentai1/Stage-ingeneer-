import { useMemo, useState } from 'preact/hooks';
import { checkBuild, DEVICES, portOf, sampleBuild, SIG_LABEL, type Build, type DevType, type Role } from '../../assist/builder';
import { uid } from '../../assist/patch';
import { ls } from '../../core/state';

const KEY = 'se:builder';
const COLS: Role[] = ['source', 'stage', 'console', 'amp', 'speaker'];
const COL_LABEL: Record<Role, string> = { source: 'Источники', stage: 'Сцена', console: 'Пульт', amp: 'Усилители', speaker: 'Акустика' };
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Обзорная схема: устройства по колонкам, кабели линиями. */
function Overview({ b, levels }: { b: Build; levels: Map<string, string> }) {
  const colW = 128;
  const W = colW * COLS.length;
  const pos = new Map<string, { x: number; y: number }>();
  let maxRows = 1;
  COLS.forEach((c, ci) => {
    const list = b.devs.filter((d) => DEVICES[d.type].role === c);
    maxRows = Math.max(maxRows, list.length);
    list.forEach((d, k) => pos.set(d.id, { x: ci * colW + 6, y: 30 + k * 40 }));
  });
  const H = 40 + maxRows * 40;
  return (
    <div class="diagram-wrap">
      <svg class="diagram" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Схема соединений">
        {COLS.map((c, ci) => <text class="zone" x={ci * colW + 6} y={16}>{COL_LABEL[c].toUpperCase()}</text>)}
        {b.links.map((l) => {
          const A = pos.get(l.a.dev);
          const B = pos.get(l.b.dev);
          if (!A || !B) return null;
          const lv = levels.get(l.id) ?? 'ok';
          const [p, q] = A.x <= B.x ? [A, B] : [B, A];
          const x1 = p.x + 114, y1 = p.y + 15, x2 = q.x, y2 = q.y + 15;
          const same = p.x === q.x;
          const d = same ? `M${p.x + 114},${y1} C${p.x + 128},${y1} ${p.x + 128},${q.y + 15} ${p.x + 114},${q.y + 15}` : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
          const pa = portOf(b, l.a);
          return <path d={d} class={`bl ${lv} sig-${pa?.port.sig ?? 'line'}`} fill="none" />;
        })}
        {b.devs.map((d) => {
          const p = pos.get(d.id)!;
          return (
            <g>
              <rect class={`node ${DEVICES[d.type].role === 'console' ? 'ch' : ''}`} x={p.x} y={p.y} width={114} height={30} rx={5} />
              <text class="t" x={p.x + 6} y={p.y + 13}>{cut(d.name, 17)}</text>
              <text class="lbl" x={p.x + 6} y={p.y + 25}>{cut(DEVICES[d.type].label, 20)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function BuilderScreen() {
  const [b, setB] = useState<Build>(() => ls.get<Build>(KEY) ?? sampleBuild());
  const [pending, setPending] = useState<{ dev: string; port: string } | null>(null);
  const [addType, setAddType] = useState<DevType>('mic-dyn');
  const res = useMemo(() => checkBuild(b), [b]);
  const levels = new Map(res.links.map((l) => [l.id, l.level]));
  const save = (n: Build) => { setB(n); ls.set(KEY, n); };

  const portUsed = (dev: string, port: string) => b.links.find((l) => (l.a.dev === dev && l.a.port === port) || (l.b.dev === dev && l.b.port === port));
  const tapPort = (dev: string, port: string) => {
    if (!pending) return setPending({ dev, port });
    if (pending.dev === dev && pending.port === port) return setPending(null);
    if (pending.dev === dev) return setPending({ dev, port });
    save({ ...b, links: [...b.links, { id: uid('l'), a: pending, b: { dev, port } }] });
    setPending(null);
  };
  const pend = pending ? portOf(b, pending) : null;

  return (
    <div class="screen">
      <a class="back no-print" href="#/m/c">‹ Помощник звукорежиссёра</a>
      <div class="mhead"><span class="code">C</span><h1>Конструктор коммутации</h1></div>
      <div class="alert info no-print"><b>i</b><span><p>Добавьте оборудование, затем соедините кабелем: нажмите порт одного устройства, потом порт другого. Приложение проверит каждое соединение и всю схему.</p></span></div>

      <section class="panel no-print">
        <div class="form">
          <label class="field wide" for="b-add"><span class="fl">Оборудование</span>
            <select id="b-add" value={addType} onChange={(e) => setAddType((e.currentTarget as HTMLSelectElement).value as DevType)}>
              {(Object.keys(DEVICES) as DevType[]).map((t) => <option value={t}>{DEVICES[t].label}</option>)}
            </select>
          </label>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" onClick={() => save({ ...b, devs: [...b.devs, { id: uid('d'), type: addType, name: `${DEVICES[addType].label} ${b.devs.filter((d) => d.type === addType).length + 1}` }] })}>+ Добавить</button>
          <button class="btn" type="button" onClick={() => { save(sampleBuild()); setPending(null); }}>Пример</button>
          <button class="btn" type="button" onClick={() => { save({ devs: [], links: [] }); setPending(null); }}>Очистить</button>
        </div>
      </section>

      <Overview b={b} levels={levels} />
      <div class="sp-legend"><span><i class="bl-ok" />правильно</span><span><i class="bl-warn" />спорно</span><span><i class="bl-crit" />ошибка</span></div>

      {pend ? <div class="alert warn no-print"><b>→</b><span>Выбран «{pend.dev.name}: {pend.port.label}» ({SIG_LABEL[pend.port.sig]}). Нажмите порт другого устройства. <button class="link" type="button" onClick={() => setPending(null)}>Отмена</button></span></div> : null}

      <div class="bd-list no-print">
        {COLS.flatMap((c) => b.devs.filter((d) => DEVICES[d.type].role === c)).map((d) => {
          const def = DEVICES[d.type];
          return (
            <div class="pt">
              <div class="pt-top">
                <input aria-label="Название" class="pt-name" value={d.name} onInput={(e) => save({ ...b, devs: b.devs.map((x) => (x.id === d.id ? { ...x, name: (e.currentTarget as HTMLInputElement).value } : x)) })} />
                <button class="icon-btn danger" type="button" aria-label="Удалить" onClick={() => save({ devs: b.devs.filter((x) => x.id !== d.id), links: b.links.filter((l) => l.a.dev !== d.id && l.b.dev !== d.id) })}>×</button>
              </div>
              <div class="meta">{def.label}{def.note ? ` · ${def.note}` : ''}</div>
              <div class="bd-ports">
                {def.ports.map((p) => {
                  const u = portUsed(d.id, p.id);
                  const sel = pending?.dev === d.id && pending.port === p.id;
                  return (
                    <button type="button" class={`bd-port d-${p.dir} s-${p.sig} ${u ? 'used' : ''} ${sel ? 'sel' : ''}`} onClick={() => tapPort(d.id, p.id)} title={SIG_LABEL[p.sig]}>
                      {p.dir === 'in' ? '→ ' : p.dir === 'out' ? '' : '⇄ '}{p.label}{p.dir === 'out' ? ' →' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <section class="calc">
        <div class="calc-h"><span>Проверка схемы</span><small>{b.links.length} кабелей</small></div>
        <div class="sec">
          {res.issues.map((v) => <div class={`alert ${v.level === 'ok' ? 'info' : v.level}`}><b>{v.level === 'ok' ? '✓' : v.level === 'info' ? 'i' : '!'}</b><span>{v.text}</span></div>)}
        </div>
        {res.links.length ? (
          <div class="sec">
            <div class="lbl">Кабели</div>
            {res.links.map((l) => {
              const A = portOf(b, l.a)!;
              const B = portOf(b, l.b)!;
              return (
                <div class={`tk-item ${l.level === 'crit' ? 'bad' : l.level === 'warn' ? 'warn' : 'ok'}`}>
                  <b>{l.level === 'crit' ? '✗' : l.level === 'warn' ? '!' : '✓'}</b>
                  <span>{A.dev.name}: {A.port.label} — {B.dev.name}: {B.port.label}<em> {l.text}</em></span>
                  <button class="icon-btn danger no-print" type="button" aria-label="Убрать кабель" onClick={() => save({ ...b, links: b.links.filter((x) => x.id !== l.id) })}>×</button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}

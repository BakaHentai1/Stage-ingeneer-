import { useMemo, useState } from 'preact/hooks';
import {
  autoAssign, busOptions, checkPatch, defaultPatch, DEST_KINDS, IN_KINDS, presetBand, presetConference, socketsAvailable, uid,
  type DestKind, type InKind, type InSource, type OutRow, type PatchResult, type PatchSetup,
} from '../../assist/patch';
import { CONSOLES, RACKS, findBus, type RackId } from '../../assist/qu';
import { ls, toast, useCurrentProject } from '../../core/state';
import { saveDoc } from '../../core/db';
import { downloadText, safeName, stamp } from '../../core/download';
import { toCsv } from '../../core/csv';
import { NewProjectForm } from '../../ui/ProjectPicker';
import { NumField, Select } from '../../ui/Fields';
import { RouteLegend } from './Routing';

export const PATCH_KEY = 'se:patch';

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Схема патча: источник → физический разъём → канал пульта. */
function PatchMap({ res, p }: { res: PatchResult; p: PatchSetup }) {
  const rows = res.inputs.flatMap((r) => r.sockets.length === r.channels.length
    ? r.sockets.map((s, i) => ({ name: r.src.name + (r.sockets.length > 1 ? (i ? ' R' : ' L') : ''), sock: s, ch: r.channels[i], id: r.src.id }))
    : [{ name: r.src.name, sock: r.sockets[0], ch: r.channels[0], id: r.src.id }]);
  const outs = res.outputs;
  const bad = new Set(res.warnings.filter((w) => w.level === 'crit' && w.row).map((w) => w.row));
  const RH = 22;
  const W = 360;
  const x1 = 4, w1 = 112, x2 = 132, w2 = 104, x3 = 252, w3 = 104;
  const inTop = 30;
  const outTop = inTop + rows.length * RH + 46;
  const H = outTop + outs.length * RH + 8;
  return (
    <div class="diagram-wrap">
      <svg class="diagram pm" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Схема патча">
        <text class="zone" x={x1} y={14}>ИСТОЧНИК</text>
        <text class="zone" x={x2} y={14}>РАЗЪЁМ</text>
        <text class="zone" x={x3} y={14}>КАНАЛ</text>
        {rows.map((r, k) => {
          const y = inTop + k * RH;
          const err = bad.has(r.id);
          return (
            <g>
              <rect class="node" x={x1} y={y} width={w1} height={RH - 5} rx={4} />
              <text class="t" x={x1 + 5} y={y + 12}>{cut(r.name, 17)}</text>
              <line class="w-mic" x1={x1 + w1} y1={y + 8} x2={x2} y2={y + 8} />
              <rect class={`node ${err ? 'bad' : ''}`} x={x2} y={y} width={w2} height={RH - 5} rx={4} />
              <text class="t" x={x2 + 5} y={y + 12}>{cut(r.sock.replace(' (задняя панель)', '').replace('Mic/Line', 'Mic'), 16)}</text>
              <line class={`w-dig ${err ? 'bad' : ''}`} x1={x2 + w2} y1={y + 8} x2={x3} y2={y + 8} />
              <rect class={`node ch ${err ? 'bad' : ''}`} x={x3} y={y} width={w3} height={RH - 5} rx={4} />
              <text class="t" x={x3 + 5} y={y + 12}>{r.ch}</text>
            </g>
          );
        })}
        <text class="zone" x={x1} y={outTop - 14}>ШИНА</text>
        <text class="zone" x={x2} y={outTop - 14}>РАЗЪЁМ</text>
        <text class="zone" x={x3} y={outTop - 14}>КУДА</text>
        {outs.map((o, k) => {
          const y = outTop + k * RH;
          const err = bad.has(o.id);
          return (
            <g>
              <rect class="node ch" x={x1} y={y} width={w1} height={RH - 5} rx={4} />
              <text class="t" x={x1 + 5} y={y + 12}>{cut(o.signal, 17)}</text>
              <line class={`w-dig ${err ? 'bad' : ''}`} x1={x1 + w1} y1={y + 8} x2={x2} y2={y + 8} />
              <rect class={`node ${err ? 'bad' : ''}`} x={x2} y={y} width={w2} height={RH - 5} rx={4} />
              <text class="t" x={x2 + 5} y={y + 12}>{cut(o.socketLabel.replace(' (Main)', '').replace(' (2×Jack TRS)', '').replace(' (XLR, цифровой)', '').replace(' (Jack TRS)', ''), 16)}</text>
              <line class="w-line" x1={x2 + w2} y1={y + 8} x2={x3} y2={y + 8} marker-end="url(#pm-arr)" />
              <rect class="node spk" x={x3} y={y} width={w3} height={RH - 5} rx={4} />
              <text class="t" x={x3 + 5} y={y + 12}>{cut(o.name, 16)}</text>
            </g>
          );
        })}
        <defs>
          <marker id="pm-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" class="arrow" />
          </marker>
        </defs>
      </svg>
      <p class="hint pm-hint">Оранжевая линия — кабель, зелёная — назначение в меню пульта. {p.rack ? 'Вход стейджбокса можно назначить на любой канал.' : 'Локальный вход всегда приходит на канал с тем же номером.'}</p>
    </div>
  );
}

export function patchRows(p: PatchSetup, res: PatchResult): (string | number)[][] {
  const rows: (string | number)[][] = [[`Патч, ${CONSOLES[p.console].label}`, p.rack ? `стейджбокс ${p.rack}, Cat5e ${p.snakeLen} м` : 'без стейджбокса']];
  rows.push([]);
  rows.push(['Input Patch']);
  rows.push(['Канал', 'Источник', 'Тип', 'Физический разъём', '48 В', 'Кабель']);
  res.inputs.forEach((r) => rows.push([r.channels.join('+'), r.src.name, IN_KINDS[r.src.kind].label, r.sockets.join(', '), r.phantom ? 'да' : '', r.cable]));
  rows.push([]);
  rows.push(['Output Patch']);
  rows.push(['Разъём', 'Сигнал', 'Куда', 'Назначение']);
  res.outputs.forEach((o) => rows.push([o.socketLabel, o.signal, o.name, o.how]));
  rows.push([]);
  res.warnings.forEach((w) => rows.push([w.level === 'crit' ? 'Ошибка' : w.level === 'warn' ? 'Предупреждение' : 'Примечание', w.text]));
  return rows;
}

function chOptions(p: PatchSetup, stereo: boolean): [string, string][] {
  const c = CONSOLES[p.console];
  const o: [string, string][] = [];
  for (let i = 1; i <= c.mono; i++) o.push([`CH${i}`, stereo ? `CH ${i}+${i + 1}` : `CH ${i}`]);
  for (let i = 1; i <= c.stereo; i++) o.push([`ST${i}`, `ST${i}`]);
  return o;
}

export function PatchingScreen() {
  const [p, setP] = useState<PatchSetup>(() => ls.get<PatchSetup>(PATCH_KEY) ?? defaultPatch());
  const [project] = useCurrentProject();
  const [asking, setAsking] = useState(false);
  const res = useMemo(() => checkPatch(p), [p]);
  const prof = CONSOLES[p.console];

  const set = (patch: Partial<PatchSetup>) => {
    const n = { ...p, ...patch };
    setP(n);
    ls.set(PATCH_KEY, n);
  };
  const setIn = (id: string, patch: Partial<InSource>) => set({ inputs: p.inputs.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const setOut = (id: string, patch: Partial<OutRow>) => set({ outputs: p.outputs.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const socks = socketsAvailable(p);
  const crit = res.warnings.filter((w) => w.level === 'crit').length;
  const rowWarn = (id: string) => res.warnings.filter((w) => w.row === id);

  const save = async (projectId: string) => {
    await saveDoc({ projectId, kind: 'patch', title: `Патч, ${prof.label}`, data: p });
    toast('Патч сохранён в проект');
    setAsking(false);
  };

  return (
    <div class="screen">
      <a class="back no-print" href="#/m/c">‹ Помощник звукорежиссёра</a>
      <div class="mhead"><span class="code">C</span><h1>Патчинг входов и выходов</h1></div>
      {project ? <div class="print-only meta">Проект: {project.name}</div> : null}

      <div class="alert info no-print"><b>i</b><span>
        <p>Патчинг — это два слоя. <b>Физика</b>: какой кабель в какой разъём. <b>Цифра</b>: какой разъём на какой канал и какая шина на какой выход — это назначается в меню пульта.</p>
      </span></div>

      <section class="panel no-print">
        <div class="form">
          <Select id="p-con" label="Пульт" value={p.console} onChange={(v) => set({ console: v })} options={[['qu16', 'A&H Qu-16'], ['qu24', 'A&H Qu-24']]} />
          <Select id="p-rack" label="Стейджбокс" value={p.rack ?? 'none'}
            onChange={(v) => set({ rack: v === 'none' ? null : (v as RackId), inputs: v === 'none' ? p.inputs.map((s) => ({ ...s, loc: 'local' as const })) : p.inputs })}
            options={[['none', 'Нет, всё в пульт'], ...(Object.keys(RACKS) as RackId[]).map((k) => [k, RACKS[k].label] as [string, string])]} />
          {p.rack ? <NumField id="p-len" label="Cat5e до стейджбокса" unit="м" value={p.snakeLen} min={1} onChange={(n) => set({ snakeLen: n })} /> : null}
        </div>
        <div class="chips">
          <button class="chip-btn" type="button" onClick={() => set(presetBand(p.console))}>Пример: группа</button>
          <button class="chip-btn" type="button" onClick={() => set(presetConference(p.console))}>Пример: конференция</button>
          <button class="chip-btn" type="button" onClick={() => set({ inputs: autoAssign(p) })}>Расставить входы по порядку</button>
        </div>
      </section>

      <section class="panel no-print">
        <div class="panel-h"><div class="lbl">Входы ({p.inputs.length})</div></div>
        <div class="pt-list">
          {p.inputs.map((s) => (
            <div class={`pt ${rowWarn(s.id).some((w) => w.level === 'crit') ? 'bad' : ''}`}>
              <div class="pt-top">
                <input aria-label="Название" class="pt-name" value={s.name} onInput={(e) => setIn(s.id, { name: (e.currentTarget as HTMLInputElement).value })} />
                <button class="icon-btn danger" type="button" aria-label="Удалить" onClick={() => set({ inputs: p.inputs.filter((x) => x.id !== s.id) })}>×</button>
              </div>
              <div class="pt-grid">
                <select aria-label="Тип источника" value={s.kind} onChange={(e) => { const k = (e.currentTarget as HTMLSelectElement).value as InKind; setIn(s.id, { kind: k, phantom: IN_KINDS[k].phantom }); }}>
                  {(Object.keys(IN_KINDS) as InKind[]).map((k) => <option value={k}>{IN_KINDS[k].label}</option>)}
                </select>
                {p.rack ? (
                  <select aria-label="Куда подключён" value={s.loc} onChange={(e) => setIn(s.id, { loc: (e.currentTarget as HTMLSelectElement).value as InSource['loc'] })}>
                    <option value="rack">В стейджбокс</option>
                    <option value="local">В пульт</option>
                  </select>
                ) : null}
                {s.loc === 'rack' && p.rack ? (
                  <select aria-label="Вход стейджбокса" value={String(s.socket)} onChange={(e) => setIn(s.id, { socket: Number((e.currentTarget as HTMLSelectElement).value) })}>
                    {Array.from({ length: RACKS[p.rack].inputs }, (_, i) => <option value={String(i + 1)}>{`${p.rack} In ${i + 1}${s.stereo ? `+${i + 2}` : ''}`}</option>)}
                  </select>
                ) : null}
                <select aria-label="Канал пульта" value={s.ch} onChange={(e) => setIn(s.id, { ch: (e.currentTarget as HTMLSelectElement).value })}>
                  {chOptions(p, s.stereo).map(([v, l]) => <option value={v}>→ {l}</option>)}
                </select>
              </div>
              <div class="pt-flags">
                <label><input type="checkbox" checked={s.stereo} onChange={(e) => setIn(s.id, { stereo: (e.currentTarget as HTMLInputElement).checked })} />стерео</label>
                <label><input type="checkbox" checked={s.phantom} onChange={(e) => setIn(s.id, { phantom: (e.currentTarget as HTMLInputElement).checked })} />48V</label>
              </div>
              {rowWarn(s.id).map((w) => <div class={`pt-w ${w.level}`}>{w.text}</div>)}
            </div>
          ))}
        </div>
        <div class="actions">
          <button class="btn" type="button" onClick={() => set({ inputs: [...p.inputs, { id: uid('s'), name: `Источник ${p.inputs.length + 1}`, kind: 'dyn', stereo: false, loc: p.rack ? 'rack' : 'local', socket: 1, ch: 'CH1', phantom: false }] })}>+ Вход</button>
        </div>
      </section>

      <section class="panel no-print">
        <div class="panel-h"><div class="lbl">Выходы ({p.outputs.length})</div></div>
        <div class="pt-list">
          {p.outputs.map((o) => {
            const bus = findBus(prof, o.bus);
            const sd = socks.find((x) => x.id === o.socket);
            const needLeg = bus?.stereo && sd && !sd.stereo && !sd.fixed;
            return (
              <div class={`pt ${rowWarn(o.id).some((w) => w.level === 'crit') ? 'bad' : ''}`}>
                <div class="pt-top">
                  <input aria-label="Название" class="pt-name" value={o.name} onInput={(e) => setOut(o.id, { name: (e.currentTarget as HTMLInputElement).value })} />
                  <button class="icon-btn danger" type="button" aria-label="Удалить" onClick={() => set({ outputs: p.outputs.filter((x) => x.id !== o.id) })}>×</button>
                </div>
                <div class="pt-grid">
                  <select aria-label="Назначение" value={o.dest} onChange={(e) => setOut(o.id, { dest: (e.currentTarget as HTMLSelectElement).value as DestKind })}>
                    {(Object.keys(DEST_KINDS) as DestKind[]).map((k) => <option value={k}>{DEST_KINDS[k]}</option>)}
                  </select>
                  <select aria-label="Шина" value={o.bus} onChange={(e) => setOut(o.id, { bus: (e.currentTarget as HTMLSelectElement).value })}>
                    {busOptions(p.console).map(([v, l]) => <option value={v}>{l}</option>)}
                  </select>
                  <select aria-label="Разъём" value={o.socket} onChange={(e) => setOut(o.id, { socket: (e.currentTarget as HTMLSelectElement).value })}>
                    {socks.map((x) => <option value={x.id}>{x.label}</option>)}
                    {!sd ? <option value={o.socket}>{o.socket} (нет)</option> : null}
                  </select>
                  {needLeg ? (
                    <select aria-label="Сторона" value={o.leg ?? 'L'} onChange={(e) => setOut(o.id, { leg: (e.currentTarget as HTMLSelectElement).value as 'L' | 'R' })}>
                      <option value="L">левая (L)</option>
                      <option value="R">правая (R)</option>
                    </select>
                  ) : null}
                </div>
                {rowWarn(o.id).map((w) => <div class={`pt-w ${w.level}`}>{w.text}</div>)}
              </div>
            );
          })}
        </div>
        <div class="actions">
          <button class="btn" type="button" onClick={() => set({ outputs: [...p.outputs, { id: uid('o'), name: `Выход ${p.outputs.length + 1}`, dest: 'monitor', bus: 'Mix1', leg: null, socket: p.rack ? 'RACK:1' : 'XLR:Mix1' }] })}>+ Выход</button>
        </div>
      </section>

      <section class="calc">
        <div class="calc-h"><span>Проверка патча</span><small>{prof.label}{p.rack ? ` + ${p.rack}` : ''}</small></div>
        <div class="sec">
          {crit ? <div class="alert crit"><b>!</b><span>Ошибок: {crit}. Схема в таком виде работать не будет.</span></div>
            : <div class="alert info"><b>✓</b><span>Грубых ошибок нет: каждый источник попадает на свой канал, каждая шина — на существующий разъём.</span></div>}
          <div class="usage">
            {res.usage.map((u) => (
              <div class={`use ${u.used > u.total ? 'over' : ''}`}>
                <span class="k">{u.label}</span>
                <span class="bar"><i style={{ width: `${Math.min(100, (u.used / Math.max(1, u.total)) * 100)}%` }} /></span>
                <span class="v mono">{u.used}/{u.total}</span>
              </div>
            ))}
          </div>
        </div>
        <div class="sec">
          <div class="lbl">Схема</div>
          <RouteLegend />
          <PatchMap res={res} p={p} />
        </div>
        <div class="sec">
          <div class="lbl">Input Patch</div>
          <div class="tbl"><table>
            <thead><tr><th>Канал</th><th>Источник</th><th>Физический разъём</th><th>48V</th><th>Кабель</th></tr></thead>
            <tbody>{res.inputs.map((r) => (
              <tr><td class="mono">{r.channels.join('+')}</td><td>{r.src.name}</td><td>{r.sockets.join(', ')}</td><td>{r.phantom ? <span class="ph48">48V</span> : ''}</td><td>{r.cable}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div class="sec">
          <div class="lbl">Output Patch</div>
          <div class="tbl"><table>
            <thead><tr><th>Разъём</th><th>Сигнал</th><th>Куда</th><th>Как назначить</th></tr></thead>
            <tbody>{res.outputs.map((o) => (
              <tr><td>{o.socketLabel}</td><td class="mono">{o.signal}</td><td>{o.name}</td><td>{o.how}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div class="sec">
          <div class="lbl">Пошагово на пульте</div>
          {res.inputs.map((r) => (
            <details class="pt-how">
              <summary><span class="mono">{r.channels.join('+')}</span> {r.src.name}</summary>
              <ol>{r.how.map((h) => <li>{h}</li>)}</ol>
            </details>
          ))}
        </div>
        {res.warnings.filter((w) => !w.row).length ? (
          <div class="sec">
            <div class="lbl">Общие замечания</div>
            {res.warnings.filter((w) => !w.row).map((w) => <div class={`alert ${w.level}`}><b>{w.level === 'info' ? 'i' : '!'}</b><span>{w.text}</span></div>)}
          </div>
        ) : null}
      </section>

      <div class="no-print">
        {asking ? (
          <NewProjectForm onDone={(id) => save(id)} onCancel={() => setAsking(false)} />
        ) : (
          <div class="actions">
            <button class="btn primary" type="button" onClick={() => (project ? save(project.id) : setAsking(true))}>{project ? 'Сохранить в проект' : 'Сохранить в новый проект'}</button>
            <button class="btn" type="button" onClick={() => downloadText(`patch_${safeName(prof.label)}_${stamp()}.csv`, toCsv(patchRows(p, res)), 'text/csv')}>CSV</button>
            <button class="btn" type="button" onClick={() => window.print()}>PDF</button>
            <a class="btn" href="#/m/c/routing">Путь сигнала</a>
          </div>
        )}
      </div>
    </div>
  );
}

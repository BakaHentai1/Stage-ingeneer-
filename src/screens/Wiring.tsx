import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  defaultRig, generate, MIXERS, SOURCE_KINDS, STAGEBOXES,
  type Rig, type Source, type SourceKind,
} from '../wiring/model';
import { Diagram } from '../wiring/Diagram';
import { wiringCsv } from '../wiring/export';
import { SECTIONS } from '../calc/audio/cable';
import { ls, toast, useCurrentProject } from '../core/state';
import { saveDoc } from '../core/db';
import { downloadText, safeName, stamp } from '../core/download';
import { NewProjectForm } from '../ui/ProjectPicker';
import { fmtNum } from '../core/format';

export const WIRING_KEY = 'se:wiring';

let nid = 0;
const newId = () => `s${Date.now().toString(36)}${nid++}`;

const PRESETS: Record<string, { label: string; sources: Omit<Source, 'id'>[] }> = {
  band: { label: 'Группа', sources: defaultRig().sources },
  conf: {
    label: 'Конференция',
    sources: [
      { name: 'Радио 1', kind: 'wireless', stereo: false },
      { name: 'Радио 2', kind: 'wireless', stereo: false },
      { name: 'Трибуна', kind: 'cond', stereo: false },
      { name: 'Президиум 1', kind: 'cond', stereo: false },
      { name: 'Президиум 2', kind: 'cond', stereo: false },
      { name: 'Ноутбук', kind: 'playback', stereo: true },
    ],
  },
  dj: {
    label: 'DJ + ведущий',
    sources: [
      { name: 'DJ-пульт', kind: 'line-bal', stereo: true },
      { name: 'Ведущий', kind: 'wireless', stereo: false },
      { name: 'Ведущий 2', kind: 'wireless', stereo: false },
      { name: 'Плейбэк', kind: 'playback', stereo: true },
    ],
  },
};

function NumField({ id, label, unit, value, min = 0, max, onChange }: {
  id: string; label: string; unit?: string; value: number; min?: number; max?: number; onChange: (n: number) => void;
}) {
  const [s, setS] = useState(String(value));
  useEffect(() => {
    if (Number(s.replace(',', '.')) !== value) setS(String(value));
  }, [value]);
  const bad = !(Number.isFinite(Number(s.replace(',', '.'))) && s.trim() !== '');
  return (
    <label class="field" for={id}>
      <span class="fl">{label}{unit ? <em>, {unit}</em> : null}</span>
      <input
        id={id} type="text" inputMode="decimal" autoComplete="off" value={s} aria-invalid={bad}
        onInput={(e) => {
          const t = (e.currentTarget as HTMLInputElement).value;
          setS(t);
          const n = Number(t.replace(',', '.'));
          if (t.trim() !== '' && Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min, n)));
        }}
      />
    </label>
  );
}

function Select<T extends string>({ id, label, value, options, onChange }: {
  id: string; label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <label class="field" for={id}>
      <span class="fl">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as T)}>
        {options.map(([v, l]) => <option value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function WiringScreen() {
  const [rig, setRig] = useState<Rig>(() => ({ ...defaultRig(), ...(ls.get<Rig>(WIRING_KEY) ?? {}) }));
  const [project] = useCurrentProject();
  const [asking, setAsking] = useState(false);
  const res = useMemo(() => generate(rig), [rig]);

  const set = (patch: Partial<Rig>) => {
    const next = { ...rig, ...patch };
    setRig(next);
    ls.set(WIRING_KEY, next);
  };
  const setSrc = (id: string, patch: Partial<Source>) => set({ sources: rig.sources.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (i: number, d: number) => {
    const a = [...rig.sources];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set({ sources: a });
  };
  const title = project ? `Схема: ${project.name}` : 'Схема коммутации';
  const save = async (projectId: string) => {
    await saveDoc({ projectId, kind: 'wiring', title: `Схема коммутации, ${res.mixerLabel}`, data: rig });
    toast('Схема сохранена в проект');
    setAsking(false);
  };
  const isQu = rig.mixer !== 'analog';

  return (
    <div class="screen wiring">
      <a class="back no-print" href="#/m/b">‹ Схемы коммутации</a>
      <div class="mhead"><span class="code">B</span><h1>Генератор схем коммутации</h1></div>
      {project ? <div class="print-only meta">Проект: {project.name}</div> : null}

      <section class="panel no-print">
        <div class="lbl">Пульт и линия до FOH</div>
        <div class="form">
          <Select id="w-mixer" label="Пульт" value={rig.mixer} onChange={(v) => set({ mixer: v, transport: v === 'analog' && rig.transport === 'stagebox' ? 'multicore' : rig.transport })}
            options={[['qu16', MIXERS.qu16.label], ['qu24', MIXERS.qu24.label], ['analog', 'Аналоговый пульт']]} />
          <Select id="w-transport" label="Как сигнал идёт до пульта" value={rig.transport} onChange={(v) => set({ transport: v })}
            options={[...(isQu ? ([['stagebox', 'Цифровой стейджбокс']] as ['stagebox', string][]) : []), ['multicore', 'Аналоговый мультикор'], ['direct', 'Отдельные кабели']]} />
          {rig.mixer === 'analog' ? (
            <>
              <NumField id="w-ain" label="Входов у пульта" value={rig.analogInputs} min={1} max={64} onChange={(n) => set({ analogInputs: Math.round(n) })} />
              <NumField id="w-aux" label="AUX-выходов" value={rig.analogAux} min={0} max={16} onChange={(n) => set({ analogAux: Math.round(n) })} />
            </>
          ) : null}
          {rig.transport === 'stagebox' && isQu ? (
            <Select id="w-sb" label="Стейджбокс" value={rig.stagebox} onChange={(v) => set({ stagebox: v })}
              options={[['AR2412', STAGEBOXES.AR2412.label], ['AB168', STAGEBOXES.AB168.label]]} />
          ) : null}
          {rig.transport === 'multicore' ? (
            <>
              <NumField id="w-mci" label="Каналов мультикора" value={rig.multicoreIn} min={1} max={64} onChange={(n) => set({ multicoreIn: Math.round(n) })} />
              <NumField id="w-mcr" label="Возвратов" value={rig.multicoreRet} min={0} max={32} onChange={(n) => set({ multicoreRet: Math.round(n) })} />
            </>
          ) : null}
          <NumField id="w-dist" label="Сцена — пульт" unit="м" value={rig.distFoh} min={1} onChange={(n) => set({ distFoh: n })} />
          <NumField id="w-stage" label="Источник — стейджбокс" unit="м" value={rig.stageLen} min={1} onChange={(n) => set({ stageLen: n })} />
        </div>
        {isQu ? <p class="note">{MIXERS[rig.mixer as 'qu16' | 'qu24'].note} Сверяйте с руководством к пульту.</p> : null}
      </section>

      <section class="panel no-print">
        <div class="panel-h"><span class="lbl">Источники ({rig.sources.length})</span></div>
        <div class="chips">
          {Object.values(PRESETS).map((p) => (
            <button class="chip-btn" type="button" onClick={() => set({ sources: p.sources.map((s) => ({ ...s, id: newId() })) })}>{p.label}</button>
          ))}
          <button class="chip-btn" type="button" onClick={() => set({ sources: [] })}>Очистить</button>
        </div>
        <div class="src-list">
          {rig.sources.map((s, i) => (
            <div class="src" key={s.id}>
              <span class="src-n mono">{i + 1}</span>
              <input class="src-name" aria-label="Название" value={s.name} onInput={(e) => setSrc(s.id, { name: (e.currentTarget as HTMLInputElement).value })} />
              <select class="src-kind" aria-label="Тип" value={s.kind} onChange={(e) => setSrc(s.id, { kind: (e.currentTarget as HTMLSelectElement).value as SourceKind })}>
                {(Object.keys(SOURCE_KINDS) as SourceKind[]).map((k) => <option value={k}>{SOURCE_KINDS[k].label}</option>)}
              </select>
              <label class="src-st"><input type="checkbox" checked={s.stereo} onChange={(e) => setSrc(s.id, { stereo: (e.currentTarget as HTMLInputElement).checked })} /> стерео</label>
              <span class="src-act">
                <button type="button" class="icon-btn" aria-label="Выше" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button type="button" class="icon-btn" aria-label="Ниже" onClick={() => move(i, 1)} disabled={i === rig.sources.length - 1}>↓</button>
                <button type="button" class="icon-btn danger" aria-label="Удалить" onClick={() => set({ sources: rig.sources.filter((x) => x.id !== s.id) })}>×</button>
              </span>
            </div>
          ))}
        </div>
        <div class="actions">
          <button class="btn" type="button" onClick={() => set({ sources: [...rig.sources, { id: newId(), name: `Источник ${rig.sources.length + 1}`, kind: 'vocal', stereo: false }] })}>+ Добавить источник</button>
        </div>
      </section>

      <section class="panel no-print">
        <div class="lbl">Акустика и мониторы</div>
        <div class="form">
          <Select id="w-mt" label="Порталы" value={rig.mainsType} onChange={(v) => set({ mainsType: v })} options={[['active', 'Активные'], ['passive', 'Пассивные + усилитель']]} />
          <NumField id="w-mps" label="Кабинетов на сторону" value={rig.mainsPerSide} min={1} max={16} onChange={(n) => set({ mainsPerSide: Math.round(n) })} />
          <NumField id="w-subs" label="Сабвуферов" value={rig.subs} min={0} max={32} onChange={(n) => set({ subs: Math.round(n) })} />
          <Select id="w-st" label="Сабвуферы" value={rig.subsType} onChange={(v) => set({ subsType: v })} options={[['active', 'Активные'], ['passive', 'Пассивные + усилитель']]} />
          <Select id="w-sf" label="Сигнал на сабы" value={rig.subsFeed} onChange={(v) => set({ subsFeed: v })} options={[['aux', 'Отдельный микс (AUX)'], ['lr', 'От L/R']]} />
          <NumField id="w-ml" label="Кабель до порталов" unit="м" value={rig.mainsLen} min={1} onChange={(n) => set({ mainsLen: n })} />
          <NumField id="w-mon" label="Мониторов" value={rig.monitors} min={0} max={24} onChange={(n) => set({ monitors: Math.round(n) })} />
          <Select id="w-mot" label="Мониторы" value={rig.monitorsType} onChange={(v) => set({ monitorsType: v })} options={[['active', 'Активные'], ['passive', 'Пассивные + усилитель']]} />
          <NumField id="w-mol" label="Кабель до мониторов" unit="м" value={rig.monLen} min={1} onChange={(n) => set({ monLen: n })} />
        </div>
        {rig.mainsType === 'passive' || rig.monitorsType === 'passive' || (rig.subs > 0 && rig.subsType === 'passive') ? (
          <div class="form">
            <NumField id="w-pz" label="Импеданс кабинета" unit="Ом" value={rig.passiveZ} min={1} onChange={(n) => set({ passiveZ: n })} />
            <NumField id="w-pc" label="Кабинетов на канал" value={rig.perChannel} min={1} max={8} onChange={(n) => set({ perChannel: Math.round(n) })} />
            <NumField id="w-amz" label="Мин. нагрузка усилителя" unit="Ом" value={rig.ampMinZ} min={1} onChange={(n) => set({ ampMinZ: n })} />
            <NumField id="w-sl" label="Акустический кабель" unit="м" value={rig.spkLen} min={1} onChange={(n) => set({ spkLen: n })} />
            <Select id="w-ss" label="Сечение" value={String(rig.spkSection)} onChange={(v) => set({ spkSection: Number(v) })}
              options={SECTIONS.map((s) => [String(s), `${fmtNum(s, s < 1 ? 2 : s % 1 ? 1 : 0)} мм²`] as [string, string])} />
          </div>
        ) : null}
      </section>

      {/* ---------- Результат ---------- */}
      <section class="calc">
        <header class="calc-h"><span>{title}</span><small>{res.mixerLabel}</small></header>
        {res.warnings.filter((w) => w.level === 'crit').map((w) => (
          <div class="alert crit" role="alert"><b>!</b><span>{w.text}</span></div>
        ))}
        <div class="sec">
          <div class="lbl">Загрузка</div>
          <div class="usage">
            {res.usage.map((u) => {
              const over = u.used > u.total;
              return (
                <div class={`use ${over ? 'over' : ''}`}>
                  <span class="k">{u.label}</span>
                  <span class="bar"><i style={{ width: `${Math.min(100, u.total ? (u.used / u.total) * 100 : 100)}%` }} /></span>
                  <span class="v mono">{u.used}/{u.total}</span>
                </div>
              );
            })}
          </div>
          <p class="meta">{res.transportLabel}</p>
        </div>

        <div class="sec">
          <div class="lbl">Схема подключения</div>
          <Diagram r={res} transport={rig.transport === 'stagebox' && !isQu ? 'multicore' : rig.transport} />
          <p class="note no-print">Схема шире экрана: листайте её вбок.</p>
        </div>

        <div class="sec">
          <div class="lbl">Patch List: входы</div>
          <div class="tbl">
            <table>
              <thead><tr><th>Кан.</th><th>Источник</th><th>Устройство</th><th>48 В</th><th>Вход</th><th>Кабель</th></tr></thead>
              <tbody>
                {res.inputs.map((i) => (
                  <tr>
                    <td class="mono">{i.ch}</td><td>{i.name}</td><td>{i.device}</td>
                    <td class="mono">{i.phantom ? <span class="ph48">48 В</span> : ''}</td>
                    <td>{i.inputAt}</td><td>{i.cable}{i.len ? `, ${i.len} м` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div class="sec">
          <div class="lbl">Выходы</div>
          <div class="tbl">
            <table>
              <thead><tr><th>Выход</th><th>Шина</th><th>Куда</th><th>Кабель</th></tr></thead>
              <tbody>
                {res.outputs.map((o) => (
                  <tr><td class="mono">{o.out}</td><td>{o.bus}</td><td>{o.dest}</td><td>{o.cable}{o.len ? `, ${o.len} м` : ''}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.amps ? (
            <p class="meta">
              Усилители: {res.amps.channels} канал(ов), это {res.amps.units} двухканальных усилителя. Нагрузка на канал {fmtNum(res.amps.loadZ, 2)} Ом.
            </p>
          ) : null}
        </div>

        <div class="sec">
          <div class="lbl">Список кабелей</div>
          <div class="tbl">
            <table>
              <thead><tr><th>Тип</th><th>Разъёмы</th><th>Длина</th><th>Шт</th></tr></thead>
              <tbody>
                {res.cables.map((c) => (
                  <tr><td>{c.kind}</td><td>{c.connectors}</td><td class="mono">{c.len} м</td><td class="mono">{c.qty}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="note">Длины округлены вверх до стандартных: 1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100 м. Возьмите 10–20 % запасных кабелей.</p>
        </div>

        <div class="sec">
          <div class="lbl">Сетевое питание</div>
          <div class="kvs">
            {res.power.map((p) => (
              <div class="kv"><span class="k">{p.device}</span><span class="v mono">{p.qty ? `${p.qty} шт · ${p.where}` : p.where}</span></div>
            ))}
          </div>
        </div>

        <div class="sec">
          <div class="lbl">Предупреждения</div>
          {res.warnings.filter((w) => w.level !== 'crit').map((w) => (
            <div class={`alert ${w.level}`}><b>{w.level === 'info' ? 'i' : '!'}</b><span>{w.text}</span></div>
          ))}
        </div>
      </section>

      <div class="no-print">
        {asking ? (
          <NewProjectForm onDone={(id) => save(id)} onCancel={() => setAsking(false)} />
        ) : (
          <div class="actions">
            <button class="btn primary" type="button" onClick={() => (project ? save(project.id) : setAsking(true))}>
              {project ? 'Сохранить в проект' : 'Сохранить в новый проект'}
            </button>
            <button class="btn" type="button" onClick={() => downloadText(`${safeName(title)}_${stamp()}.csv`, wiringCsv(title, res), 'text/csv')}>CSV</button>
            <button class="btn" type="button" onClick={() => window.print()}>PDF</button>
          </div>
        )}
        {project && !asking ? <p class="note">Сохранится в «{project.name}».</p> : null}
      </div>
    </div>
  );
}

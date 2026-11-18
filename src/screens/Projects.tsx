import { useEffect, useState } from 'preact/hooks';
import { deleteCalc, deleteProject, getProject, listCalcs, listProjects, saveProject, type Project, type SavedCalc } from '../core/db';
import { ls, notifyProjectsChanged, setCurrentProject, toast, useCurrentProject } from '../core/state';
import { fmtDate } from '../core/format';
import { NewProjectForm } from '../ui/ProjectPicker';
import { CalcCard } from '../ui/CalcCard';
import { calcRows, toCsv } from '../core/csv';
import { downloadText, safeName, stamp } from '../core/download';
import { go } from '../core/router';
import { toolKey } from './ToolScreen';

export function Projects() {
  const [items, setItems] = useState<Project[] | null>(null);
  const [current] = useCurrentProject();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    listProjects().then(setItems);
  }, [current]);

  return (
    <div class="screen">
      <div class="mhead"><h1>Проекты</h1></div>
      {creating ? (
        <NewProjectForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      ) : (
        <div class="actions"><button class="btn primary" type="button" onClick={() => setCreating(true)}>Новый проект</button></div>
      )}
      {items === null ? null : items.length === 0 ? (
        <p class="note">Проектов пока нет. Создайте проект, чтобы сохранять в него расчёты мероприятия.</p>
      ) : (
        <div class="list">
          {items.map((p) => (
            <a class="row" href={`#/projects/${p.id}`}>
              <span>
                <b>{p.name}</b>
                <span class="meta">{[p.date && fmtDate(p.date), p.venue].filter(Boolean).join(' · ') || `изменён ${fmtDate(p.updatedAt)}`}</span>
              </span>
              {current?.id === p.id ? <span class="chip ok">текущий</span> : <span class="chev">›</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectDetail({ id }: { id: string }) {
  const [p, setP] = useState<Project | null | undefined>(undefined);
  const [calcs, setCalcs] = useState<SavedCalc[]>([]);
  const [current] = useCurrentProject();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setP((await getProject(id)) ?? null);
    setCalcs(await listCalcs(id));
  };
  useEffect(() => {
    load();
  }, [id]);

  if (p === undefined) return <div class="screen" />;
  if (p === null) return <div class="screen"><p class="note">Проект не найден.</p><a class="btn" href="#/projects">К проектам</a></div>;

  const exportCsv = () => {
    const rows: string[][] = [[`Проект: ${p.name}`, p.date, p.venue, '']];
    calcs.forEach((c) => {
      rows.push(['', '', '', '']);
      rows.push(...calcRows(c.title, c.result));
    });
    downloadText(`${safeName(p.name)}_${stamp()}.csv`, toCsv(rows), 'text/csv');
  };
  const reopen = (c: SavedCalc) => {
    ls.set(toolKey(c.toolId), c.values);
    go(`/m/${c.module.toLowerCase()}/${c.toolId}`);
  };
  const remove = async () => {
    await deleteProject(p.id);
    notifyProjectsChanged();
    toast('Проект удалён');
    go('/projects');
  };

  return (
    <div class="screen">
      <a class="back no-print" href="#/projects">‹ Проекты</a>
      {editing ? (
        <EditProject p={p} onDone={async () => { setEditing(false); await load(); notifyProjectsChanged(); }} />
      ) : (
        <div class="mhead col">
          <h1>{p.name}</h1>
          <div class="meta">{[p.date && fmtDate(p.date), p.venue].filter(Boolean).join(' · ') || 'без даты и площадки'}</div>
          {p.notes ? <p class="notes">{p.notes}</p> : null}
        </div>
      )}

      <div class="actions no-print">
        {current?.id !== p.id ? <button class="btn primary" type="button" onClick={() => setCurrentProject(p.id)}>Сделать текущим</button> : <span class="chip ok">текущий проект</span>}
        <button class="btn" type="button" onClick={() => setEditing(true)}>Изменить</button>
        <button class="btn" type="button" onClick={exportCsv} disabled={!calcs.length}>CSV</button>
        <button class="btn" type="button" onClick={() => { setOpen('all'); setTimeout(() => window.print(), 50); }} disabled={!calcs.length}>PDF</button>
      </div>

      <h2 class="h">Расчёты ({calcs.length})</h2>
      {calcs.length === 0 ? <p class="note">Откройте любой калькулятор и нажмите «Сохранить в проект».</p> : null}
      <div class="stack">
        {calcs.map((c) => {
          const main = c.result.results.find((r) => r.primary);
          const isOpen = open === 'all' || open === c.id;
          return (
            <div class="saved">
              <button class="row no-print" type="button" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                <span><b>{c.title}</b><span class="meta">{new Date(c.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span></span>
                <span class="mono acc">{main ? `${typeof main.value === 'number' ? main.value.toLocaleString('ru-RU', { maximumFractionDigits: main.digits ?? 2 }) : main.value} ${main.unit ?? ''}` : ''}</span>
              </button>
              <div class={isOpen ? '' : 'print-only'}>
                <CalcCard title={c.title} result={c.result} subtitle={new Date(c.createdAt).toLocaleDateString('ru-RU')} />
                <div class="actions no-print">
                  <button class="btn" type="button" onClick={() => reopen(c)}>Открыть в калькуляторе</button>
                  <button class="btn danger" type="button" onClick={async () => { await deleteCalc(c.id); await load(); }}>Удалить расчёт</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div class="danger-zone no-print">
        {confirmDel ? (
          <div class="panel">
            <p>Удалить проект «{p.name}» и все его расчёты ({calcs.length})? Отменить будет нельзя.</p>
            <div class="actions">
              <button class="btn danger" type="button" onClick={remove}>Удалить навсегда</button>
              <button class="btn" type="button" onClick={() => setConfirmDel(false)}>Отмена</button>
            </div>
          </div>
        ) : (
          <button class="link danger" type="button" onClick={() => setConfirmDel(true)}>Удалить проект</button>
        )}
      </div>
    </div>
  );
}

function EditProject({ p, onDone }: { p: Project; onDone: () => void }) {
  const [v, setV] = useState({ name: p.name, date: p.date, venue: p.venue, notes: p.notes });
  const set = (k: keyof typeof v) => (e: Event) => setV({ ...v, [k]: (e.currentTarget as HTMLInputElement).value });
  return (
    <form class="panel form" onSubmit={async (e) => { e.preventDefault(); if (!v.name.trim()) return; await saveProject({ ...p, ...v, name: v.name.trim() }); onDone(); }}>
      <label class="field wide" for="ep-name"><span class="fl">Название</span><input id="ep-name" value={v.name} onInput={set('name')} required /></label>
      <label class="field" for="ep-date"><span class="fl">Дата</span><input id="ep-date" type="date" value={v.date} onInput={set('date')} /></label>
      <label class="field" for="ep-venue"><span class="fl">Площадка</span><input id="ep-venue" value={v.venue} onInput={set('venue')} /></label>
      <label class="field wide" for="ep-notes"><span class="fl">Заметки</span><textarea id="ep-notes" rows={3} value={v.notes} onInput={set('notes')} /></label>
      <div class="actions wide"><button class="btn primary" type="submit">Сохранить</button><button class="btn" type="button" onClick={onDone}>Отмена</button></div>
    </form>
  );
}

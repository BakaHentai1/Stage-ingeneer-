import { useEffect, useState } from 'preact/hooks';
import { MODULES } from '../modules/registry';
import { listProjects, getSetting, countCalcs, type Project } from '../core/db';
import { setCurrentProject, useCurrentProject } from '../core/state';
import { fmtDate, daysSince } from '../core/format';
import { NewProjectForm } from '../ui/ProjectPicker';

const STATUS: Record<string, string> = { ready: 'готов', next: 'следующий', planned: 'в плане' };

export function Home() {
  const [current] = useCurrentProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [lastBackup, setLastBackup] = useState<number | null | undefined>(undefined);
  const [calcCount, setCalcCount] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listProjects().then(setProjects);
    getSetting<number>('lastBackupAt').then((v) => setLastBackup(v ?? null));
  }, [current]);
  useEffect(() => {
    if (current) countCalcs(current.id).then(setCalcCount);
  }, [current]);

  const audio = MODULES[0];
  const others = projects.filter((p) => p.id !== current?.id).slice(0, 3);
  const needBackup = projects.length > 0 && (lastBackup === null || (lastBackup !== undefined && daysSince(lastBackup) >= 7));

  return (
    <div class="screen">
      {current ? (
        <a class="proj" href={`#/projects/${current.id}`}>
          <div class="eyebrow">Текущий проект</div>
          <b>{current.name}</b>
          <div class="meta">{[current.date && fmtDate(current.date), current.venue].filter(Boolean).join(' · ') || 'без даты и площадки'}</div>
          <div class="chips"><span class="chip">{calcCount} расч.</span></div>
        </a>
      ) : creating ? (
        <NewProjectForm onDone={() => setCreating(false)} onCancel={() => setCreating(false)} />
      ) : (
        <div class="proj empty">
          <div class="eyebrow">Текущий проект</div>
          <div class="meta">Проект собирает расчёты одного мероприятия, их можно выгрузить в CSV и PDF.</div>
          <div class="actions"><button class="btn primary" type="button" onClick={() => setCreating(true)}>Создать проект</button></div>
        </div>
      )}

      <h2 class="h">Модули</h2>
      <div class="grid">
        {MODULES.map((m) => (
          <a class={`mod ${m.code === 'G' ? 'full' : ''} st-${m.status}`} href={`#/m/${m.code.toLowerCase()}`}>
            <span class="code">{m.code}</span>
            <span class="stage">{STATUS[m.status]}</span>
            <b>{m.title}</b>
            <span class="d">{m.desc}</span>
          </a>
        ))}
      </div>

      <h2 class="h">Быстрые расчёты</h2>
      <div class="quick">
        {audio.tools.map((t) => (
          <a class="q" href={`#/m/a/${t.id}`}>{t.title}</a>
        ))}
      </div>

      {others.length ? (
        <>
          <h2 class="h">Другие проекты <a href="#/projects">Все</a></h2>
          <div class="list">
            {others.map((p) => (
              <button class="row" type="button" onClick={() => setCurrentProject(p.id)}>
                <span><b>{p.name}</b><span class="meta">{p.venue || fmtDate(p.updatedAt)}</span></span>
                <span class="chip">сделать текущим</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {needBackup ? (
        <a class="backup" href="#/settings">
          <span class="dot warn" />
          <span>
            <b>{lastBackup ? `Резервная копия ${daysSince(lastBackup)} дн. назад.` : 'Резервной копии ещё нет.'}</b> Данные хранятся только на этом телефоне. Сохраните копию в настройках.
          </span>
        </a>
      ) : null}
    </div>
  );
}

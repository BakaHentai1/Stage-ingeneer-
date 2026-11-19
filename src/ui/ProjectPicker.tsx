import { useState } from 'preact/hooks';
import { saveProject } from '../core/db';
import { setCurrentProject, toast } from '../core/state';

/** Быстрое создание проекта прямо там, где он понадобился. */
export function NewProjectForm({ onDone, onCancel }: { onDone?: (id: string) => void; onCancel?: () => void }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [venue, setVenue] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return;
    const p = await saveProject({ name: name.trim(), date, venue: venue.trim() });
    await setCurrentProject(p.id);
    toast(`Проект «${p.name}» создан`);
    onDone?.(p.id);
  };
  return (
    <form class="panel form" onSubmit={submit}>
      <label class="field wide" for="np-name">
        <span class="fl">Название мероприятия</span>
        <input id="np-name" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} placeholder="Например: Концерт в ДК" required />
      </label>
      <label class="field" for="np-date">
        <span class="fl">Дата</span>
        <input id="np-date" type="date" value={date} onInput={(e) => setDate((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label class="field" for="np-venue">
        <span class="fl">Площадка</span>
        <input id="np-venue" value={venue} onInput={(e) => setVenue((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <div class="actions wide">
        <button class="btn primary" type="submit" disabled={!name.trim()}>Создать проект</button>
        {onCancel ? <button class="btn" type="button" onClick={onCancel}>Отмена</button> : null}
      </div>
    </form>
  );
}

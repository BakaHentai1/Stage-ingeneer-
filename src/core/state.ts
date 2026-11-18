import { useEffect, useState } from 'preact/hooks';
import { getProject, getSetting, setSetting, type Project } from './db';

/** Текущий проект: хранится в настройках, изменения рассылаются событием. */
const EVT = 'se:current-project';

export async function setCurrentProject(id: string | null): Promise<void> {
  await setSetting('currentProjectId', id);
  dispatchEvent(new Event(EVT));
}

export function notifyProjectsChanged(): void {
  dispatchEvent(new Event(EVT));
}

export function useCurrentProject(): [Project | null, boolean] {
  const [p, setP] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const id = await getSetting<string | null>('currentProjectId');
      const pr = id ? await getProject(id) : undefined;
      if (alive) {
        setP(pr ?? null);
        setLoaded(true);
      }
    };
    load();
    addEventListener(EVT, load);
    return () => {
      alive = false;
      removeEventListener(EVT, load);
    };
  }, []);
  return [p, loaded];
}

/** Короткое уведомление внизу экрана. */
export function toast(text: string): void {
  dispatchEvent(new CustomEvent('se:toast', { detail: text }));
}

/** localStorage с защитой от ошибок (приватный режим и т. п.). */
export const ls = {
  get<T>(key: string): T | null {
    try {
      const s = localStorage.getItem(key);
      return s ? (JSON.parse(s) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, v: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* хранилище недоступно — не критично */
    }
  },
};

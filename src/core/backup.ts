import { db, STORES, setSetting, type StoreName } from './db';

export const BACKUP_APP = 'stage-engineer';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<StoreName, unknown[]>;
}

/** Собирает все хранилища в один объект для файла резервной копии. */
export async function makeBackup(): Promise<Backup> {
  const d = await db();
  const data = {} as Record<StoreName, unknown[]>;
  for (const s of STORES) data[s] = await d.getAll(s);
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

/** Проверяет файл резервной копии. Возвращает текст ошибки или null. */
export function validateBackup(x: unknown): string | null {
  if (!x || typeof x !== 'object') return 'Файл не является резервной копией.';
  const b = x as Partial<Backup>;
  if (b.app !== BACKUP_APP) return 'Это резервная копия другого приложения.';
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) return 'Копия сделана более новой версией приложения. Обновите приложение.';
  if (!b.data || typeof b.data !== 'object') return 'В файле нет данных.';
  for (const s of STORES) {
    const arr = (b.data as Record<string, unknown>)[s];
    if (arr !== undefined && !Array.isArray(arr)) return `Повреждён раздел «${s}».`;
  }
  return null;
}

/** Полностью заменяет данные содержимым копии. */
export async function restoreBackup(b: Backup): Promise<{ counts: Record<string, number> }> {
  const d = await db();
  const tx = d.transaction([...STORES], 'readwrite');
  const counts: Record<string, number> = {};
  for (const s of STORES) {
    const store = tx.objectStore(s);
    await store.clear();
    const items = (b.data[s] ?? []) as never[];
    for (const it of items) await store.put(it);
    counts[s] = items.length;
  }
  await tx.done;
  return { counts };
}

export async function markBackupDone(): Promise<void> {
  await setSetting('lastBackupAt', Date.now());
}

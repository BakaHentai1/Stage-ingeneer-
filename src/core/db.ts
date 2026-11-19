import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CalcResult, Values } from '../calc/types';

export interface Project {
  id: string;
  name: string;
  date: string; // дата мероприятия, YYYY-MM-DD
  venue: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

/** Сохранённый расчёт, привязанный к проекту. */
export interface SavedCalc {
  id: string;
  projectId: string;
  module: string; // 'A'
  toolId: string;
  title: string;
  values: Values;
  result: CalcResult;
  createdAt: number;
}

/** Сохранённый документ модуля (например, схема коммутации), привязанный к проекту. */
export interface SavedDoc {
  id: string;
  projectId: string;
  kind: 'wiring';
  title: string;
  data: unknown;
  createdAt: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

interface StageDB extends DBSchema {
  projects: { key: string; value: Project };
  calcs: { key: string; value: SavedCalc; indexes: { byProject: string } };
  settings: { key: string; value: Setting };
  docs: { key: string; value: SavedDoc; indexes: { byProject: string } };
  // Хранилища для модулей D (склад) и далее — создаются заранее, чтобы не было миграций.
  inventory: { key: string; value: Record<string, unknown> & { id: string } };
  kits: { key: string; value: Record<string, unknown> & { id: string } };
  movements: { key: string; value: Record<string, unknown> & { id: string } };
}

export const STORES = ['projects', 'calcs', 'docs', 'settings', 'inventory', 'kits', 'movements'] as const;
export type StoreName = (typeof STORES)[number];

const DB_NAME = 'stage-engineer';
const DB_VERSION = 2;

let dbp: Promise<IDBPDatabase<StageDB>> | null = null;

export function db(): Promise<IDBPDatabase<StageDB>> {
  if (!dbp) {
    dbp = openDB<StageDB>(DB_NAME, DB_VERSION, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore('projects', { keyPath: 'id' });
          const calcs = d.createObjectStore('calcs', { keyPath: 'id' });
          calcs.createIndex('byProject', 'projectId');
          d.createObjectStore('settings', { keyPath: 'key' });
          d.createObjectStore('inventory', { keyPath: 'id' });
          d.createObjectStore('kits', { keyPath: 'id' });
          d.createObjectStore('movements', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          const docs = d.createObjectStore('docs', { keyPath: 'id' });
          docs.createIndex('byProject', 'projectId');
        }
      },
    });
  }
  return dbp;
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* ---------- Проекты ---------- */

export async function listProjects(): Promise<Project[]> {
  const all = await (await db()).getAll('projects');
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return (await db()).get('projects', id);
}

export async function saveProject(p: Partial<Project> & { name: string }): Promise<Project> {
  const now = Date.now();
  const full: Project = {
    id: p.id ?? uid(),
    name: p.name,
    date: p.date ?? '',
    venue: p.venue ?? '',
    notes: p.notes ?? '',
    createdAt: p.createdAt ?? now,
    updatedAt: now,
  };
  await (await db()).put('projects', full);
  return full;
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['projects', 'calcs', 'docs'], 'readwrite');
  const keys = await tx.objectStore('calcs').index('byProject').getAllKeys(id);
  await Promise.all(keys.map((k) => tx.objectStore('calcs').delete(k)));
  const docKeys = await tx.objectStore('docs').index('byProject').getAllKeys(id);
  await Promise.all(docKeys.map((k) => tx.objectStore('docs').delete(k)));
  await tx.objectStore('projects').delete(id);
  await tx.done;
  if ((await getSetting<string>('currentProjectId')) === id) await setSetting('currentProjectId', null);
}

/* ---------- Расчёты ---------- */

export async function saveCalc(c: Omit<SavedCalc, 'id' | 'createdAt'>): Promise<SavedCalc> {
  const full: SavedCalc = { ...c, id: uid(), createdAt: Date.now() };
  const d = await db();
  await d.put('calcs', full);
  const p = await d.get('projects', c.projectId);
  if (p) await d.put('projects', { ...p, updatedAt: Date.now() });
  return full;
}

export async function listCalcs(projectId: string): Promise<SavedCalc[]> {
  const all = await (await db()).getAllFromIndex('calcs', 'byProject', projectId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countCalcs(projectId: string): Promise<number> {
  return (await db()).countFromIndex('calcs', 'byProject', projectId);
}

export async function deleteCalc(id: string): Promise<void> {
  await (await db()).delete('calcs', id);
}

/* ---------- Документы модулей ---------- */

export async function saveDoc(doc: Omit<SavedDoc, 'id' | 'createdAt'>): Promise<SavedDoc> {
  const full: SavedDoc = { ...doc, id: uid(), createdAt: Date.now() };
  const d = await db();
  await d.put('docs', full);
  const p = await d.get('projects', doc.projectId);
  if (p) await d.put('projects', { ...p, updatedAt: Date.now() });
  return full;
}

export async function listDocs(projectId: string): Promise<SavedDoc[]> {
  const all = await (await db()).getAllFromIndex('docs', 'byProject', projectId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteDoc(id: string): Promise<void> {
  await (await db()).delete('docs', id);
}

/* ---------- Настройки ---------- */

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const s = await (await db()).get('settings', key);
  return s?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await db()).put('settings', { key, value });
}

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { saveProject, saveCalc, listProjects, listCalcs, deleteProject, setSetting, getSetting } from '../src/core/db';
import { makeBackup, restoreBackup, validateBackup } from '../src/core/backup';
import { splTool } from '../src/calc/audio/spl';
import { toCsv, calcToCsv } from '../src/core/csv';

describe('Хранилище и резервная копия', () => {
  it('сохраняет проект и расчёт, делает копию и восстанавливает её', async () => {
    const p = await saveProject({ name: 'Тест', venue: 'ДК' });
    const result = splTool.compute(splTool.defaults);
    await saveCalc({ projectId: p.id, module: 'A', toolId: 'spl', title: 'SPL', values: splTool.defaults, result });
    const backup = JSON.parse(JSON.stringify(await makeBackup()));
    expect(validateBackup(backup)).toBeNull();

    await deleteProject(p.id);
    expect(await listProjects()).toHaveLength(0);

    await restoreBackup(backup);
    const ps = await listProjects();
    expect(ps).toHaveLength(1);
    expect(ps[0].name).toBe('Тест');
    expect(await listCalcs(ps[0].id)).toHaveLength(1);
  });

  it('удаление проекта удаляет его расчёты и сбрасывает текущий проект', async () => {
    const p = await saveProject({ name: 'Удаляемый' });
    await setSetting('currentProjectId', p.id);
    await saveCalc({ projectId: p.id, module: 'A', toolId: 'spl', title: 'SPL', values: {}, result: splTool.compute(splTool.defaults) });
    await deleteProject(p.id);
    expect(await listCalcs(p.id)).toHaveLength(0);
    expect(await getSetting('currentProjectId')).toBeNull();
  });

  it('отклоняет чужие и повреждённые файлы', () => {
    expect(validateBackup(null)).toBeTruthy();
    expect(validateBackup({ app: 'other' })).toBeTruthy();
    expect(validateBackup({ app: 'stage-engineer', version: 99, data: {} })).toBeTruthy();
    expect(validateBackup({ app: 'stage-engineer', version: 1, data: { projects: 'x' } })).toBeTruthy();
  });
});

describe('CSV', () => {
  it('BOM, разделитель «;», экранирование кавычек и запятая в числах', () => {
    const s = toCsv([['a;b', 'c"d'], [1, 2]]);
    expect(s.startsWith('﻿')).toBe(true);
    expect(s).toContain('"a;b";"c""d"');
    const csv = calcToCsv('SPL', splTool.compute(splTool.defaults));
    expect(csv).toMatch(/Уровень на расстоянии r;\d+,\d;дБ SPL/);
  });
});

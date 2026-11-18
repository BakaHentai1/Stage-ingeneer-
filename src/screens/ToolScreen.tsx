import { useMemo, useState } from 'preact/hooks';
import { findModule, findTool } from '../modules/registry';
import type { Values } from '../calc/types';
import { CalcCard } from '../ui/CalcCard';
import { ToolForm } from '../ui/Form';
import { NewProjectForm } from '../ui/ProjectPicker';
import { NotFound } from './ModuleScreen';
import { ls, toast, useCurrentProject } from '../core/state';
import { saveCalc } from '../core/db';
import { calcToCsv } from '../core/csv';
import { downloadText, safeName, stamp } from '../core/download';

export const toolKey = (id: string) => `se:tool:${id}`;

export function ToolScreen({ code, toolId }: { code: string; toolId: string }) {
  const m = findModule(code);
  const tool = findTool(code, toolId);
  if (!m || !tool) return <NotFound />;
  return <ToolInner key={tool.id} moduleCode={m.code} moduleTitle={m.title} toolId={tool.id} />;
}

function ToolInner({ moduleCode, moduleTitle, toolId }: { moduleCode: string; moduleTitle: string; toolId: string }) {
  const tool = findTool(moduleCode, toolId)!;
  const [values, setValues] = useState<Values>(() => ({ ...tool.defaults, ...(ls.get<Values>(toolKey(tool.id)) ?? {}) }));
  const [project] = useCurrentProject();
  const [asking, setAsking] = useState(false);
  const result = useMemo(() => tool.compute(values), [values, tool]);

  const change = (k: string, v: string) => {
    const next = { ...values, [k]: v };
    setValues(next);
    ls.set(toolKey(tool.id), next);
  };
  const reset = () => {
    setValues({ ...tool.defaults });
    ls.set(toolKey(tool.id), null);
  };
  const save = async (projectId: string) => {
    await saveCalc({ projectId, module: moduleCode, toolId: tool.id, title: tool.title, values, result });
    toast('Расчёт сохранён в проект');
    setAsking(false);
  };
  const exportCsv = () => downloadText(`${safeName(tool.title)}_${stamp()}.csv`, calcToCsv(tool.title, result), 'text/csv');

  return (
    <div class="screen">
      <a class="back no-print" href={`#/m/${moduleCode.toLowerCase()}`}>‹ {moduleTitle}</a>
      <div class="mhead"><span class="code">{moduleCode}</span><h1>{tool.title}</h1></div>
      {project ? <div class="print-only meta">Проект: {project.name}</div> : null}

      <section class="panel no-print">
        <div class="panel-h"><span class="lbl">Исходные данные</span><button class="link" type="button" onClick={reset}>Сбросить</button></div>
        <ToolForm fields={tool.fields} values={values} onChange={change} />
      </section>

      <CalcCard title={tool.title} result={result} />

      {!result.error ? (
        <div class="no-print">
          {asking ? (
            <NewProjectForm onDone={(id) => save(id)} onCancel={() => setAsking(false)} />
          ) : (
            <div class="actions">
              <button class="btn primary" type="button" onClick={() => (project ? save(project.id) : setAsking(true))}>
                {project ? 'Сохранить в проект' : 'Сохранить в новый проект'}
              </button>
              <button class="btn" type="button" onClick={exportCsv}>CSV</button>
              <button class="btn" type="button" onClick={() => window.print()}>PDF</button>
            </div>
          )}
          {project && !asking ? <p class="note">Сохранится в «{project.name}».</p> : null}
          <p class="note">PDF: в окне печати выберите «Сохранить как PDF».</p>
        </div>
      ) : null}
    </div>
  );
}

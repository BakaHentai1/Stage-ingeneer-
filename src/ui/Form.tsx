import type { FieldDef, Values } from '../calc/types';

export function ToolForm({ fields, values, onChange }: { fields: FieldDef[]; values: Values; onChange: (k: string, v: string) => void }) {
  return (
    <div class="form">
      {fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => {
        const id = `f-${f.key}`;
        return (
          <label class={`field ${f.type === 'text' || f.type === 'select' ? 'wide' : ''}`} for={id} key={f.key}>
            <span class="fl">
              {f.label}
              {f.unit ? <em>, {f.unit}</em> : null}
            </span>
            {f.type === 'select' ? (
              <select id={id} value={values[f.key]} onChange={(e) => onChange(f.key, (e.currentTarget as HTMLSelectElement).value)}>
                {(f.optionsFn ? f.optionsFn(values) : f.options ?? []).map((o) => <option value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                id={id}
                type="text"
                inputMode={f.type === 'number' ? 'decimal' : 'text'}
                autoComplete="off"
                value={values[f.key] ?? ''}
                onInput={(e) => onChange(f.key, (e.currentTarget as HTMLInputElement).value)}
              />
            )}
            {f.hint ? <span class="hint">{f.hint}</span> : null}
          </label>
        );
      })}
    </div>
  );
}

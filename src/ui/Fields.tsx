import { useEffect, useState } from 'preact/hooks';

/* Поля ввода для экранов модуля C (такие же, как в модуле B). */
export function NumField({ id, label, unit, value, min = 0, max, onChange }: {
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

export function Select<T extends string>({ id, label, value, options, onChange }: {
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

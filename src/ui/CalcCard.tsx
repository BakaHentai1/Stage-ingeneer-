import type { CalcResult, CalcValue } from '../calc/types';
import { fmtValue } from '../core/format';
import { FigureView, TableView } from './Figure';

function ValueRow({ v }: { v: CalcValue }) {
  return (
    <div class={`kv ${v.level ? 'lv-' + v.level : ''}`}>
      <span class="k">{v.label}</span>
      <span class="v mono">
        {fmtValue(v)}
        {v.unit ? <small> {v.unit}</small> : null}
      </span>
    </div>
  );
}

/** Карточка расчёта: результат, формула, исходные данные, ограничения, предупреждения. */
export function CalcCard({ title, result, subtitle }: { title: string; result: CalcResult; subtitle?: string }) {
  if (result.error) {
    return (
      <section class="calc">
        <header class="calc-h">
          <span>{title}</span>
        </header>
        <div class="calc-err" role="alert">{result.error}</div>
      </section>
    );
  }
  const main = result.results.find((r) => r.primary);
  const rest = result.results.filter((r) => !r.primary);
  return (
    <section class="calc">
      <header class="calc-h">
        <span>{title}</span>
        {subtitle ? <small>{subtitle}</small> : null}
      </header>

      {result.warnings.filter((w) => w.level === 'crit').map((w) => (
        <div class="alert crit" role="alert"><b>!</b><span>{w.text}</span></div>
      ))}

      <div class="sec">
        <div class="lbl">Результат</div>
        {main ? (
          <div class={`big-result ${main.level ? 'lv-' + main.level : ''}`}>
            <span class="big mono">{fmtValue(main)}</span>
            <span class="unit">{main.unit}</span>
            <span class="what">{main.label}</span>
          </div>
        ) : null}
        <div class="kvs">{rest.map((v) => <ValueRow v={v} />)}</div>
      </div>

      {result.explain?.length ? (
        <div class="sec">
          <div class="lbl">Простыми словами</div>
          {result.explain.map((t) => <p class="explain">{t}</p>)}
        </div>
      ) : null}

      {result.figures?.length ? (
        <div class="sec">
          <div class="lbl">Схемы и графики</div>
          {result.figures.map((f) => <FigureView f={f} />)}
        </div>
      ) : null}

      {result.tables?.length ? (
        <div class="sec">
          <div class="lbl">Сравнение и списки</div>
          {result.tables.map((t) => <TableView t={t} />)}
        </div>
      ) : null}

      <div class="sec">
        <div class="lbl">Формула</div>
        {result.formulas.map((f) => <div class="formula mono">{f}</div>)}
      </div>

      <div class="sec">
        <div class="lbl">Исходные данные</div>
        <div class="kvs">{result.inputs.map((v) => <ValueRow v={v} />)}</div>
      </div>

      <div class="sec">
        <div class="lbl">Ограничения применимости</div>
        <ul class="limits">{result.limits.map((l) => <li>{l}</li>)}</ul>
      </div>

      {result.warnings.some((w) => w.level !== 'crit') ? (
        <div class="sec">
          <div class="lbl">Предупреждения</div>
          {result.warnings.filter((w) => w.level !== 'crit').map((w) => (
            <div class={`alert ${w.level}`}><b>{w.level === 'info' ? 'i' : '!'}</b><span>{w.text}</span></div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

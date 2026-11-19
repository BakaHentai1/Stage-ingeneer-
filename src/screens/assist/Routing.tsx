import { useMemo, useState } from 'preact/hooks';
import { buildRoute, defaultRoute, ROUTE_DESTS, type RouteDest, type RouteSetup, type Step } from '../../assist/route';
import { CONSOLES, type ConsoleId } from '../../assist/qu';
import { IN_KINDS, type InKind } from '../../assist/patch';
import { ls } from '../../core/state';
import { Select } from '../../ui/Fields';

export const ROUTE_KEY = 'se:route';

/** Вертикальная схема пути сигнала: физика (кабели) и цифра (внутри пульта) разными цветами. */
export function SignalPath({ steps }: { steps: Step[] }) {
  let prev: Step['layer'] | null = null;
  return (
    <ol class="sp">
      {steps.map((s, i) => {
        const head = s.layer !== prev ? (prev = s.layer, true) : false;
        return (
          <>
            {head ? <li class={`sp-zone ${s.layer}`} aria-hidden="true">{s.layer === 'phys' ? 'Физика: кабели и разъёмы' : 'Цифра: внутри пульта'}</li> : null}
            <li class={`sp-step ${s.layer}`}>
              <span class="sp-n mono">{i + 1}</span>
              <span class="sp-b">
                <b>{s.title}</b>
                <span class="sp-d">{s.detail}</span>
                {s.tap ? <span class="sp-tap mono">точка отбора: {s.tap}</span> : null}
                {s.how ? <span class="sp-how"><em>{s.layer === 'dig' ? 'На пульте:' : 'Руками:'}</em> {s.how}</span> : null}
              </span>
            </li>
          </>
        );
      })}
    </ol>
  );
}

export function RouteLegend() {
  return (
    <div class="sp-legend">
      <span><i class="phys" />физическая коммутация</span>
      <span><i class="dig" />цифровая маршрутизация</span>
    </div>
  );
}

export function RoutingScreen() {
  const [r, setR] = useState<RouteSetup>(() => ({ ...defaultRoute(), ...(ls.get<RouteSetup>(ROUTE_KEY) ?? {}) }));
  const res = useMemo(() => buildRoute(r), [r]);
  const set = (p: Partial<RouteSetup>) => {
    const n = { ...r, ...p };
    setR(n);
    ls.set(ROUTE_KEY, n);
  };
  const c = CONSOLES[r.console];
  const dests = Object.keys(ROUTE_DESTS) as RouteDest[];

  return (
    <div class="screen">
      <a class="back no-print" href="#/m/c">‹ Помощник звукорежиссёра</a>
      <div class="mhead"><span class="code">C</span><h1>Маршрутизация и путь сигнала</h1></div>

      <section class="panel no-print">
        <div class="form">
          <Select id="r-con" label="Пульт" value={r.console} onChange={(v: ConsoleId) => set({ console: v })}
            options={[['qu16', 'A&H Qu-16'], ['qu24', 'A&H Qu-24'], ['analog', 'Аналоговый']]} />
          <Select id="r-tr" label="Вход" value={r.transport} onChange={(v) => set({ transport: v })}
            options={c.digital ? [['rack', 'Стейджбокс dSNAKE'], ['local', 'Задняя панель пульта']] : [['rack', 'Аналоговый мультикор'], ['local', 'Прямо в пульт']]} />
          <Select id="r-src" label="Источник" value={r.source} onChange={(v: InKind) => set({ source: v })}
            options={(Object.keys(IN_KINDS) as InKind[]).map((k) => [k, IN_KINDS[k].label])} />
          <Select id="r-spk" label="Акустика" value={r.speakers} onChange={(v) => set({ speakers: v })}
            options={[['active', 'Активная'], ['passive', 'Пассивная + усилитель']]} />
        </div>
        <div class="lbl">Куда ведём сигнал</div>
        <div class="chips">
          {dests.map((d) => (
            <button type="button" class={`chip-btn ${r.dest === d ? 'on' : ''}`} aria-pressed={r.dest === d} onClick={() => set({ dest: d })}>{ROUTE_DESTS[d].short}</button>
          ))}
        </div>
      </section>

      <section class="calc">
        <div class="calc-h"><span>{ROUTE_DESTS[r.dest].label}</span><small>{c.label}</small></div>
        {res.error ? (
          <div class="sec"><div class="alert warn"><b>!</b><span>{res.error}</span></div></div>
        ) : (
          <div class="sec">
            <RouteLegend />
            <SignalPath steps={res.steps} />
          </div>
        )}
        {res.notes.length && !res.error ? (
          <div class="sec">
            <div class="lbl">Важно</div>
            <ul class="limits">{res.notes.map((n) => <li>{n}</li>)}</ul>
          </div>
        ) : null}
        <div class="sec">
          <details>
            <summary class="lbl">Что умеет {c.label}</summary>
            <ul class="limits">{c.facts.map((f) => <li>{f}</li>)}</ul>
            {c.digital ? <p class="hint">По руководству Allen & Heath Qu Mixer Reference Guide. Названия меню зависят от версии прошивки.</p> : null}
          </details>
        </div>
      </section>

      <div class="actions no-print">
        <button class="btn" type="button" onClick={() => window.print()}>PDF</button>
        <a class="btn" href="#/m/c/patch">Патчинг входов и выходов</a>
      </div>
    </div>
  );
}

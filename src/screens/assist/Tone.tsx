import { useState } from 'preact/hooks';
import { SOURCES, TOPICS } from '../../assist/tone';
import { assistTools } from '../../calc/assist';

export function ToneScreen() {
  const [tab, setTab] = useState<'topics' | 'sources' | 'calc'>('topics');
  return (
    <div class="screen">
      <a class="back no-print" href="#/m/c">‹ Помощник звукорежиссёра</a>
      <div class="mhead"><span class="code">C</span><h1>Настройка звука</h1></div>
      <div class="seg no-print">
        <button type="button" class={tab === 'topics' ? 'on' : ''} onClick={() => setTab('topics')}>Обработка</button>
        <button type="button" class={tab === 'sources' ? 'on' : ''} onClick={() => setTab('sources')}>По источникам</button>
        <button type="button" class={tab === 'calc' ? 'on' : ''} onClick={() => setTab('calc')}>Калькуляторы</button>
      </div>

      {tab === 'topics' ? (
        <>
          <p class="note">Порядок в канале Qu: Preamp → HPF → Gate → PEQ → Comp → Delay. Настраивайте в этом же порядке.</p>
          {TOPICS.map((t) => (
            <details class="calc tn">
              <summary class="calc-h"><span>{t.title}</span><span class="chev">›</span></summary>
              <div class="sec"><p>{t.what}</p></div>
              <div class="sec"><div class="lbl">Как настроить</div><ol class="tn-ol">{t.how.map((h) => <li>{h}</li>)}</ol></div>
              <div class="sec"><div class="lbl">На Qu-16 / Qu-24</div><p class="formula">{t.qu}</p></div>
              <div class="sec"><div class="lbl">Частые ошибки</div><ul class="limits">{t.mistakes.map((m) => <li>{m}</li>)}</ul></div>
            </details>
          ))}
        </>
      ) : null}

      {tab === 'sources' ? (
        <>
          <p class="note">Стартовые настройки для живого звука. Это отправная точка: окончательно — на слух, на конкретном микрофоне и в конкретном зале.</p>
          {SOURCES.map((s) => (
            <details class="calc tn">
              <summary class="calc-h"><span>{s.title}</span><span class="chev">›</span></summary>
              <div class="sec">
                <div class="kvs">
                  <div class="kv"><span class="k">HPF</span><span class="v">{s.hpf}</span></div>
                  <div class="kv"><span class="k">Gate</span><span class="v tn-wrap">{s.gate}</span></div>
                  <div class="kv"><span class="k">Компрессор</span><span class="v tn-wrap">{s.comp}</span></div>
                  <div class="kv"><span class="k">FX</span><span class="v tn-wrap">{s.fx}</span></div>
                </div>
              </div>
              <div class="sec"><div class="lbl">EQ</div><ul class="limits">{s.eq.map((e) => <li>{e}</li>)}</ul></div>
              {s.note ? <div class="sec"><div class="alert info"><b>i</b><span>{s.note}</span></div></div> : null}
            </details>
          ))}
        </>
      ) : null}

      {tab === 'calc' ? (
        <div class="list">
          {assistTools.map((t) => (
            <a class="row" href={`#/m/c/${t.id}`}><span><b>{t.title}</b><span class="meta">{t.short}</span></span><span class="chev">›</span></a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

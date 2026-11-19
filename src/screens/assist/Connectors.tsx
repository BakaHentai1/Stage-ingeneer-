import { useState } from 'preact/hooks';
import { CONNECTORS, PANELS, type Draw } from '../../assist/connectors';

/** Схематичные рисунки разъёмов (вид с торца или сбоку). */
export function ConnPic({ d }: { d: Draw }) {
  const pin = (x: number, y: number, t?: string) => <g><circle cx={x} cy={y} r={5} class="pin" />{t ? <text x={x} y={y + 3.5} text-anchor="middle" class="pn">{t}</text> : null}</g>;
  let body;
  switch (d) {
    case 'xlr3': body = <><circle cx={40} cy={40} r={30} class="shell" />{pin(28, 32, '1')}{pin(52, 32, '2')}{pin(40, 54, '3')}<rect x={36} y={8} width={8} height={6} class="key" /></>; break;
    case 'xlr5': body = <><circle cx={40} cy={40} r={30} class="shell" />{pin(24, 36, '1')}{pin(56, 36, '2')}{pin(30, 54, '3')}{pin(50, 54, '4')}{pin(40, 26, '5')}</>; break;
    case 'trs': body = <><rect x={6} y={32} width={30} height={16} rx={3} class="shell" /><rect x={36} y={35} width={18} height={10} class="pin" /><rect x={54} y={35} width={4} height={10} class="ring" /><rect x={58} y={35} width={8} height={10} class="pin" /><rect x={66} y={35} width={3} height={10} class="ring" /><path d="M69,35 L76,40 L69,45 z" class="pin" /><text x={45} y={60} class="pn2">S</text><text x={61} y={60} class="pn2">R</text><text x={72} y={60} class="pn2">T</text></>; break;
    case 'ts': body = <><rect x={6} y={32} width={30} height={16} rx={3} class="shell" /><rect x={36} y={35} width={28} height={10} class="pin" /><rect x={64} y={35} width={4} height={10} class="ring" /><path d="M68,35 L76,40 L68,45 z" class="pin" /><text x={50} y={60} class="pn2">S</text><text x={72} y={60} class="pn2">T</text></>; break;
    case 'mini': body = <><rect x={14} y={34} width={26} height={12} rx={3} class="shell" /><rect x={40} y={37} width={12} height={6} class="pin" /><rect x={52} y={37} width={3} height={6} class="ring" /><rect x={55} y={37} width={6} height={6} class="pin" /><rect x={61} y={37} width={2} height={6} class="ring" /><path d="M63,37 L68,40 L63,43 z" class="pin" /></>; break;
    case 'rca': body = <><circle cx={40} cy={40} r={24} class="shell" /><circle cx={40} cy={40} r={14} class="ring" /><circle cx={40} cy={40} r={5} class="pin" /></>; break;
    case 'nl4': body = <><circle cx={40} cy={40} r={30} class="shell" /><circle cx={40} cy={40} r={18} class="ring" /><rect x={36} y={16} width={8} height={10} class="pin" /><rect x={36} y={54} width={8} height={10} class="pin" /><rect x={16} y={36} width={10} height={8} class="pin" /><rect x={54} y={36} width={10} height={8} class="pin" /><text x={40} y={13} text-anchor="middle" class="pn2">1+</text><text x={40} y={75} text-anchor="middle" class="pn2">1−</text><text x={8} y={30} class="pn2">2+</text><text x={62} y={30} class="pn2">2−</text></>; break;
    case 'nl2': body = <><circle cx={40} cy={40} r={30} class="shell" /><circle cx={40} cy={40} r={18} class="ring" /><rect x={36} y={16} width={8} height={10} class="pin" /><rect x={36} y={54} width={8} height={10} class="pin" /><text x={40} y={13} text-anchor="middle" class="pn2">1+</text><text x={40} y={75} text-anchor="middle" class="pn2">1−</text></>; break;
    case 'ethercon': body = <><circle cx={40} cy={40} r={30} class="shell" /><rect x={24} y={30} width={32} height={22} rx={2} class="ring" />{Array.from({ length: 8 }, (_, i) => <rect x={26.5 + i * 3.6} y={32} width={2} height={7} class="pin" />)}<rect x={34} y={52} width={12} height={4} class="ring" /></>; break;
    case 'powercon': body = <><circle cx={40} cy={40} r={30} class="shell pc" /><circle cx={40} cy={40} r={16} class="ring" /><rect x={37} y={14} width={6} height={10} class="pin" /><rect x={18} y={48} width={10} height={6} class="pin" /><rect x={52} y={48} width={10} height={6} class="pin" /></>; break;
    case 'iec': body = <><path d="M14,22 L66,22 L66,48 L56,60 L24,60 L14,48 z" class="shell" /><rect x={24} y={34} width={4} height={14} class="pin" /><rect x={52} y={34} width={4} height={14} class="pin" /><rect x={38} y={26} width={4} height={14} class="pin" /></>; break;
    case 'usb': body = <><rect x={6} y={30} width={30} height={14} rx={2} class="shell" /><rect x={10} y={34} width={22} height={5} class="pin" /><path d="M46,24 L68,24 L74,30 L74,52 L46,52 z" class="shell" /><rect x={54} y={32} width={12} height={12} class="pin" /><text x={21} y={60} text-anchor="middle" class="pn2">A</text><text x={60} y={64} text-anchor="middle" class="pn2">B</text></>; break;
  }
  return <svg class="conn" viewBox="0 0 80 80" width={80} height={80} aria-hidden="true">{body}</svg>;
}

export function ConnectorsScreen() {
  const [tab, setTab] = useState<'conn' | 'panels' | 'photo'>('conn');
  const [open, setOpen] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  return (
    <div class="screen">
      <a class="back no-print" href="#/m/c">‹ Помощник звукорежиссёра</a>
      <div class="mhead"><span class="code">C</span><h1>Разъёмы и панели</h1></div>
      <div class="seg no-print">
        <button type="button" class={tab === 'conn' ? 'on' : ''} onClick={() => setTab('conn')}>Разъёмы</button>
        <button type="button" class={tab === 'panels' ? 'on' : ''} onClick={() => setTab('panels')}>Панели</button>
        <button type="button" class={tab === 'photo' ? 'on' : ''} onClick={() => setTab('photo')}>Сравнить с фото</button>
      </div>

      {tab === 'photo' ? (
        <section class="panel">
          <p>Сфотографируйте разъём или панель и сравните с рисунками ниже. Фото остаётся только на телефоне и никуда не отправляется.</p>
          <p class="hint">Автоматическое распознавание фото без интернета сделать нельзя. Позже добавим разбор фото через ИИ-сервис по вашему ключу.</p>
          <label class="btn primary">
            {photo ? 'Другое фото' : 'Сделать или выбрать фото'}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => {
              const f = (e.currentTarget as HTMLInputElement).files?.[0];
              if (f) { if (photo) URL.revokeObjectURL(photo); setPhoto(URL.createObjectURL(f)); }
            }} />
          </label>
          {photo ? <img class="cn-photo" src={photo} alt="Ваше фото" /> : null}
        </section>
      ) : null}

      {tab === 'conn' || tab === 'photo' ? (
        <div class="cn-grid">
          {CONNECTORS.map((c) => (
            <button type="button" class={`cn ${open === c.id ? 'on' : ''}`} onClick={() => { setOpen(open === c.id ? null : c.id); setTimeout(() => document.getElementById('cn-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); }}>
              <ConnPic d={c.draw} />
              <span>{c.title}</span>
            </button>
          ))}
        </div>
      ) : null}

      {(tab === 'conn' || tab === 'photo') && open ? (() => {
        const c = CONNECTORS.find((x) => x.id === open)!;
        return (
          <section class="calc" id="cn-detail">
            <div class="calc-h"><span>{c.title}</span></div>
            <div class="sec cn-head"><ConnPic d={c.draw} /><p>{c.look}</p></div>
            <div class="sec"><div class="lbl">Контакты</div><ul class="limits">{c.pins.map((p) => <li>{p}</li>)}</ul></div>
            <div class="sec"><div class="lbl">Где используется</div><p>{c.used}</p><p class="meta">{c.level}</p></div>
            <div class="sec"><div class="lbl">Ошибки</div><ul class="limits">{c.mistakes.map((m) => <li>{m}</li>)}</ul></div>
            {c.danger ? <div class="sec"><div class="alert crit"><b>!</b><span>{c.danger}</span></div></div> : null}
          </section>
        );
      })() : null}

      {tab === 'panels' ? PANELS.map((p) => (
        <section class="calc">
          <div class="calc-h"><span>{p.title}</span></div>
          {p.groups.map((g) => <div class="sec"><div class="lbl">{g.title}</div><ul class="limits">{g.items.map((i) => <li>{i}</li>)}</ul></div>)}
          <div class="sec"><p class="hint">Источник: {p.source}. Проверяйте маркировку на вашем экземпляре.</p></div>
        </section>
      )) : null}
    </div>
  );
}

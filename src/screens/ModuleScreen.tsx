import { findModule } from '../modules/registry';

export function ModuleScreen({ code }: { code: string }) {
  const m = findModule(code);
  if (!m) return <NotFound />;
  return (
    <div class="screen">
      <a class="back" href="#/">‹ Главная</a>
      <div class="mhead"><span class="code">{m.code}</span><h1>{m.title}</h1></div>
      {m.tools.length || m.screens?.length ? (
        <div class="list">
          {(m.screens ?? []).map((t) => (
            <a class="row" href={`#/m/${m.code.toLowerCase()}/${t.id}`}>
              <span><b>{t.title}</b><span class="meta">{t.short}</span></span>
              <span class="chev">›</span>
            </a>
          ))}
          {m.tools.map((t) => (
            <a class="row" href={`#/m/${m.code.toLowerCase()}/${t.id}`}>
              <span><b>{t.title}</b><span class="meta">{t.short}</span></span>
              <span class="chev">›</span>
            </a>
          ))}
        </div>
      ) : null}
      {(m.tools.length || m.screens?.length) && m.planned.length ? (
        <>
          <h2 class="h">Скоро в модуле</h2>
          <ul class="planned">{m.planned.map((p) => <li>{p}</li>)}</ul>
        </>
      ) : null}
      {m.tools.length || m.screens?.length ? null : (
        <>
          <p class="note">
            {m.status === 'next'
              ? 'Модуль в разработке, он следующий по плану. Что в нём будет:'
              : 'Модуль появится позже, по одному после проверки предыдущих. Что в нём будет:'}
          </p>
          <ul class="planned">{m.planned.map((p) => <li>{p}</li>)}</ul>
        </>
      )}
    </div>
  );
}

export function NotFound() {
  return (
    <div class="screen">
      <p class="note">Такой страницы нет.</p>
      <a class="btn" href="#/">На главную</a>
    </div>
  );
}

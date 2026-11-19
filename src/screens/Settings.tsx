import { useEffect, useState } from 'preact/hooks';
import { loadGear } from '../calc/audio/gear';
import { makeBackup, markBackupDone, restoreBackup, validateBackup, type Backup } from '../core/backup';
import { getSetting } from '../core/db';
import { downloadText, stamp } from '../core/download';
import { daysSince, fmtDate } from '../core/format';
import { notifyProjectsChanged, toast } from '../core/state';

type InstallEvt = Event & { prompt: () => Promise<void> };
let deferredInstall: InstallEvt | null = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e as InstallEvt;
});

export function Settings() {
  const [last, setLast] = useState<number | null>(null);
  const [pending, setPending] = useState<{ b: Backup; summary: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [canInstall, setCanInstall] = useState(!!deferredInstall);

  useEffect(() => {
    getSetting<number>('lastBackupAt').then((v) => setLast(v ?? null));
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    const on = () => setCanInstall(true);
    addEventListener('beforeinstallprompt', on);
    return () => removeEventListener('beforeinstallprompt', on);
  }, []);

  const exportBackup = async () => {
    const b = await makeBackup();
    downloadText(`stage-engineer_backup_${stamp()}.json`, JSON.stringify(b, null, 1), 'application/json');
    await markBackupDone();
    setLast(Date.now());
    toast('Резервная копия сохранена в «Загрузки»');
  };

  const pick = async (e: Event) => {
    setErr(null);
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const v = validateBackup(data);
      if (v) return setErr(v);
      const b = data as Backup;
      const n = (k: string) => ((b.data as Record<string, unknown[]>)[k] ?? []).length;
      setPending({ b, summary: `Копия от ${fmtDate(Date.parse(b.exportedAt))}: проектов ${n('projects')}, расчётов ${n('calcs')}.` });
    } catch {
      setErr('Не удалось прочитать файл. Выберите файл .json, сохранённый этим приложением.');
    }
  };

  const restore = async () => {
    if (!pending) return;
    await restoreBackup(pending.b);
    await loadGear();
    setPending(null);
    notifyProjectsChanged();
    toast('Данные восстановлены из копии');
  };

  const persist = async () => {
    const ok = await navigator.storage?.persist?.().catch(() => false);
    setPersisted(!!ok);
    toast(ok ? 'Браузер не будет удалять данные приложения' : 'Браузер не разрешил постоянное хранение');
  };

  return (
    <div class="screen">
      <div class="mhead"><h1>Настройки</h1></div>

      <section class="panel">
        <div class="lbl">Резервная копия</div>
        <p>Все проекты и расчёты хранятся только на этом устройстве. Копия — один файл, его можно сохранить в облако или перенести на другой телефон.</p>
        <p class="meta">{last ? `Последняя копия: ${fmtDate(last)} (${daysSince(last)} дн. назад)` : 'Копий ещё не было.'}</p>
        <div class="actions">
          <button class="btn primary" type="button" onClick={exportBackup}>Сохранить копию</button>
          <label class="btn" for="restore-file">Восстановить из файла</label>
          <input id="restore-file" class="sr-only" type="file" accept="application/json,.json" onChange={pick} />
        </div>
        {err ? <div class="alert warn" role="alert"><b>!</b><span>{err}</span></div> : null}
        {pending ? (
          <div class="alert crit">
            <b>!</b>
            <span>
              {pending.summary} Текущие данные на телефоне будут заменены содержимым копии.
              <span class="actions">
                <button class="btn danger" type="button" onClick={restore}>Заменить данные</button>
                <button class="btn" type="button" onClick={() => setPending(null)}>Отмена</button>
              </span>
            </span>
          </div>
        ) : null}
      </section>

      <section class="panel">
        <div class="lbl">Хранение данных</div>
        <p>
          {persisted
            ? 'Постоянное хранение включено: браузер не удалит данные при нехватке места.'
            : 'Браузер может очистить данные сайта при нехватке памяти. Включите постоянное хранение и делайте резервные копии.'}
        </p>
        {!persisted ? <div class="actions"><button class="btn" type="button" onClick={persist}>Включить постоянное хранение</button></div> : null}
      </section>

      <section class="panel">
        <div class="lbl">Установка на телефон</div>
        {canInstall ? (
          <div class="actions"><button class="btn primary" type="button" onClick={async () => { await deferredInstall?.prompt(); deferredInstall = null; setCanInstall(false); }}>Установить приложение</button></div>
        ) : (
          <p>Откройте меню браузера (⋮ или «Поделиться») и выберите «Добавить на главный экран». После первой загрузки приложение работает без интернета.</p>
        )}
      </section>

      <section class="panel">
        <div class="lbl">О приложении</div>
        <p>STAGE ENGINEER {__APP_VERSION__}. Все расчёты справочные. Решения по электропитанию, подвесу и нагрузкам на конструкции принимает квалифицированный специалист.</p>
      </section>
    </div>
  );
}

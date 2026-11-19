import { useEffect, useState } from 'preact/hooks';
import { CATEGORIES } from '../docparse/catalog';
import { deleteStock, listStock, type StockItem } from '../docparse/store';
import { CatIcon } from '../ui/CatIcon';

/**
 * Склад (кратко): что есть в наличии и фото кейсов.
 * Позиции заполняются из экрана «Разбор заявки». Полный учёт (серийные номера, выдача) — модуль D.
 */
export function StockScreen() {
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const load = () => listStock().then(setItems);
  useEffect(() => {
    load();
  }, []);

  return (
    <div class="screen">
      <div class="mhead"><h1>Склад</h1></div>
      <p class="note">Здесь то, что вы указали «на складе» при разборе заявок, и фото кейсов. Чтобы добавить или поправить позицию, откройте её в <a class="link" href="#/request">разборе заявки</a>. Полный учёт с серийными номерами и выдачей появится в модуле D.</p>
      {items === null ? null : items.length === 0 ? (
        <p class="note">Пока пусто.</p>
      ) : (
        CATEGORIES.map((c) => {
          const g = items.filter((i) => i.cat === c).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
          if (!g.length) return null;
          return (
            <section class="rq-group">
              <h2 class="h">{c} <span class="mono">{g.length}</span></h2>
              <div class="rq-list">
                {g.map((s) => (
                  <div class="rq-item">
                    <div class="rq-row">
                      <button class="rq-pic" type="button" onClick={() => s.photo && setPhoto(s.photo)} aria-label="Фото">
                        {s.photo ? <img src={s.photo} alt="" /> : <CatIcon cat={s.cat} />}
                      </button>
                      <div class="rq-main static">
                        <b>{s.name}</b>
                        <span class="meta">{s.caseNote ? `в кейсе: ${s.caseNote}` : ''}</span>
                      </div>
                      <div class="rq-qty">
                        {s.pcs !== undefined ? <span class="mono">{s.pcs} <small>шт</small></span> : null}
                        {s.cases !== undefined ? <span class="mono">{s.cases} <small>кейс.</small></span> : null}
                        <button class="link" type="button" onClick={async () => { await deleteStock(s.dictId); load(); }}>удалить</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
      {photo ? (
        <button class="photo-view" type="button" onClick={() => setPhoto(null)} aria-label="Закрыть фото"><img src={photo} alt="" /></button>
      ) : null}
    </div>
  );
}

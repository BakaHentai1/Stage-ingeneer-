import type { Values } from '../types';
import { fmtNum } from '../../core/format';
import { CABLE_TYPES, cableEnd, lineFromValues, parseList, pickStdLength } from './cable';

/** Список кабелей мероприятия: добавить текущую трассу, удалить, очистить. Хранится в поле list. */
export function CableListPanel({ values, set }: { values: Values; set: (k: string, v: string) => void }) {
  const list = parseList(values.list);
  const add = () => {
    const l = lineFromValues(values);
    if (!l) return;
    set('list', JSON.stringify([...list, l]));
  };
  const remove = (k: number) => set('list', JSON.stringify(list.filter((_, i) => i !== k)));
  return (
    <div>
      <div class="actions">
        <button class="btn" type="button" onClick={add}>Добавить в список</button>
        {list.length ? <button class="link danger" type="button" onClick={() => set('list', '[]')}>Очистить список</button> : null}
      </div>
      {list.length ? (
        <div class="cbl-list">
          {list.map((l, k) => (
            <div class="cbl-item">
              <span>
                <b>{k + 1}. {l.purpose || CABLE_TYPES[l.type].label}</b>
                <small>{cableEnd(l.src, 'src')} — {cableEnd(l.dst, 'dst')} · трасса {fmtNum(l.len, 1)} м → {pickStdLength(l.len) ? `${pickStdLength(l.len)} м` : 'бухта'} × {l.runs}</small>
              </span>
              <button class="icon-btn danger" type="button" aria-label="Удалить" onClick={() => remove(k)}>×</button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

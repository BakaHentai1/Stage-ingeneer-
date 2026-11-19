import { useEffect, useState } from 'preact/hooks';
import {
  KIND_LABEL, SPL_KIND_LABEL, allGear, deleteCustomModel, gearName, gearVersion, onGear, saveCustomModel,
  type SpeakerKind, type SpeakerModel, type SplKind,
} from '../calc/audio/gear';
import { num, type FieldDef, type Values } from '../calc/types';
import { ToolForm } from '../ui/Form';
import { uid } from '../core/db';
import { toast } from '../core/state';
import { fmtNum } from '../core/format';

const FIELDS: FieldDef[] = [
  { key: 'brand', label: 'Производитель', type: 'text' },
  { key: 'model', label: 'Модель', type: 'text' },
  { key: 'kind', label: 'Тип', type: 'select', options: (Object.keys(KIND_LABEL) as SpeakerKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })) },
  { key: 'active', label: 'Усилитель', type: 'select', options: [{ value: '1', label: 'Активная (встроенный)' }, { value: '0', label: 'Пассивная (внешний)' }] },
  { key: 'maxSpl', label: 'Макс. SPL на 1 м', unit: 'дБ', type: 'number' },
  { key: 'maxSplKind', label: 'Этот максимум', type: 'select', options: (Object.keys(SPL_KIND_LABEL) as SplKind[]).map((k) => ({ value: k, label: SPL_KIND_LABEL[k] })) },
  { key: 'contSpl', label: 'Длительный SPL, если указан', unit: 'дБ, пусто = нет', type: 'number' },
  { key: 'hAngle', label: 'Угол по горизонтали', unit: '°', type: 'number', showIf: (v) => v.kind !== 'sub' },
  { key: 'vAngle', label: 'Угол по вертикали', unit: '°', type: 'number', showIf: (v) => v.kind !== 'sub', hint: 'Для модуля линейного массива — вертикаль одного модуля' },
  { key: 'fLow', label: 'Нижняя частота', unit: 'Гц', type: 'number' },
  { key: 'fHigh', label: 'Верхняя частота', unit: 'Гц', type: 'number' },
  { key: 'ampPeak', label: 'Встроенный усилитель, пик', unit: 'Вт', type: 'number', showIf: (v) => v.active === '1' },
  { key: 'ampRms', label: 'Встроенный усилитель, RMS', unit: 'Вт', type: 'number', showIf: (v) => v.active === '1' },
  { key: 'sens', label: 'Чувствительность', unit: 'дБ 1 Вт/1 м', type: 'number', showIf: (v) => v.active === '0' },
  { key: 'powerAes', label: 'Мощность AES/RMS', unit: 'Вт', type: 'number', showIf: (v) => v.active === '0' },
  { key: 'z', label: 'Номинальный импеданс', unit: 'Ом', type: 'number', showIf: (v) => v.active === '0' },
  { key: 'weight', label: 'Вес', unit: 'кг', type: 'number' },
  { key: 'dimH', label: 'Высота', unit: 'мм', type: 'number' },
  { key: 'dimW', label: 'Ширина', unit: 'мм', type: 'number' },
  { key: 'dimD', label: 'Глубина', unit: 'мм', type: 'number' },
  { key: 'maxFlown', label: 'Макс. в подвесе (по документации)', unit: 'шт, пусто = нет', type: 'number' },
  { key: 'maxStacked', label: 'Макс. в стеке (по документации)', unit: 'шт, пусто = нет', type: 'number' },
  { key: 'source', label: 'Источник данных', type: 'text', hint: 'Ссылка на паспорт или название документа' },
];

const EMPTY: Values = {
  brand: '', model: '', kind: 'point', active: '0', maxSpl: '', maxSplKind: 'peak', contSpl: '', hAngle: '90', vAngle: '50',
  fLow: '60', fHigh: '20000', ampPeak: '', ampRms: '', sens: '', powerAes: '', z: '8', weight: '', dimH: '', dimW: '', dimD: '',
  maxFlown: '', maxStacked: '', source: '',
};

const s = (n: number | undefined) => (n === undefined ? '' : String(n));

function toValues(m: SpeakerModel): Values {
  return {
    brand: m.brand, model: m.model, kind: m.kind, active: m.active ? '1' : '0', maxSpl: s(m.maxSpl), maxSplKind: m.maxSplKind,
    contSpl: s(m.contSpl), hAngle: s(m.hAngle), vAngle: s(m.vAngle), fLow: s(m.fLow), fHigh: s(m.fHigh),
    ampPeak: s(m.ampPeak), ampRms: s(m.ampRms), sens: s(m.sens), powerAes: s(m.powerAes), z: s(m.z),
    weight: s(m.weight), dimH: s(m.dims[0]), dimW: s(m.dims[1]), dimD: s(m.dims[2]),
    maxFlown: s(m.maxFlown), maxStacked: s(m.maxStacked), source: m.source,
  };
}

const opt = (v: string) => {
  const n = num(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Проверка и сборка модели из формы. Возвращает текст ошибки или модель. */
export function modelFromValues(v: Values, id: string): SpeakerModel | string {
  if (!v.model.trim()) return 'Укажите название модели.';
  const maxSpl = num(v.maxSpl);
  if (!Number.isFinite(maxSpl) || maxSpl < 80 || maxSpl > 160) return 'Макс. SPL — число от 80 до 160 дБ.';
  const kind = (['line', 'point', 'sub'].includes(v.kind) ? v.kind : 'point') as SpeakerKind;
  const active = v.active === '1';
  const hA = opt(v.hAngle), vA = opt(v.vAngle);
  if (kind !== 'sub' && (!hA || !vA || hA <= 0 || hA >= 180 || vA <= 0 || vA >= 180)) return 'Углы раскрытия — от 1 до 179°.';
  const fLow = num(v.fLow), fHigh = num(v.fHigh);
  if (!(fLow > 0 && fHigh > fLow)) return 'Проверьте диапазон частот.';
  if (!active) {
    const sens = opt(v.sens), p = opt(v.powerAes), z = opt(v.z);
    if (!sens || sens < 70 || sens > 120) return 'Для пассивной модели нужна чувствительность (70–120 дБ).';
    if (!p || p <= 0) return 'Для пассивной модели нужна мощность AES/RMS.';
    if (!z || z <= 0) return 'Для пассивной модели нужен импеданс.';
  }
  const weight = num(v.weight);
  if (!(weight > 0)) return 'Укажите вес, кг (нужен для расчёта нагрузки на подвес и стек).';
  const contSpl = opt(v.contSpl);
  if (contSpl !== undefined && contSpl > maxSpl && v.maxSplKind !== 'cont') return 'Длительный SPL не может быть больше пикового.';
  return {
    id, brand: v.brand.trim(), model: v.model.trim(), kind, active, maxSpl,
    maxSplKind: (['peak', 'cont', 'unspec'].includes(v.maxSplKind) ? v.maxSplKind : 'unspec') as SplKind,
    contSpl, hAngle: kind === 'sub' ? undefined : hA, vAngle: kind === 'sub' ? undefined : vA, fLow, fHigh,
    ampPeak: active ? opt(v.ampPeak) : undefined, ampRms: active ? opt(v.ampRms) : undefined,
    sens: active ? undefined : opt(v.sens), powerAes: active ? undefined : opt(v.powerAes), z: active ? undefined : opt(v.z),
    weight, dims: [opt(v.dimH) ?? 0, opt(v.dimW) ?? 0, opt(v.dimD) ?? 0],
    drivers: '', maxFlown: opt(v.maxFlown), maxStacked: opt(v.maxStacked), source: v.source.trim(), notes: [], custom: true,
  };
}

function Spec({ m }: { m: SpeakerModel }) {
  const rows: [string, string][] = [
    ['Тип', KIND_LABEL[m.kind] + (m.active ? ', активная' : ', пассивная')],
    ['Макс. SPL на 1 м', `${m.maxSpl} дБ (${SPL_KIND_LABEL[m.maxSplKind]})`],
  ];
  if (m.contSpl !== undefined) rows.push(['Длительный SPL', `${m.contSpl} дБ`]);
  if (m.hAngle) rows.push(['Раскрытие Г × В', `${m.hAngle}° × ${m.vAngle}°`]);
  rows.push(['Частоты', `${m.fLow}–${m.fHigh} Гц`]);
  if (m.ampPeak || m.ampRms) rows.push(['Усилитель', [m.ampPeak ? `${m.ampPeak} Вт пик` : '', m.ampRms ? `${m.ampRms} Вт RMS` : 'RMS не указана'].filter(Boolean).join(', ')]);
  if (m.sens) rows.push(['Чувствительность', `${m.sens} дБ 1 Вт/1 м`]);
  if (m.powerAes) rows.push(['Мощность AES/RMS', `${m.powerAes} Вт`]);
  if (m.z) rows.push(['Импеданс', `${m.z} Ом`]);
  rows.push(['Вес', `${fmtNum(m.weight, 1)} кг`]);
  if (m.dims[0]) rows.push(['В × Ш × Г', `${m.dims.join(' × ')} мм`]);
  if (m.drivers) rows.push(['Динамики', m.drivers]);
  if (m.maxFlown) rows.push(['Подвес', `до ${m.maxFlown} шт${m.flyBar ? ` (рама ${m.flyBar.name}, ${fmtNum(m.flyBar.weight, 2)} кг)` : ''}`]);
  if (m.maxStacked) rows.push(['Стек', `до ${m.maxStacked} шт`]);
  return (
    <div>
      <div class="spec">{rows.map(([k, v]) => <><span class="k">{k}</span><span class="mono">{v}</span></>)}</div>
      {m.notes.length ? <ul class="limits">{m.notes.map((n) => <li>{n}</li>)}</ul> : null}
      <p class="note">{m.custom ? (m.source ? `Источник: ${m.source}` : 'Характеристики введены вами.') : <>Источник: <a class="link" href={m.source} target="_blank" rel="noopener">{m.source.replace('https://', '')}</a> (проверено 19.11.2026)</>}</p>
    </div>
  );
}

export function GearScreen() {
  const [, setV] = useState(gearVersion());
  useEffect(() => onGear(() => setV(gearVersion())), []);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; values: Values } | null>(null);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!edit) return;
    const m = modelFromValues(edit.values, edit.id);
    if (typeof m === 'string') { setErr(m); return; }
    await saveCustomModel(m);
    toast('Модель сохранена');
    setEdit(null);
    setErr('');
    setOpen(m.id);
  };

  const list = allGear();
  return (
    <div class="screen">
      <a class="back no-print" href="#/m/a">‹ Audio Calculator</a>
      <div class="mhead"><span class="code">A</span><h1>База акустики</h1></div>
      <p class="note">Модели из базы можно выбрать в калькуляторах модуля A: углы, SPL, вес и ограничения подставятся сами. Данные RCF взяты с официальных страниц моделей; чего производитель не публикует, здесь нет.</p>

      {edit ? (
        <section class="panel">
          <div class="panel-h"><span class="lbl">{list.some((m) => m.id === edit.id) ? 'Изменить модель' : 'Новая модель'}</span></div>
          <ToolForm fields={FIELDS} values={edit.values} onChange={(k, v) => setEdit({ ...edit, values: { ...edit.values, [k]: v } })} />
          {err ? <div class="calc-err" role="alert">{err}</div> : null}
          <div class="actions">
            <button class="btn primary" type="button" onClick={save}>Сохранить</button>
            <button class="btn" type="button" onClick={() => { setEdit(null); setErr(''); }}>Отмена</button>
          </div>
        </section>
      ) : (
        <div class="actions"><button class="btn primary" type="button" onClick={() => setEdit({ id: 'u-' + uid(), values: { ...EMPTY } })}>Добавить свою модель</button></div>
      )}

      <div class="gear-list">
        {list.map((m) => (
          <div class="panel">
            <button class="row link-row" type="button" onClick={() => setOpen(open === m.id ? null : m.id)} aria-expanded={open === m.id}>
              <span><b>{gearName(m)}</b>{m.custom ? <small> · своя</small> : null}<span class="meta">{KIND_LABEL[m.kind]} · {m.maxSpl} дБ{m.hAngle ? ` · ${m.hAngle}°×${m.vAngle}°` : ''} · {fmtNum(m.weight, 1)} кг</span></span>
              <span class="chev">{open === m.id ? '−' : '+'}</span>
            </button>
            {open === m.id ? (
              <div>
                <Spec m={m} />
                <div class="actions">
                  {m.custom ? (
                    <>
                      <button class="btn" type="button" onClick={() => setEdit({ id: m.id, values: toValues(m) })}>Изменить</button>
                      <button class="btn" type="button" onClick={async () => { await deleteCustomModel(m.id); toast('Модель удалена'); }}>Удалить</button>
                    </>
                  ) : (
                    <button class="btn" type="button" onClick={() => setEdit({ id: 'u-' + uid(), values: { ...toValues(m), model: m.model + ' (копия)', source: m.source } })}>Создать на её основе</button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

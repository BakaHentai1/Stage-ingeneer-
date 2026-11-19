import { useEffect, useMemo, useState } from 'preact/hooks';
import { BASE_DICT, CATEGORIES, compileDict, mergeDict, type Category, type DictEntry } from '../docparse/catalog';
import { extractFile, textToRows } from '../docparse/extract';
import { aggregate, parseRows, type Need, type Unit } from '../docparse/parse';
import {
  compare, getCustomDict, getLastAnalysis, listStock, saveLastAnalysis, saveStock, teach,
  type Analysis, type Line, type StockItem,
} from '../docparse/store';
import { requestCsv } from '../docparse/export';
import { resizeImage } from '../core/image';
import { downloadText, safeName, stamp } from '../core/download';
import { toast } from '../core/state';
import { CatIcon } from '../ui/CatIcon';

type Filter = 'all' | 'todo' | 'short';

export function RequestScreen() {
  const [custom, setCustom] = useState<DictEntry[]>([]);
  const [a, setA] = useState<Analysis | null | undefined>(undefined);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [teaching, setTeaching] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    getCustomDict().then(setCustom);
    getLastAnalysis().then(setA);
    listStock().then(setStock);
  }, []);

  const merged = useMemo(() => mergeDict(custom), [custom]);
  const dict = useMemo(() => compileDict(merged), [merged]);
  const parsed = useMemo(() => (a ? parseRows(a.rows, dict) : null), [a, dict]);
  const lines = useMemo<Line[]>(() => {
    if (!a || !parsed) return [];
    const needs: Need[] = aggregate(parsed.found);
    for (const m of a.manual) {
      const ex = needs.find((n) => n.key === m.key);
      if (ex) ex.qty += m.qty;
      else needs.push({ key: m.key, id: m.id, name: m.name, cat: m.cat, unit: m.unit, qty: m.qty, guessed: false, reserve: false, sources: [] });
    }
    const manualKeys = new Set(a.manual.map((m) => m.key));
    return compare(needs, stock, a.overrides).map((l) => (manualKeys.has(l.key) && !l.sources.length ? { ...l, manual: true } : l));
  }, [a, parsed, stock]);

  const update = async (patch: Partial<Analysis>) => {
    if (!a) return;
    const next = { ...a, ...patch };
    setA(next);
    await saveLastAnalysis(next);
  };

  const load = async (fileName: string, rows: string[][], extNotes: string[] = []) => {
    const next: Analysis = { fileName, rows, loadedAt: Date.now(), overrides: {}, packed: {}, manual: [] };
    setA(next);
    setNotes(extNotes);
    setOpen(null);
    setFilter('all');
    await saveLastAnalysis(next);
  };

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const ex = await extractFile(f);
      if (!ex.rows.length) throw new Error('В документе не найден текст.');
      await load(f.name, ex.rows, ex.notes);
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Не удалось прочитать файл.');
    } finally {
      setBusy(false);
    }
  };

  const onPaste = async () => {
    const rows = textToRows(pasteText);
    if (!rows.length) return;
    await load('Текст из сообщения', rows);
    setPasting(false);
    setPasteText('');
  };

  const reloadStock = async () => setStock(await listStock());

  const shown = lines.filter((l) => (filter === 'todo' ? !a?.packed[l.key] : filter === 'short' ? l.status !== 'ok' : true));
  const byCat = CATEGORIES.map((c) => ({ cat: c, items: shown.filter((l) => l.cat === c) })).filter((g) => g.items.length);
  const packedCount = lines.filter((l) => a?.packed[l.key]).length;
  const shortCount = lines.filter((l) => l.status === 'short').length;
  const unknownCount = lines.filter((l) => l.status === 'unknown').length;
  const guessCount = lines.filter((l) => l.guessed && a?.overrides[l.key] === undefined).length;

  const exportCsv = () => {
    if (!a) return;
    downloadText(`Заявка_${safeName(parsed?.title || a.fileName)}_${stamp()}.csv`, requestCsv(parsed?.title || a.fileName, lines, a.packed), 'text/csv');
  };

  return (
    <div class="screen">
      <a class="back no-print" href="#/">‹ Главная</a>
      <div class="mhead"><span class="code">Z</span><h1>Разбор заявки</h1></div>

      <section class="panel no-print">
        {a ? null : <p class="note">Загрузите документ от начальника (Word .docx, можно .doc, Excel или текст). Разбор идёт прямо в телефоне, файл никуда не отправляется.</p>}
        <div class="actions">
          <label class={`btn primary ${busy ? 'disabled' : ''}`}>
            {busy ? 'Читаю…' : a ? 'Загрузить другой документ' : 'Выбрать документ'}
            <input type="file" accept=".docx,.doc,.xlsx,.txt,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" hidden onChange={onFile} disabled={busy} />
          </label>
          <button class="btn" type="button" onClick={() => setPasting(!pasting)}>Вставить текст</button>
        </div>
        {pasting ? (
          <div class="stack">
            <textarea class="paste" rows={8} placeholder="Скопируйте сюда текст заявки из мессенджера" value={pasteText} onInput={(e) => setPasteText((e.currentTarget as HTMLTextAreaElement).value)} />
            <div class="actions"><button class="btn primary" type="button" disabled={!pasteText.trim()} onClick={onPaste}>Разобрать</button></div>
          </div>
        ) : null}
        {err ? <div class="alert crit"><b>!</b><span>{err}</span></div> : null}
        {notes.map((n) => <div class="alert warn"><b>!</b><span>{n}</span></div>)}
      </section>

      {a && parsed ? (
        <>
          <div class="rq-head">
            <div class="eyebrow">{a.fileName}</div>
            <b>{parsed.title || 'Заявка'}</b>
            <div class="chips">
              <span class="chip">{lines.length} поз.</span>
              <span class={`chip ${packedCount === lines.length && lines.length ? 'ok' : ''}`}>погружено {packedCount}/{lines.length}</span>
              {shortCount ? <span class="chip crit">не хватает: {shortCount}</span> : null}
              {unknownCount ? <span class="chip">склад не указан: {unknownCount}</span> : null}
              {guessCount ? <span class="chip warn">кол-во не указано: {guessCount}</span> : null}
            </div>
          </div>

          <div class="seg no-print" role="tablist">
            <button type="button" class={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>Всё</button>
            <button type="button" class={filter === 'todo' ? 'on' : ''} onClick={() => setFilter('todo')}>Не погружено</button>
            <button type="button" class={filter === 'short' ? 'on' : ''} onClick={() => setFilter('short')}>Проверить склад</button>
          </div>

          {byCat.map((g) => (
            <section class="rq-group">
              <h2 class="h">{g.cat} <span class="mono">{g.items.length}</span></h2>
              <div class="rq-list">
                {g.items.map((l) => (
                  <Item
                    key={l.key}
                    l={l}
                    packed={!!a.packed[l.key]}
                    open={open === l.key}
                    override={a.overrides[l.key]}
                    onToggleOpen={() => setOpen(open === l.key ? null : l.key)}
                    onPack={() => update({ packed: { ...a.packed, [l.key]: !a.packed[l.key] } })}
                    onQty={(q) => update({ overrides: { ...a.overrides, [l.key]: q } })}
                    onStockSaved={reloadStock}
                    onPhoto={setPhoto}
                  />
                ))}
              </div>
            </section>
          ))}
          {!shown.length ? <p class="note">{filter === 'todo' ? 'Всё погружено.' : filter === 'short' ? 'По складу всё сходится.' : 'Оборудование не найдено.'}</p> : null}

          <div class="no-print">
            {adding ? (
              <AddManual merged={merged} onCancel={() => setAdding(false)} onAdd={(m) => { update({ manual: [...a.manual, m] }); setAdding(false); }} />
            ) : (
              <div class="actions">
                <button class="btn" type="button" onClick={() => setAdding(true)}>Добавить позицию</button>
                <button class="btn" type="button" onClick={exportCsv}>CSV</button>
                <button class="btn" type="button" onClick={() => window.print()}>PDF</button>
              </div>
            )}
          </div>

          {parsed.notes.length ? (
            <section class="panel no-print">
              <div class="panel-h"><span class="lbl">Строки без оборудования ({parsed.notes.length})</span></div>
              <p class="note">Если здесь есть техника, нажмите «Научить» и укажите, что это. В следующий раз слово распознается само.</p>
              <div class="rq-notes">
                {parsed.notes.map((n) => (
                  <div class="rq-note">
                    <span><span class="meta mono">стр. {n.line}{n.zone ? ` · ${n.zone}` : ''}</span> {n.raw}</span>
                    {teaching === `n${n.line}` ? null : <button class="link" type="button" onClick={() => setTeaching(`n${n.line}`)}>Научить</button>}
                    {teaching === `n${n.line}` ? (
                      <TeachForm
                        merged={merged}
                        initial={guessAlias(n.raw)}
                        onCancel={() => setTeaching(null)}
                        onDone={async () => { setTeaching(null); setCustom(await getCustomDict()); toast('Запомнил. Заявка разобрана заново.'); }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <p class="note no-print">Количество с пометкой «?» в заявке не указано, подставлена 1: нажмите на позицию, чтобы поправить. Разбор автоматический, сверяйте с документом.</p>
        </>
      ) : a === null ? (
        <p class="note">Пока ничего не загружено. Последний разбор сохранится, даже если закрыть приложение.</p>
      ) : null}

      {photo ? (
        <button class="photo-view" type="button" onClick={() => setPhoto(null)} aria-label="Закрыть фото">
          <img src={photo} alt="" />
        </button>
      ) : null}
    </div>
  );
}

/** Из строки заявки делает заготовку слова для обучения: без чисел, единиц и знаков. */
export function guessAlias(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, ' ')
    .replace(/\d+([.,]\d+)?\s*(штук[\p{L}]*|шт\.?|кейс[\p{L}]*|м2|м|см)?/giu, ' ')
    .replace(/[–—=:;,.+*"”|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .slice(0, 3)
    .join(' ');
}

function statusText(l: Line): string {
  if (l.status === 'unknown') return 'склад ?';
  if (l.status === 'short') return `не хватает ${l.shortBy}`;
  return `есть ${l.have}`;
}

function Item(props: {
  l: Line;
  packed: boolean;
  open: boolean;
  override?: number;
  onToggleOpen: () => void;
  onPack: () => void;
  onQty: (q: number) => void;
  onStockSaved: () => void;
  onPhoto: (src: string) => void;
}) {
  const { l, packed, open } = props;
  const zones = [...new Set(l.sources.map((s) => s.zone).filter(Boolean))];
  const guessed = l.guessed && props.override === undefined;
  return (
    <div class={`rq-item st-${l.status} ${packed ? 'packed' : ''}`}>
      <div class="rq-row">
        <button class="rq-check" type="button" aria-pressed={packed} aria-label={packed ? 'Снять отметку' : 'Отметить: погрузил'} onClick={props.onPack}>
          {packed ? '✓' : ''}
        </button>
        <button class="rq-pic" type="button" onClick={() => (l.stock?.photo ? props.onPhoto(l.stock.photo) : props.onToggleOpen())} aria-label="Фото">
          {l.stock?.photo ? <img src={l.stock.photo} alt="" /> : <CatIcon cat={l.cat} />}
        </button>
        <button class="rq-main" type="button" onClick={props.onToggleOpen} aria-expanded={open}>
          <b>{l.name}</b>
          <span class="meta">
            {zones.length ? zones.join(', ') : l.manual ? 'добавлено вручную' : 'общее'}
            {l.stock?.caseNote ? ` · в кейсе: ${l.stock.caseNote}` : ''}
          </span>
          <span class="rq-tags">
            {guessed ? <span class="chip warn">кол-во ?</span> : null}
            {l.reserve ? <span class="chip">запас</span> : null}
          </span>
        </button>
        <div class="rq-qty">
          <span class="mono">{l.need}{guessed ? '?' : ''}</span>
          <small>{l.unit}</small>
          <small class={`st st-${l.status}`}>{statusText(l)}</small>
        </div>
      </div>
      {open ? <ItemDetails {...props} /> : null}
    </div>
  );
}

function num(s: string): number | undefined {
  const t = s.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

function ItemDetails({ l, onQty, onStockSaved, override }: { l: Line; onQty: (q: number) => void; onStockSaved: () => void; override?: number }) {
  const [need, setNeed] = useState(String(override ?? l.need));
  const [pcs, setPcs] = useState(l.stock?.pcs !== undefined ? String(l.stock.pcs) : '');
  const [cases, setCases] = useState(l.stock?.cases !== undefined ? String(l.stock.cases) : '');
  const [caseNote, setCaseNote] = useState(l.stock?.caseNote ?? '');
  const [busy, setBusy] = useState(false);

  const saveAll = async (photo?: string | null) => {
    const n = num(need);
    if (n !== undefined && n !== l.need) onQty(n);
    await saveStock({
      dictId: l.id, name: l.name, cat: l.cat,
      pcs: num(pcs), cases: num(cases), caseNote: caseNote.trim() || undefined,
      photo: photo === null ? undefined : photo ?? l.stock?.photo,
    });
    onStockSaved();
  };

  const onPhotoFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    setBusy(true);
    try {
      await saveAll(await resizeImage(f, 640));
      toast('Фото сохранено');
    } catch {
      toast('Не удалось обработать фото');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="rq-details">
      {l.sources.length ? (
        <div class="rq-src">
          {l.sources.map((s) => (
            <div>
              <span class="meta mono">стр. {s.line}{s.zone ? ` · ${s.zone}` : ''} → {s.explicit ? s.qty : s.qty ? `${s.qty}?` : 'учтено выше'}</span>
              <span>«{s.frag}»{s.details.length ? <em> ({s.details.join('; ')})</em> : null}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div class="form rq-form">
        <label class="field"><span class="fl">Нужно, {l.unit}</span><input type="text" inputMode="numeric" value={need} onInput={(e) => setNeed((e.currentTarget as HTMLInputElement).value)} /></label>
        <label class="field"><span class="fl">На складе, шт</span><input type="text" inputMode="numeric" placeholder="?" value={pcs} onInput={(e) => setPcs((e.currentTarget as HTMLInputElement).value)} /></label>
        <label class="field"><span class="fl">На складе, кейсов</span><input type="text" inputMode="numeric" placeholder="?" value={cases} onInput={(e) => setCases((e.currentTarget as HTMLInputElement).value)} /></label>
        <label class="field wide"><span class="fl">Что лежит в кейсе</span><input type="text" placeholder="например: 2 прибора + кабели питания" value={caseNote} onInput={(e) => setCaseNote((e.currentTarget as HTMLInputElement).value)} /></label>
      </div>
      <div class="actions">
        <button class="btn primary" type="button" onClick={async () => { await saveAll(); toast('Сохранено'); }}>Сохранить</button>
        <label class="btn">
          {busy ? '…' : l.stock?.photo ? 'Заменить фото' : 'Фото кейса'}
          <input type="file" accept="image/*" capture="environment" hidden onChange={onPhotoFile} />
        </label>
        {l.stock?.photo ? <button class="btn" type="button" onClick={() => saveAll(null)}>Убрать фото</button> : null}
        <button class="btn danger" type="button" onClick={() => onQty(0)}>Убрать из списка</button>
      </div>
      <p class="note">Склад и фото запоминаются для этой позиции и будут показаны в следующих заявках.</p>
    </div>
  );
}

function EntrySelect({ merged, value, onChange }: { merged: DictEntry[]; value: string; onChange: (v: string) => void }) {
  const uniq = merged.filter((e, i) => merged.findIndex((x) => x.id === e.id) === i);
  return (
    <select value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}>
      <option value="__new">+ Новая позиция</option>
      {CATEGORIES.map((c) => {
        const items = uniq.filter((e) => e.cat === c);
        return items.length ? <optgroup label={c}>{items.map((e) => <option value={e.id}>{e.name}</option>)}</optgroup> : null;
      })}
    </select>
  );
}

function TeachForm({ merged, initial, onCancel, onDone }: { merged: DictEntry[]; initial: string; onCancel: () => void; onDone: () => void }) {
  const [alias, setAlias] = useState(initial);
  const [target, setTarget] = useState('__new');
  const [name, setName] = useState(initial ? initial[0].toUpperCase() + initial.slice(1) : '');
  const [cat, setCat] = useState<Category>('Прочее');
  const save = async () => {
    const al = alias.trim().toLowerCase();
    if (!al) return;
    if (target === '__new') {
      if (!name.trim()) return;
      await teach({ id: `u-${Date.now().toString(36)}`, name: name.trim(), cat }, al);
    } else {
      const e = merged.find((x) => x.id === target) ?? BASE_DICT.find((x) => x.id === target)!;
      await teach({ id: e.id, name: e.name, cat: e.cat }, al);
    }
    onDone();
  };
  return (
    <div class="form rq-form rq-teach">
      <label class="field wide"><span class="fl">Слово из заявки</span><input type="text" value={alias} onInput={(e) => setAlias((e.currentTarget as HTMLInputElement).value)} /><span class="hint">Оставьте только название, без количества. «*» в конце слова = любое окончание.</span></label>
      <label class="field wide"><span class="fl">Это</span><EntrySelect merged={merged} value={target} onChange={setTarget} /></label>
      {target === '__new' ? (
        <>
          <label class="field"><span class="fl">Название</span><input type="text" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} /></label>
          <label class="field"><span class="fl">Категория</span>
            <select value={cat} onChange={(e) => setCat((e.currentTarget as HTMLSelectElement).value as Category)}>{CATEGORIES.map((c) => <option value={c}>{c}</option>)}</select>
          </label>
        </>
      ) : null}
      <div class="actions wide">
        <button class="btn primary" type="button" onClick={save}>Запомнить</button>
        <button class="btn" type="button" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}

function AddManual({ merged, onAdd, onCancel }: { merged: DictEntry[]; onAdd: (m: Analysis['manual'][number]) => void; onCancel: () => void }) {
  const [target, setTarget] = useState(merged[0]?.id ?? '__new');
  const [name, setName] = useState('');
  const [cat, setCat] = useState<Category>('Прочее');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState<Unit>('шт');
  const add = () => {
    const q = num(qty);
    if (!q) return;
    if (target === '__new') {
      if (!name.trim()) return;
      const id = `m-${Date.now().toString(36)}`;
      onAdd({ key: `${id}|${unit}`, id, name: name.trim(), cat, unit, qty: q });
    } else {
      const e = merged.find((x) => x.id === target)!;
      onAdd({ key: `${e.id}|${unit}`, id: e.id, name: e.name, cat: e.cat, unit, qty: q });
    }
  };
  return (
    <section class="panel">
      <span class="lbl">Добавить позицию</span>
      <div class="form rq-form">
        <label class="field wide"><span class="fl">Что</span><EntrySelect merged={merged} value={target} onChange={setTarget} /></label>
        {target === '__new' ? (
          <>
            <label class="field"><span class="fl">Название</span><input type="text" value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} /></label>
            <label class="field"><span class="fl">Категория</span>
              <select value={cat} onChange={(e) => setCat((e.currentTarget as HTMLSelectElement).value as Category)}>{CATEGORIES.map((c) => <option value={c}>{c}</option>)}</select>
            </label>
          </>
        ) : null}
        <label class="field"><span class="fl">Количество</span><input type="text" inputMode="numeric" value={qty} onInput={(e) => setQty((e.currentTarget as HTMLInputElement).value)} /></label>
        <label class="field"><span class="fl">Единица</span>
          <select value={unit} onChange={(e) => setUnit((e.currentTarget as HTMLSelectElement).value as Unit)}><option value="шт">шт</option><option value="кейс">кейс</option><option value="компл">компл</option></select>
        </label>
      </div>
      <div class="actions">
        <button class="btn primary" type="button" onClick={add}>Добавить</button>
        <button class="btn" type="button" onClick={onCancel}>Отмена</button>
      </div>
    </section>
  );
}

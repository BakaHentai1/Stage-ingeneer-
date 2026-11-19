import { toCsv } from '../core/csv';
import type { WiringResult } from './model';

export function wiringRows(title: string, r: WiringResult): (string | number)[][] {
  const rows: (string | number)[][] = [];
  rows.push([title, r.mixerLabel, r.transportLabel]);
  rows.push([]);
  rows.push(['Patch List']);
  rows.push(['Канал', 'Источник', 'Устройство', '48 В', 'Вход', 'Кабель', 'Длина, м']);
  r.inputs.forEach((i) => rows.push([i.ch, i.name, i.device, i.phantom ? 'да' : '', i.inputAt, i.cable, i.len ?? '>100']));
  rows.push([]);
  rows.push(['Выходы']);
  rows.push(['Выход', 'Шина', 'Куда', 'Кабель', 'Длина, м']);
  r.outputs.forEach((o) => rows.push([o.out, o.bus, o.dest, o.cable, o.len ?? '>100']));
  rows.push([]);
  rows.push(['Список кабелей']);
  rows.push(['Тип', 'Разъёмы', 'Длина, м', 'Кол-во']);
  r.cables.forEach((c) => rows.push([c.kind, c.connectors, c.len, c.qty]));
  rows.push([]);
  rows.push(['Сетевое питание']);
  r.power.forEach((p) => rows.push([p.device, p.qty, p.where]));
  rows.push([]);
  r.warnings.forEach((w) => rows.push(['Предупреждение', w.text]));
  return rows;
}

export function wiringCsv(title: string, r: WiringResult): string {
  return toCsv(wiringRows(title, r));
}

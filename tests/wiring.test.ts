import { describe, expect, it } from 'vitest';
import { defaultRig, generate, type Rig } from '../src/wiring/model';
import { wiringCsv } from '../src/wiring/export';

const rig = (p: Partial<Rig> = {}): Rig => ({ ...defaultRig(), ...p });
const qty = (r: ReturnType<typeof generate>, kind: string) => r.cables.filter((c) => c.kind === kind).reduce((a, c) => a + c.qty, 0);

describe('Генератор схем: входы', () => {
  it('пример по умолчанию: 12 моно каналов, плейбэк в ST1', () => {
    const r = generate(rig());
    // Бочка, Малый, OH L/R, Бас, Гитара, Клавиши L/R, Вокал, Бэк, Ведущий = 11 моно; плейбэк — ST1
    expect(r.inputs.filter((i) => !i.ch.startsWith('ST'))).toHaveLength(11);
    expect(r.inputs.find((i) => i.ch === 'ST1')?.name).toBe('Плейбэк');
    expect(r.inputs[2].name).toBe('Overhead L');
    expect(r.inputs[2].inputAt).toBe('AR2412 вх 3');
    expect(r.inputs[2].phantom).toBe(true);
  });

  it('микрофонных кабелей столько же, сколько сценических входов; длина округлена до 10 м', () => {
    const r = generate(rig({ stageLen: 8 }));
    const mic = r.cables.filter((c) => c.kind === 'Микрофонный');
    expect(mic).toHaveLength(1);
    expect(mic[0]).toMatchObject({ len: 10, qty: 11 });
  });

  it('dSNAKE: основной и резервный кабель, длина 30 м', () => {
    const r = generate(rig({ distFoh: 28 }));
    expect(r.cables.find((c) => c.kind === 'Сетевой dSNAKE')?.len).toBe(30);
    expect(qty(r, 'Сетевой dSNAKE (резерв)')).toBe(1);
  });

  it('переполнение входов Qu-16 — критическое предупреждение', () => {
    const sources = Array.from({ length: 17 }, (_, i) => ({ id: String(i), name: `Мик ${i + 1}`, kind: 'vocal' as const, stereo: false }));
    const r = generate(rig({ sources }));
    expect(r.warnings.some((w) => w.level === 'crit' && w.text.includes('17 моно'))).toBe(true);
  });

  it('аналоговый пульт без стейджбокса переходит на мультикор', () => {
    const r = generate(rig({ mixer: 'analog', transport: 'stagebox', analogInputs: 24 }));
    expect(r.transportLabel).toContain('мультикор');
    expect(r.inputs[0].inputAt).toBe('Мультикор вх 1');
    // у аналогового нет ST: плейбэк занимает 2 моно канала у пульта
    expect(r.inputs.filter((i) => i.name.startsWith('Плейбэк'))).toHaveLength(2);
  });

  it('прямые кабели: длина = сцена + до пульта', () => {
    const r = generate(rig({ transport: 'direct', stageLen: 5, distFoh: 20 }));
    expect(r.inputs[0].len).toBe(25);
  });
});

describe('Генератор схем: выходы и усилители', () => {
  it('порядок выходов: Main L, Main R, сабы на Mix 1, мониторы на Mix 2–4', () => {
    const r = generate(rig());
    expect(r.outputs.map((o) => o.bus)).toEqual(['Main L', 'Main R', 'Mix 1', 'Mix 2', 'Mix 3', 'Mix 4']);
    expect(r.outputs[0].out).toBe('AR2412 вых 1');
  });

  it('после 4 моно миксов Qu идут стерео миксы 5/6, 7/8, 9/10', () => {
    const r = generate(rig({ subs: 0, monitors: 7 }));
    expect(r.outputs.slice(2).map((o) => o.bus)).toEqual([
      'Mix 1', 'Mix 2', 'Mix 3', 'Mix 4',
      'Mix 5/6 (стерео, моно-сумма)', 'Mix 7/8 (стерео, моно-сумма)', 'Mix 9/10 (стерео, моно-сумма)',
    ]);
  });

  it('мониторов больше, чем миксов — предупреждение и Link-кабели', () => {
    const r = generate(rig({ subs: 0, monitors: 9 }));
    expect(r.warnings.some((w) => w.text.includes('ещё на 2'))).toBe(true);
    expect(qty(r, 'Линейный (Link)')).toBe(2);
  });

  it('AB168: 8 выходов, при 9 выходах — критическое предупреждение', () => {
    const r = generate(rig({ stagebox: 'AB168', subs: 2, monitors: 6 }));
    expect(r.outputs).toHaveLength(9);
    expect(r.warnings.some((w) => w.level === 'crit' && w.text.includes('9 выходов'))).toBe(true);
  });

  it('пассивные порталы по 2 на канал 8 Ом: 4 Ом, 2 канала, 1 усилитель, 4 акустических кабеля', () => {
    const r = generate(rig({ mainsType: 'passive', mainsPerSide: 2, perChannel: 2, passiveZ: 8, subs: 0, monitors: 0 }));
    expect(r.amps).toEqual({ channels: 2, units: 1, loadZ: 4 });
    expect(qty(r, 'Акустический')).toBe(4);
  });

  it('нагрузка ниже минимума усилителя — критическое предупреждение', () => {
    const r = generate(rig({ mainsType: 'passive', mainsPerSide: 4, perChannel: 4, passiveZ: 8, ampMinZ: 4, subs: 0, monitors: 0 }));
    expect(r.amps?.loadZ).toBe(2);
    expect(r.warnings.some((w) => w.level === 'crit' && w.text.includes('ниже минимума'))).toBe(true);
  });

  it('всегда есть предупреждение об электропитании', () => {
    expect(generate(rig()).warnings.some((w) => w.text.startsWith('Электропитание'))).toBe(true);
  });
});

describe('Экспорт схемы в CSV', () => {
  it('содержит Patch List, выходы и кабели', () => {
    const csv = wiringCsv('Тест', generate(rig()));
    expect(csv).toContain('Patch List');
    expect(csv).toContain('1;Бочка;');
    expect(csv).toContain('Main L');
    expect(csv).toContain('Список кабелей');
  });
});

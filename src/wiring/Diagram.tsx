import type { WiringResult } from './model';

const ROW = 24;
const W = 630;
const SRC_X = 8, SRC_W = 172;
const BOX_X = 236, BOX_W = 124;
const MIX_X = 450, MIX_W = 172;

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** Схема подключения: сцена (источники, стейджбокс, акустика) слева, FOH (пульт) справа. */
export function Diagram({ r, transport }: { r: WiringResult; transport: 'stagebox' | 'multicore' | 'direct' }) {
  const stageIn = r.inputs.filter((i) => i.inputAt !== 'у пульта');
  const fohIn = r.inputs.filter((i) => i.inputAt === 'у пульта');
  const top = 48;
  const inH = Math.max(1, stageIn.length) * ROW;
  const outTop = top + inH + 34;
  const outH = Math.max(1, r.outputs.length) * ROW;
  const boxTop = top - 6;
  const boxH = outTop + outH - boxTop + 2;
  const mixTop = top + 20;
  const mixH = 96;
  const fohTop = mixTop + mixH + 40;
  const H = Math.max(outTop + outH, fohTop + fohIn.length * ROW) + 64;
  const midY = mixTop + mixH / 2;
  const boxLabel = transport === 'stagebox' ? cut(r.transportLabel.replace('Стейджбокс ', '').split(',')[0].split(' (')[0], 18) : transport === 'multicore' ? 'Мультикор' : 'Прямые линии';

  return (
    <div class="diagram-wrap">
      <svg class="diagram" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Схема подключения">
        <text class="zone" x={SRC_X} y={20}>СЦЕНА</text>
        <text class="zone" x={MIX_X} y={20}>FOH (пульт)</text>
        <line class="zone-line" x1={MIX_X - 40} y1={8} x2={MIX_X - 40} y2={H - 50} />

        <text class="sub" x={SRC_X} y={top - 12}>Источники</text>
        {stageIn.map((i, k) => {
          const y = top + k * ROW;
          return (
            <g>
              <rect class="node" x={SRC_X} y={y} width={SRC_W} height={ROW - 5} rx={4} />
              <text class="t" x={SRC_X + 6} y={y + 13}>{cut(`${i.ch}. ${i.name}`, 20)}</text>
              {i.phantom ? <text class="ph" x={SRC_X + SRC_W - 6} y={y + 13} text-anchor="end">48V</text> : null}
              <line class="w-mic" x1={SRC_X + SRC_W} y1={y + 9} x2={BOX_X} y2={y + 9} />
            </g>
          );
        })}

        <text class="sub" x={SRC_X} y={outTop - 12}>Выходы</text>
        {r.outputs.map((o, k) => {
          const y = outTop + k * ROW;
          const passive = o.dest.startsWith('Усилитель');
          return (
            <g>
              <rect class={`node ${passive ? 'amp' : 'spk'}`} x={SRC_X} y={y} width={SRC_W} height={ROW - 5} rx={4} />
              <text class="t" x={SRC_X + 6} y={y + 13}>{cut(o.dest.replace('Усилитель → ', 'Усил. → '), 24)}</text>
              <line class="w-line" x1={BOX_X} y1={y + 9} x2={SRC_X + SRC_W} y2={y + 9} marker-end="url(#arr)" />
              <text class="lbl" x={SRC_X + SRC_W + 6} y={y + 6}>{cut(o.bus, 14)}</text>
            </g>
          );
        })}

        <rect class={`box ${transport === 'direct' ? 'dashed' : ''}`} x={BOX_X} y={boxTop} width={BOX_W} height={boxH} rx={6} />
        <text class="bt" x={BOX_X + BOX_W / 2} y={boxTop + boxH / 2} text-anchor="middle">{boxLabel}</text>
        <text class="lbl" x={BOX_X + BOX_W / 2} y={boxTop + boxH / 2 + 16} text-anchor="middle">
          {stageIn.length} вх · {r.outputs.length} вых
        </text>

        <line class={transport === 'stagebox' ? 'w-utp' : 'w-multi'} x1={BOX_X + BOX_W} y1={midY} x2={MIX_X} y2={midY} />
        <text class="lbl" x={(BOX_X + BOX_W + MIX_X) / 2} y={midY - 8} text-anchor="middle">
          {transport === 'stagebox' ? 'Cat5e' : transport === 'multicore' ? 'мультикор' : `${stageIn.length + r.outputs.length} каб.`}
        </text>
        {transport === 'stagebox' ? <text class="lbl" x={(BOX_X + BOX_W + MIX_X) / 2} y={midY + 16} text-anchor="middle">dSNAKE</text> : null}

        <rect class="box mixer" x={MIX_X} y={mixTop} width={MIX_W} height={mixH} rx={6} />
        <text class="bt" x={MIX_X + MIX_W / 2} y={mixTop + 40} text-anchor="middle">{cut(r.mixerLabel.replace('Allen & Heath ', 'A&H '), 20)}</text>
        <text class="lbl" x={MIX_X + MIX_W / 2} y={mixTop + 60} text-anchor="middle">микшерный пульт</text>

        {fohIn.length ? <text class="sub" x={MIX_X} y={fohTop - 12}>Источники у пульта</text> : null}
        {fohIn.map((i, k) => {
          const y = fohTop + k * ROW;
          return (
            <g>
              <rect class="node" x={MIX_X} y={y} width={MIX_W} height={ROW - 5} rx={4} />
              <text class="t" x={MIX_X + 6} y={y + 13}>{cut(`${i.ch}. ${i.name}`, 24)}</text>
              <line class="w-line" x1={MIX_X + MIX_W / 2} y1={y} x2={MIX_X + MIX_W / 2} y2={k === 0 ? mixTop + mixH : y - 5} />
            </g>
          );
        })}

        <g transform={`translate(${SRC_X}, ${H - 34})`}>
          <line class="w-mic" x1={0} y1={0} x2={24} y2={0} /><text class="lbl" x={30} y={4}>микрофон/DI, XLR</text>
          <line class="w-line" x1={160} y1={0} x2={184} y2={0} /><text class="lbl" x={190} y={4}>линия, XLR</text>
          <line class="w-utp" x1={278} y1={0} x2={302} y2={0} /><text class="lbl" x={308} y={4}>Cat5e</text>
          <rect class="node amp" x={356} y={-8} width={18} height={14} rx={3} /><text class="lbl" x={380} y={4}>пассивная + усил.</text>
          <rect class="node spk" x={512} y={-8} width={18} height={14} rx={3} /><text class="lbl" x={536} y={4}>активная</text>
        </g>

        <defs>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" class="arrow" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

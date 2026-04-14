import { Line, Path, Rect, Svg } from 'react-native-svg';

import { C } from '@/theme/colors';

import { buildSmoothSvgPath, type Pt } from './smoothPath';

const LINE = '#1E3A5F';
const GRID = '#E5E7EB';

type Point = { active?: number };

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

type Props = {
  width: number;
  height: number;
  series: Point[];
};

/** Tendance de consommation — courbe lisse puissance active (kW), grille horizontale. */
export function MobileConsumptionTrendChart({ width, height, series }: Props) {
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const vals = series.map((p) => num(p.active)).filter((x): x is number => x != null);
  if (vals.length === 0) {
    return (
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={C.surface2} rx={8} />
      </Svg>
    );
  }

  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const pts: Pt[] = [];
  for (let i = 0; i < series.length; i++) {
    const v = num(series[i].active);
    if (v == null) continue;
    const x = series.length === 1 ? padL + innerW / 2 : padL + (i / (series.length - 1)) * innerW;
    const y = padT + (1 - (v - min) / (max - min)) * innerH;
    pts.push({ x, y });
  }

  const d = buildSmoothSvgPath(pts);

  const gridLines = 4;
  const gl: { y: number }[] = [];
  for (let g = 1; g <= gridLines; g++) {
    const y = padT + (g / (gridLines + 1)) * innerH;
    gl.push({ y });
  }

  const tickN = Math.min(12, Math.max(4, series.length));
  const ticks: { x: number }[] = [];
  for (let t = 0; t < tickN; t++) {
    ticks.push({ x: padL + (t / (tickN - 1)) * innerW });
  }

  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#fff" stroke={C.border} rx={8} />
      {gl.map((l, i) => (
        <Line
          key={`g${i}`}
          x1={padL}
          y1={l.y}
          x2={width - padR}
          y2={l.y}
          stroke={GRID}
          strokeWidth={1}
          strokeDasharray="5 5"
        />
      ))}
      {ticks.map((t, i) => (
        <Line
          key={`t${i}`}
          x1={t.x}
          y1={height - padB}
          x2={t.x}
          y2={height - padB + 4}
          stroke={C.textMuted}
          strokeWidth={1}
        />
      ))}
      {d ? <Path d={d} fill="none" stroke={LINE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  );
}

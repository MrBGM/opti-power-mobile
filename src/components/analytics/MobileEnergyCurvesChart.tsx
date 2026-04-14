import { Path, Rect, Svg } from 'react-native-svg';

import { C } from '@/theme/colors';

import { buildSmoothSvgPath, type Pt } from './smoothPath';

type PtE = { epT?: number; eqT?: number; edT?: number };

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

type Props = {
  width: number;
  height: number;
  series: PtE[];
};

/** Courbes EpT / EqT / EdT (énergie cumulative) — couleurs alignées bureau. */
export function MobileEnergyCurvesChart({ width, height, series }: Props) {
  const pad = 10;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;

  const ep = series.map((p) => num(p.epT)).filter((x): x is number => x != null);
  const eq = series.map((p) => num(p.eqT)).filter((x): x is number => x != null);
  const ed = series.map((p) => num(p.edT)).filter((x): x is number => x != null);
  const all = [...ep, ...eq, ...ed];
  if (all.length === 0) {
    return (
      <Svg width={width} height={height}>
        <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill={C.surface2} stroke={C.border} rx={8} />
      </Svg>
    );
  }
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  function line(key: 'epT' | 'eqT' | 'edT'): string | null {
    const pts: Pt[] = [];
    const n = series.length;
    for (let i = 0; i < n; i++) {
      const v = num(series[i][key]);
      if (v == null) continue;
      const x = n === 1 ? pad + innerW / 2 : pad + (i / (n - 1)) * innerW;
      const y = pad + (1 - (v - min) / (max - min)) * innerH;
      pts.push({ x, y });
    }
    if (pts.length < 2) return null;
    return buildSmoothSvgPath(pts);
  }

  const dEp = line('epT');
  const dEq = line('eqT');
  const dEd = line('edT');

  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#fff" stroke={C.border} rx={8} />
      {dEp ? <Path d={dEp} fill="none" stroke="#1E3A5F" strokeWidth={2.2} /> : null}
      {dEq ? <Path d={dEq} fill="none" stroke="#22C55E" strokeWidth={2} /> : null}
      {dEd ? <Path d={dEd} fill="none" stroke="#F97316" strokeWidth={2} /> : null}
    </Svg>
  );
}

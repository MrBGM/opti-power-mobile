import { Polyline, Svg } from 'react-native-svg';

export type PowerSeriesPoint = {
  active?: number;
  reactive?: number;
  apparent?: number;
};

const C_ACTIVE = '#1d4ed8';
const C_REACTIVE = '#16a34a';
const C_APPARENT = '#ea580c';

function buildPolylineCoords(
  series: PowerSeriesPoint[],
  key: 'active' | 'reactive' | 'apparent',
  width: number,
  height: number,
  pad: number
): string | null {
  const n = series.length;
  if (n === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const p of series) {
    const v = p[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const coords: string[] = [];

  for (let i = 0; i < n; i++) {
    const v = series[i][key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const x = n === 1 ? pad + innerW / 2 : pad + (i / (n - 1)) * innerW;
    const y = pad + (1 - (v - min) / (max - min)) * innerH;
    coords.push(`${x},${y}`);
  }

  if (coords.length === 0) return null;
  if (coords.length === 1) {
    const [xs, ys] = coords[0].split(',').map(Number);
    return `${xs - 3},${ys} ${xs + 3},${ys}`;
  }
  return coords.join(' ');
}

/**
 * Courbes Puissance active / réactive / apparente — même logique visuelle que le bureau (couleurs).
 */
export function MobilePowerEvolutionChart({
  width,
  height,
  series,
}: {
  width: number;
  height: number;
  series: PowerSeriesPoint[];
}) {
  const pad = 10;
  const a = buildPolylineCoords(series, 'active', width, height, pad);
  const r = buildPolylineCoords(series, 'reactive', width, height, pad);
  const p = buildPolylineCoords(series, 'apparent', width, height, pad);

  if (!a && !r && !p) return null;

  return (
    <Svg width={width} height={height}>
      {a ? <Polyline points={a} fill="none" stroke={C_ACTIVE} strokeWidth={2.2} /> : null}
      {r ? <Polyline points={r} fill="none" stroke={C_REACTIVE} strokeWidth={2.2} /> : null}
      {p ? <Polyline points={p} fill="none" stroke={C_APPARENT} strokeWidth={2.2} /> : null}
    </Svg>
  );
}

export function powerChartLegend() {
  return [
    { label: 'Puissance active', color: C_ACTIVE },
    { label: 'Puissance réactive', color: C_REACTIVE },
    { label: 'Puissance apparente', color: C_APPARENT },
  ] as const;
}

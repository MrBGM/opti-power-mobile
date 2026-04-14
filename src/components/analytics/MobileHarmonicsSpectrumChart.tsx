import { Line, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { C } from '@/theme/colors';

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

type Props = {
  width: number;
  height: number;
  /** null = pas de données qualité (import énergie seul) */
  harmonics: { rank?: number; value?: number; status?: string }[] | null;
  thdTotal: number;
  thdLimit: number;
};

/** Spectre THD par rang 2–25 (aligné bureau HarmonicsSpectrumChart). */
export function MobileHarmonicsSpectrumChart({ width, height, harmonics, thdTotal, thdLimit }: Props) {
  const h = height - 28;
  const pad = 8;
  const ranks = Array.from({ length: 24 }, (_, i) => i + 2);
  const values = ranks.map((rank) => {
    const real = harmonics?.find((x) => x.rank === rank);
    if (real && num(real.value) != null) return num(real.value)!;
    if (thdTotal <= 0) return 0;
    const decay = 1 / Math.sqrt(rank - 1);
    return Math.round(thdTotal * decay * 100) / 100;
  });
  const maxV = Math.max(12, Math.ceil(Math.max(...values, thdLimit) * 1.15));
  const barW = Math.max(4, Math.floor((width - pad * 2) / ranks.length) - 2);

  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#fff" stroke={C.border} rx={8} />
      {thdLimit > 0 ? (
        <Line
          x1={pad}
          y1={pad + (1 - thdLimit / maxV) * h}
          x2={width - pad}
          y2={pad + (1 - thdLimit / maxV) * h}
          stroke="#EF4444"
          strokeWidth={1}
          strokeDasharray="5 4"
        />
      ) : null}
      {ranks.map((rank, i) => {
        const v = values[i] ?? 0;
        const barH = maxV > 0 ? (v / maxV) * h : 0;
        const x = pad + i * (barW + 2);
        const y = pad + h - barH;
        const real = harmonics?.find((x) => x.rank === rank);
        const st = real?.status;
        const fill = st === 'critical' ? C.red : st === 'warning' ? C.amber : '#1E3A5F';
        return <Rect key={rank} x={x} y={y} width={barW} height={Math.max(barH, 0.5)} fill={fill} rx={2} />;
      })}
      <SvgText x={width - pad} y={pad + (1 - thdLimit / maxV) * h - 2} fill="#EF4444" fontSize={9} textAnchor="end">
        {`${thdLimit}%`}
      </SvgText>
    </Svg>
  );
}

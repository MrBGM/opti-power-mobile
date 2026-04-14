import { Path, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { C } from '@/theme/colors';

function fmtKwh(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(2)} MWh` : `${v.toFixed(1)} kWh`;
}
function fmtKvah(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(2)} MVAh` : `${v.toFixed(1)} kVAh`;
}

function donutSlice(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number
): string {
  const x0o = cx + r1 * Math.cos(a0);
  const y0o = cy + r1 * Math.sin(a0);
  const x1o = cx + r1 * Math.cos(a1);
  const y1o = cy + r1 * Math.sin(a1);
  const x0i = cx + r0 * Math.cos(a1);
  const y0i = cy + r0 * Math.sin(a1);
  const x1i = cx + r0 * Math.cos(a0);
  const y1i = cy + r0 * Math.sin(a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${x0o} ${y0o}`,
    `A ${r1} ${r1} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x0i} ${y0i}`,
    `A ${r0} ${r0} 0 ${large} 0 ${x1i} ${y1i}`,
    'Z',
  ].join(' ');
}

type Props = {
  width: number;
  height: number;
  totalActiveEnergy: number;
  totalReactiveEnergy: number;
  distortionRateEnergy: number;
};

/** Répartition Ep / Eq / Ed — donut comme le bureau. */
export function MobileEnergyDonutChart({
  width,
  height,
  totalActiveEnergy,
  totalReactiveEnergy,
  distortionRateEnergy,
}: Props) {
  const active = Math.max(0, totalActiveEnergy);
  const reactive = Math.max(0, totalReactiveEnergy);
  const deforming = active * Math.max(0, distortionRateEnergy) / 100;
  const parts = [
    Number.isFinite(active) ? active : 0,
    Number.isFinite(reactive) ? reactive : 0,
    Number.isFinite(deforming) ? deforming : 0,
  ];
  const total = parts.reduce((a, b) => a + b, 0) || 1;
  const colors = ['#22C55E', '#F97316', '#EF4444'];

  const cx = width / 2;
  const cy = height / 2 - 4;
  const r1 = Math.min(width, height) * 0.32;
  const r0 = r1 * 0.55;

  let angle = -Math.PI / 2;
  const paths: { d: string; fill: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const sweep = (parts[i] / total) * 2 * Math.PI;
    if (sweep > 0.001) {
      const a1 = angle + sweep;
      paths.push({ d: donutSlice(cx, cy, r0, r1, angle, a1), fill: colors[i] });
      angle = a1;
    }
  }

  const padX = (i: number) => 16 + i * (width / 3.5);

  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#fff" stroke={C.border} rx={8} />
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.fill} />
      ))}
      <SvgText x={cx} y={cy - 6} fill={C.text} fontSize={11} fontWeight="700" textAnchor="middle">
        Total
      </SvgText>
      <SvgText x={cx} y={cy + 10} fill={C.text} fontSize={13} fontWeight="800" textAnchor="middle">
        {fmtKvah(total)}
      </SvgText>
      <SvgText x={padX(0)} y={height - 28} fill="#22C55E" fontSize={9} fontWeight="600">
        Ep
      </SvgText>
      <SvgText x={padX(1)} y={height - 28} fill="#F97316" fontSize={9} fontWeight="600">
        Eq
      </SvgText>
      <SvgText x={padX(2)} y={height - 28} fill="#EF4444" fontSize={9} fontWeight="600">
        Ed
      </SvgText>
      <SvgText x={8} y={height - 12} fill={C.textMuted} fontSize={8}>
        {`Actif ${fmtKwh(active)} · Réact ${fmtKwh(reactive)}`}
      </SvgText>
    </Svg>
  );
}

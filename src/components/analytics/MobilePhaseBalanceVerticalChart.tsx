import React, { Fragment } from 'react';
import { Line, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { C } from '@/theme/colors';

type Props = {
  width: number;
  height: number;
  L1: number;
  L2: number;
  L3: number;
  nominal: number;
  unbalancePercent: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
};

const COL = { normal: '#22C55E', warning: '#F97316', critical: '#EF4444' };

/** Barres verticales L1–L3 + ligne nominale (Équilibre triphasé bureau). */
export function MobilePhaseBalanceVerticalChart({
  width,
  height,
  L1,
  L2,
  L3,
  nominal,
  unbalancePercent,
  unit,
  status,
}: Props) {
  const vals = [L1, L2, L3];
  const labels = ['L1', 'L2', 'L3'];
  const pad = 14;
  const chartH = height - 52;
  const minV = Math.floor(Math.min(...vals, nominal) * 0.9);
  const maxV = Math.ceil(Math.max(...vals, nominal) * 1.1);
  const span = maxV - minV || 1;
  const barW = (width - pad * 2 - 40) / 3;
  const gap = 12;
  const baseY = pad + chartH;
  const col = COL[status];

  const yNom = pad + chartH * (1 - (nominal - minV) / span);

  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#fff" stroke={C.border} rx={8} />
      <Line x1={pad} x2={width - pad} y1={yNom} y2={yNom} stroke="#EF4444" strokeWidth={1} strokeDasharray="4 3" />
      <SvgText x={width - pad} y={yNom - 4} fill="#EF4444" fontSize={9} fontWeight="700" textAnchor="end">
        {`${nominal} ${unit} nominal`}
      </SvgText>
      {vals.map((v, i) => {
        const x = pad + i * (barW + gap);
        const bh = chartH * ((v - minV) / span);
        const y = baseY - bh;
        return (
          <Fragment key={labels[i]}>
            <Rect x={x} y={y} width={barW} height={bh} fill={col} rx={5} />
            <SvgText x={x + barW / 2} y={baseY + 14} fill={C.textSub} fontSize={11} fontWeight="700" textAnchor="middle">
              {labels[i]}
            </SvgText>
          </Fragment>
        );
      })}
      <SvgText x={pad} y={height - 8} fill={C.textMuted} fontSize={9}>
        {`Conformité EN 50160 · Déséquilibre ${unbalancePercent.toFixed(2)}%`}
      </SvgText>
    </Svg>
  );
}

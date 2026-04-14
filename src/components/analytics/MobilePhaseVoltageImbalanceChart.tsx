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
};

/** Barres horizontales L1–L3 + ligne nominale (bureau PhaseImbalanceChart). */
export function MobilePhaseVoltageImbalanceChart({
  width,
  height,
  L1,
  L2,
  L3,
  nominal,
  unbalancePercent,
  unit,
}: Props) {
  const vals = [L1, L2, L3];
  const labels = ['L1', 'L2', 'L3'];
  const rowH = (height - 36) / 3;
  const pad = 12;
  const allValid = vals.every((v) => v > 0);
  const minV = allValid ? Math.floor(Math.min(...vals, nominal) - 5) : 220;
  const maxV = allValid ? Math.ceil(Math.max(...vals, nominal) + 3) : 240;
  const barMaxW = width - pad * 2 - 40;

  const xNom = pad + ((nominal - minV) / (maxV - minV)) * barMaxW;

  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#fff" stroke={C.border} rx={8} />
      <Line x1={xNom} y1={8} x2={xNom} y2={height - 28} stroke="#22C55E" strokeWidth={1} strokeDasharray="4 3" />
      <SvgText x={Math.min(xNom + 4, width - 36)} y={14} fill="#22C55E" fontSize={9} fontWeight="600">
        {`${nominal}${unit}`}
      </SvgText>
      {vals.map((v, i) => {
        const y0 = 10 + i * rowH;
        const w = barMaxW * Math.max(0, (v - minV) / (maxV - minV));
        return (
          <Fragment key={labels[i]}>
            <SvgText x={pad} y={y0 + rowH * 0.45} fill={C.textSub} fontSize={12} fontWeight="700">
              {labels[i]}
            </SvgText>
            <Rect x={pad + 28} y={y0 + rowH * 0.2} width={w} height={rowH * 0.5} fill="#1E3A5F" rx={4} />
            <SvgText x={width - pad} y={y0 + rowH * 0.55} fill={C.text} fontSize={11} fontWeight="700" textAnchor="end">
              {`${v.toFixed(1)} ${unit}`}
            </SvgText>
          </Fragment>
        );
      })}
      <SvgText x={width / 2} y={height - 10} fill={C.textMuted} fontSize={10} textAnchor="middle">
        {`Déséquilibre ${unbalancePercent.toFixed(1)} %`}
      </SvgText>
    </Svg>
  );
}

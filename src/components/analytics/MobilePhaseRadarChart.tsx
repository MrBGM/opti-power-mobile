import React, { Fragment } from 'react';
import { Circle, Line, Polygon, Rect, Svg, Text as SvgText } from 'react-native-svg';

import { C } from '@/theme/colors';

/** Aligné sur le radar Analyses bureau (Apex). */
const VOLT_COLOR = '#1E3A5F';
const CURR_COLOR = '#F97316';
const VOLT_FILL_OPACITY = 0.42;
const CURR_FILL_OPACITY = 0.32;
const STROKE_W = 2.75;
const MARKER_R = 5;
const MARKER_STROKE = 2;

type Props = {
  width: number;
  height: number;
  vPhases: { L1: number; L2: number; L3: number };
  iPhases: { L1: number; L2: number; L3: number };
};

/**
 * Sommets du triangle radar dans le même sens qu’ApexCharts (bureau) :
 * Phase A (L1) en haut, puis horaire : Phase B (L2), Phase C (L3).
 * Avec y = cy - r·sin(θ), le « haut » écran correspond à θ = π/2 (pas -π/2).
 */
const RADAR_ANGLES = [
  Math.PI / 2,
  Math.PI / 2 - (2 * Math.PI) / 3,
  Math.PI / 2 - (4 * Math.PI) / 3,
] as const;

function triPoints(cx: number, cy: number, r: number, vals: [number, number, number]): string {
  const pts: string[] = [];
  for (let k = 0; k < 3; k++) {
    const ang = RADAR_ANGLES[k];
    const rr = r * (vals[k] / 100);
    const x = cx + rr * Math.cos(ang);
    const y = cy - rr * Math.sin(ang);
    pts.push(`${x},${y}`);
  }
  return pts.join(' ');
}

function triVertices(cx: number, cy: number, r: number, vals: [number, number, number]): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < 3; k++) {
    const ang = RADAR_ANGLES[k];
    const rr = r * (vals[k] / 100);
    out.push([cx + rr * Math.cos(ang), cy - rr * Math.sin(ang)]);
  }
  return out;
}

const LABELS = ['Phase A', 'Phase B', 'Phase C'];

/** Radar tension / courant — % de la moyenne (100 % = équilibré), comme le bureau. */
export function MobilePhaseRadarChart({ width, height, vPhases, iPhases }: Props) {
  const cx = width / 2;
  const cy = height / 2 - 6;
  const r = Math.min(width, height) * 0.32;

  const vAvg = (vPhases.L1 + vPhases.L2 + vPhases.L3) / 3 || 1;
  const iAvg = (iPhases.L1 + iPhases.L2 + iPhases.L3) / 3 || 1;
  const vNorm: [number, number, number] = [
    Math.round((vPhases.L1 / vAvg) * 100 * 10) / 10,
    Math.round((vPhases.L2 / vAvg) * 100 * 10) / 10,
    Math.round((vPhases.L3 / vAvg) * 100 * 10) / 10,
  ];
  const iNorm: [number, number, number] = [
    Math.round((iPhases.L1 / iAvg) * 100 * 10) / 10,
    Math.round((iPhases.L2 / iAvg) * 100 * 10) / 10,
    Math.round((iPhases.L3 / iAvg) * 100 * 10) / 10,
  ];

  const gridLevels = [0.35, 0.55, 0.75, 0.95];
  const vPts = triPoints(cx, cy, r, vNorm);
  const iPts = triPoints(cx, cy, r, iNorm);
  const vVerts = triVertices(cx, cy, r, vNorm);
  const iVerts = triVertices(cx, cy, r, iNorm);
  const gridStroke = '#cbd5e1';

  const legY = height - 20;
  const legMid = width / 2;
  const sw = 9;

  return (
    <Svg width={width} height={height}>
      <Rect x={0.5} y={0.5} width={width - 1} height={height - 1} fill="#fff" stroke={C.border} rx={8} />
      {gridLevels.map((lv, idx) => {
        const pts = triPoints(cx, cy, r * lv, [100, 100, 100]);
        return (
          <Polygon
            key={idx}
            points={pts}
            fill="none"
            stroke={gridStroke}
            strokeWidth={1}
          />
        );
      })}
      <Polygon
        points={vPts}
        fill={VOLT_COLOR}
        fillOpacity={VOLT_FILL_OPACITY}
        stroke={VOLT_COLOR}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
      />
      <Polygon
        points={iPts}
        fill={CURR_COLOR}
        fillOpacity={CURR_FILL_OPACITY}
        stroke={CURR_COLOR}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
      />
      {vVerts.map(([vx, vy], i) => (
        <Circle
          key={`vm-${i}`}
          cx={vx}
          cy={vy}
          r={MARKER_R}
          fill={VOLT_COLOR}
          stroke="#ffffff"
          strokeWidth={MARKER_STROKE}
        />
      ))}
      {iVerts.map(([ix, iy], i) => (
        <Circle
          key={`im-${i}`}
          cx={ix}
          cy={iy}
          r={MARKER_R - 0.5}
          fill={CURR_COLOR}
          stroke="#ffffff"
          strokeWidth={MARKER_STROKE}
        />
      ))}
      {RADAR_ANGLES.map((ang, i) => {
        const x2 = cx + r * 1.05 * Math.cos(ang);
        const y2 = cy - r * 1.05 * Math.sin(ang);
        const lx = cx + (r + 22) * Math.cos(ang);
        const ly = cy - (r + 22) * Math.sin(ang);
        return (
          <Fragment key={i}>
            <Line x1={cx} y1={cy} x2={x2} y2={y2} stroke={C.border} strokeWidth={1} />
            <SvgText x={lx} y={ly} fill={C.textSub} fontSize={10} textAnchor="middle">
              {LABELS[i]}
            </SvgText>
          </Fragment>
        );
      })}
      <Rect x={legMid - 78} y={legY - 6} width={sw} height={sw} rx={2} fill={VOLT_COLOR} />
      <SvgText x={legMid - 64} y={legY + 2} fill={C.text} fontSize={10} fontWeight="600">
        Tension
      </SvgText>
      <Rect x={legMid + 8} y={legY - 6} width={sw} height={sw} rx={2} fill={CURR_COLOR} />
      <SvgText x={legMid + 22} y={legY + 2} fill={C.text} fontSize={10} fontWeight="600">
        Courant
      </SvgText>
      <SvgText x={cx} y={height - 4} fill={C.textMuted} fontSize={8} textAnchor="middle">
        {`Moy. ${Math.round(vAvg)} V · ${Math.round(iAvg)} A`}
      </SvgText>
    </Svg>
  );
}

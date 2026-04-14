import React, { Fragment } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Rect, Svg, Text as SvgText } from 'react-native-svg';

import type { ReportChartSeries } from '@/storage/voiceReportsRepo';
import { C } from '@/theme/colors';

const PALETTE = [C.blue, C.green, C.amber, C.purple, C.cyan, C.red];

type Props = {
  charts: ReportChartSeries[];
  width: number;
};

/**
 * Mini-barres horizontales pour visualiser les séries extraites du rapport (mesures).
 */
export function MaintenanceReportCharts({ charts, width }: Props) {
  if (!charts.length) return null;

  const innerW = Math.max(200, width - 8);
  const labelCol = 52;
  const chartPad = 6;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Synthèse graphique</Text>
      {charts.map((ch, ci) => {
        const maxV = Math.max(...ch.values.map((v) => Math.abs(v)), 1e-6);
        const barAreaW = innerW - labelCol - chartPad * 2;
        const barH = 14;
        const gap = 6;
        const blockH = ch.labels.length * (barH + gap) + 28;

        return (
          <View key={`${ch.title}-${ci}`} style={styles.card}>
            <Text style={styles.title} numberOfLines={2}>
              {ch.title}
              {ch.unit ? ` (${ch.unit})` : ''}
            </Text>
            <Svg width={innerW} height={blockH}>
              {ch.labels.map((lab, i) => {
                const v = ch.values[i] ?? 0;
                const bw = barAreaW * (Math.abs(v) / maxV);
                const y = 22 + i * (barH + gap);
                const color = PALETTE[i % PALETTE.length];
                return (
                  <Fragment key={`${lab}-${i}`}>
                    <SvgText
                      x={4}
                      y={y + barH * 0.72}
                      fontSize={9}
                      fill={C.textSub}
                    >
                      {lab.length > 8 ? `${lab.slice(0, 7)}…` : lab}
                    </SvgText>
                    <Rect
                      x={labelCol}
                      y={y}
                      width={barAreaW}
                      height={barH}
                      rx={4}
                      fill={C.surface2}
                      stroke={C.border}
                    />
                    <Rect
                      x={labelCol}
                      y={y}
                      width={Math.max(4, bw)}
                      height={barH}
                      rx={4}
                      fill={color}
                      fillOpacity={0.85}
                    />
                    <SvgText
                      x={labelCol + barAreaW + 4}
                      y={y + barH * 0.72}
                      fontSize={9}
                      fill={C.text}
                      fontWeight="600"
                    >
                      {Number.isInteger(v) ? String(v) : v.toFixed(1)}
                    </SvgText>
                  </Fragment>
                );
              })}
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  title: { color: C.text, fontSize: 12, fontWeight: '700', marginBottom: 4, paddingHorizontal: 4 },
});

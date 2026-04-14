import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { C } from '@/theme/colors';

const LEVEL_BG: Record<string, string> = {
  low: '#DBEAFE',
  normal: '#93C5FD',
  high: '#4ADE80',
  critical: '#FB923C',
};

const LEVEL_LABELS: Record<string, string> = {
  low: 'Faible',
  normal: 'Modéré',
  high: 'Normal',
  critical: 'Élevé',
};

const CELL_GAP = 3;

const DAY_ORDER = [6, 5, 4, 3, 2, 1, 0];
const DAY_LABELS: Record<number, string> = {
  0: 'Dim', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam',
};

type Cell = { dayOfWeek?: number; hour?: number; value?: number; level?: string };

type Props = {
  cells: Cell[];
  subtitle?: string;
  /** largeur scroll (toutes les heures 0–23) */
  scrollMinWidth: number;
};

/** Carte jour × heure — scroll horizontal comme le bureau. */
export function MobileConsumptionHeatmap({ cells, subtitle, scrollMinWidth }: Props) {
  const map = new Map<string, Cell>();
  for (const c of cells) {
    const d = c.dayOfWeek ?? 0;
    const h = c.hour ?? 0;
    map.set(`${d}_${h}`, c);
  }

  const cellSize = 14;
  const leftLab = 34;
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const gridW = leftLab + hours.length * (cellSize + CELL_GAP);

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={{ minWidth: Math.max(scrollMinWidth, gridW + 16), paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', marginLeft: leftLab, marginBottom: 4 }}>
            {hours.map((h) => (
              <Text key={h} style={[styles.hourLab, { width: cellSize + CELL_GAP }]}>
                {h % 4 === 0 ? `${h}h` : ''}
              </Text>
            ))}
          </View>
          {DAY_ORDER.map((dayIdx) => (
            <View key={dayIdx} style={styles.row}>
              <Text style={styles.dayLab}>{DAY_LABELS[dayIdx]}</Text>
              {hours.map((hour) => {
                const c = map.get(`${dayIdx}_${hour}`);
                const lvl = c?.level ?? 'low';
                const bg = LEVEL_BG[lvl] ?? LEVEL_BG.low;
                return (
                  <View
                    key={`${dayIdx}_${hour}`}
                    style={[
                      styles.cell,
                      { width: cellSize, height: cellSize, backgroundColor: bg, marginRight: CELL_GAP },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text style={styles.sub}>{subtitle ?? 'Par heure et jour de la semaine'}</Text>
      <View style={styles.legend}>
        {(['low', 'normal', 'high', 'critical'] as const).map((k) => (
          <View key={k} style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: LEVEL_BG[k] }]} />
            <Text style={styles.legTxt}>{LEVEL_LABELS[k]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: CELL_GAP },
  dayLab: { width: 30, fontSize: 10, fontWeight: '600', color: C.textSub },
  hourLab: { fontSize: 8, color: C.textMuted, textAlign: 'center' },
  cell: { borderRadius: 4 },
  sub: { fontSize: 11, color: C.textMuted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  legTxt: { fontSize: 10, color: C.textSub },
});

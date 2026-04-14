import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ComplianceItem } from '@/lib/iecComplianceFromKpi';
import { C } from '@/theme/colors';

type Props = {
  items: ComplianceItem[];
};

export function MobileIECComplianceGrid({ items }: Props) {
  const { width: screenW } = useWindowDimensions();
  const basis =
    screenW >= 960 ? '31%' : screenW >= 560 ? '47%' : '100%';

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[
            styles.cell,
            { flexBasis: basis },
            item.conform ? styles.cellOk : styles.cellBad,
          ]}
        >
          <View style={styles.cellHead}>
            <Text style={styles.cellLabel} numberOfLines={2}>
              {item.label}
            </Text>
            <View style={[styles.badge, item.conform ? styles.badgeOk : styles.badgeBad]}>
              <Text style={styles.badgeTxt}>{item.conform ? 'Conforme' : 'Non conforme'}</Text>
            </View>
          </View>
          <Text style={styles.cellValue}>{item.value}</Text>
          <Text style={styles.cellLimit}>{item.limit}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cellOk: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  cellBad: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  cellHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  cellLabel: { color: C.text, fontSize: 12, fontWeight: '600', flex: 1 },
  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOk: { backgroundColor: '#22c55e' },
  badgeBad: { backgroundColor: '#ef4444' },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cellValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cellLimit: { fontSize: 10, color: C.textMuted, marginTop: 4 },
});

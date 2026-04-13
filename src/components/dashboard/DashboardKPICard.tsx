import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export type DashboardKPIStatus = 'success' | 'warning' | 'danger';

const BORDER: Record<DashboardKPIStatus, string> = {
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const ICON_BG: Record<DashboardKPIStatus, string> = {
  success: 'rgba(16,185,129,0.15)',
  warning: 'rgba(245,158,11,0.15)',
  danger: 'rgba(239,68,68,0.15)',
};

const ICON_FG: Record<DashboardKPIStatus, string> = {
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
};

type Props = {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: DashboardKPIStatus;
};

/** Reprise visuelle de `desktop/.../KPICard.tsx` (bordure gauche + pastille icône). */
export function DashboardKPICard({ title, value, subtitle, icon, status }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: BORDER[status] }]}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.value}>{value}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.iconWrap, { backgroundColor: ICON_BG[status] }]}>
          <Ionicons name={icon} size={22} color={ICON_FG[status]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderLeftWidth: 4,
    padding: 14,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  textCol: { flex: 1, gap: 4 },
  cardTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  value: { color: '#f8fafc', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 11, lineHeight: 15 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

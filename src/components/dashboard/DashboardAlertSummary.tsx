import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AlertProjection } from '@/domain/alert';
import { formatRelativeFr } from '@/lib/formatRelativeFr';
import type { DrawerParamList } from '@/navigation/types';

type Nav = DrawerNavigationProp<DrawerParamList>;

function severityDisplay(a: AlertProjection): 'critique' | 'avertissement' | 'info' {
  if (a.severity === 'critical') return 'critique';
  if (a.severity === 'warning') return 'avertissement';
  return 'info';
}

function iconFor(s: ReturnType<typeof severityDisplay>): keyof typeof Ionicons.glyphMap {
  if (s === 'critique') return 'close-circle';
  if (s === 'info') return 'information-circle-outline';
  return 'warning';
}

function toneFor(s: ReturnType<typeof severityDisplay>) {
  if (s === 'critique') return { bg: 'rgba(239,68,68,0.15)', fg: '#f87171' };
  if (s === 'info') return { bg: 'rgba(59,130,246,0.15)', fg: '#60a5fa' };
  return { bg: 'rgba(245,158,11,0.15)', fg: '#fbbf24' };
}

type Props = {
  alerts: AlertProjection[];
};

/** Aligné sur `desktop/.../AlertSummary.tsx` (liste courte + lien tout voir). */
export function DashboardAlertSummary({ alerts }: Props) {
  const navigation = useNavigation<Nav>();
  const slice = alerts.slice(0, 5);
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;
  const hidden = Math.max(0, alerts.length - 5);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>Alertes actives</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, styles.badgeDanger]}>
            <Text style={styles.badgeText}>
              {critical} critique{critical !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.badge, styles.badgeWarn]}>
            <Text style={styles.badgeTextDark}>
              {warning} avertissement{warning !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {slice.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune alerte active</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {slice.map((a) => {
            const sev = severityDisplay(a);
            const icon = iconFor(sev);
            const t = toneFor(sev);
            return (
              <View key={a.id} style={styles.row}>
                <View style={[styles.iconCell, { backgroundColor: t.bg }]}>
                  <Ionicons name={icon} size={20} color={t.fg} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {a.equipmentName ?? '—'}
                  </Text>
                </View>
                <Text style={styles.time}>{formatRelativeFr(a.triggeredAt)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {hidden > 0 ? (
        <Text style={styles.hiddenNote}>
          + {hidden} autre{hidden !== 1 ? 's' : ''} alerte{hidden !== 1 ? 's' : ''}
        </Text>
      ) : null}

      <Pressable
        onPress={() => navigation.navigate('Alerts')}
        style={({ pressed }) => [styles.footerBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.footerBtnText}>Voir toutes les alertes</Text>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    padding: 14,
    minWidth: 280,
  },
  header: { gap: 10, marginBottom: 12 },
  cardTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDanger: { backgroundColor: 'rgba(239,68,68,0.2)' },
  badgeWarn: { backgroundColor: 'rgba(245,158,11,0.2)' },
  badgeText: { color: '#fecaca', fontSize: 11, fontWeight: '700' },
  badgeTextDark: { color: '#fde68a', fontSize: 11, fontWeight: '700' },
  empty: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    borderRadius: 10,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyText: { color: '#64748b', fontSize: 13 },
  list: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.08)',
  },
  iconCell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  rowMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  time: { color: '#64748b', fontSize: 11 },
  hiddenNote: { marginTop: 8, textAlign: 'center', color: '#64748b', fontSize: 11 },
  footerBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  footerBtnText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});

import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDesktopKpiBundle } from '@/hooks/useDesktopKpiBundle';
import { useLocalEquipments } from '@/hooks/useLocalEquipments';
import { getKpiRecordFromBundle, getStatsRawFromBundle } from '@/lib/syncBundleLookup';
import { usePairingStore } from '@/store/pairingStore';
import { C } from '@/theme/colors';

function fmt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '--';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '--';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
  } catch { return '--'; }
}

type StatRow = {
  id: string;
  name: string;
  totalCount: number | null;
  firstMeasurement: string | null;
  lastMeasurement: string | null;
  hasMeasurements: boolean;
};

export function MeasurementsScreen() {
  const linked = usePairingStore((s) => s.paired?.status === 'linked');
  const deviceToken = usePairingStore((s) => s.paired?.deviceToken);
  const cloudLinked = Boolean(linked && deviceToken);

  const { data: equipments = [], isLoading: loadEq } = useLocalEquipments();
  const { data: desktopBundle, isFetching: fetchKpi, refetch } = useDesktopKpiBundle();

  const rows = useMemo((): StatRow[] => {
    if (!desktopBundle) return [];
    const statsMap = desktopBundle.measurementStatsByEquipmentId ?? {};
    const kpisMap = desktopBundle.kpisByEquipmentId ?? {};
    return equipments
      .filter((e) => e.syncedFromDesktop)
      .map((e) => {
        const rawStats = getStatsRawFromBundle(statsMap, e.id);
        const kRec = getKpiRecordFromBundle(kpisMap, e.id);
        let totalCount: number | null = null;
        let firstMeasurement: string | null = null;
        let lastMeasurement: string | null = null;
        if (rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats)) {
          const s = rawStats as Record<string, unknown>;
          const tc = s.total_count ?? s.totalCount;
          if (typeof tc === 'number') totalCount = tc;
          const fm = s.first_measurement ?? s.firstMeasurement;
          if (typeof fm === 'string') firstMeasurement = fm;
          const lm = s.last_measurement ?? s.lastMeasurement;
          if (typeof lm === 'string') lastMeasurement = lm;
        }
        const noMeasurements = kRec?.noMeasurements === true;
        return { id: e.id, name: e.name, totalCount, firstMeasurement, lastMeasurement, hasMeasurements: !noMeasurements && (totalCount == null || totalCount > 0) };
      });
  }, [equipments, desktopBundle]);

  const totalAll = useMemo(() => rows.reduce((sum, r) => sum + (r.totalCount ?? 0), 0), [rows]);
  const equipsWithMeasures = rows.filter((r) => r.hasMeasurements).length;

  if (loadEq || (!desktopBundle && fetchKpi)) {
    return <View style={styles.center}><ActivityIndicator color={C.blue} /></View>;
  }

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={fetchKpi} onRefresh={refetch} tintColor={C.blue} />}
    >
      <Text style={styles.title}>Mesures</Text>
      <Text style={styles.caption}>
        {cloudLinked
          ? 'Statistiques des mesures recues depuis le bureau (snapshot).'
          : 'Appairez le mobile au bureau pour voir les statistiques de mesures.'}
      </Text>

      {cloudLinked && rows.length > 0 ? (
        <>
          {/* Banniere resume */}
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Ionicons name="bar-chart-outline" size={20} color={C.cyan} />
              <Text style={[styles.summaryValue, { color: C.cyan }]}>{fmt(totalAll)}</Text>
              <Text style={styles.summaryLabel}>mesures totales</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="pulse-outline" size={20} color={C.green} />
              <Text style={[styles.summaryValue, { color: C.green }]}>{equipsWithMeasures}</Text>
              <Text style={styles.summaryLabel}>actifs</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="hardware-chip-outline" size={20} color={C.purple} />
              <Text style={[styles.summaryValue, { color: C.purple }]}>{rows.length}</Text>
              <Text style={styles.summaryLabel}>suivis</Text>
            </View>
          </View>

          {/* Detail par equipement */}
          <Text style={styles.sectionTitle}>Detail par equipement</Text>
          {rows.map((row) => (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardNameRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTxt}>{(row.name.charAt(0) ?? '?').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.cardName} numberOfLines={1}>{row.name}</Text>
                </View>
                <View style={[styles.badge, row.hasMeasurements ? styles.badgeOk : styles.badgeEmpty]}>
                  <Ionicons
                    name={row.hasMeasurements ? 'checkmark-circle' : 'remove-circle-outline'}
                    size={11}
                    color={row.hasMeasurements ? C.green : C.textMuted}
                  />
                  <Text style={[styles.badgeTxt, { color: row.hasMeasurements ? C.green : C.textMuted }]}>
                    {row.hasMeasurements ? 'Actif' : 'Sans mesures'}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: C.border }]}>
                  <Text style={[styles.statVal, { color: C.blue }]}>{fmt(row.totalCount)}</Text>
                  <Text style={styles.statLabel}>mesures</Text>
                </View>
                <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: C.border }]}>
                  <Text style={styles.statVal} numberOfLines={2}>{fmtDate(row.firstMeasurement)}</Text>
                  <Text style={styles.statLabel}>premiere</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={styles.statVal} numberOfLines={2}>{fmtDate(row.lastMeasurement)}</Text>
                  <Text style={styles.statLabel}>derniere</Text>
                </View>
              </View>
            </View>
          ))}
        </>
      ) : cloudLinked ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Aucun equipement synchronise</Text>
          <Text style={styles.emptyBody}>Importez des donnees sur le bureau et lancez une synchronisation.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  caption: { color: C.textSub, fontSize: 13, lineHeight: 18 },

  summary: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-around',
    ...C.shadow,
  },
  summaryItem: { alignItems: 'center', flex: 1, gap: 4 },
  summaryValue: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: C.textMuted, fontSize: 11, textAlign: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: C.border },

  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...C.shadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 14, paddingBottom: 10 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: C.blue, fontSize: 13, fontWeight: '800' },
  cardName: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeOk: { backgroundColor: C.greenSoft },
  badgeEmpty: { backgroundColor: C.surface2 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  statVal: { color: C.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statLabel: { color: C.textMuted, fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  emptyWrap: { alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

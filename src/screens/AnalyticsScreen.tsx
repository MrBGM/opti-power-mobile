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
import {
  formatConsumptionKwh,
  getConsumptionKwhFromKpi,
  getPfFromKpi,
  kpiRecordHasDisplayableData,
} from '@/lib/desktopKpiDisplay';
import { getKpiRecordFromBundle } from '@/lib/syncBundleLookup';
import { usePairingStore } from '@/store/pairingStore';
import { C, statusColor, statusBg } from '@/theme/colors';

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function fmtPct(v: number | null): string {
  if (v == null) return '--';
  return `${v.toFixed(1)} %`;
}

type AggKpi = {
  totalConsumptionKwh: number | null;
  avgPf: number | null;
  minPf: number | null;
  maxPf: number | null;
  pfWorstStatus: 'normal' | 'warning' | 'critical';
  avgThdV: number | null;
  avgThdI: number | null;
  equipsWithData: number;
  equipsTotal: number;
};

function MetricTile({
  label, value, color, bg, icon,
}: {
  label: string; value: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.metricTile, { backgroundColor: C.surface }]}>
      <View style={[styles.metricIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function AnalyticsScreen() {
  const linked = usePairingStore((s) => s.paired?.status === 'linked');
  const deviceToken = usePairingStore((s) => s.paired?.deviceToken);
  const cloudLinked = Boolean(linked && deviceToken);

  const { data: equipments = [], isLoading: loadEq } = useLocalEquipments();
  const { data: desktopBundle, isFetching: fetchKpi, refetch } = useDesktopKpiBundle();

  const agg = useMemo((): AggKpi => {
    const kpisMap = desktopBundle?.kpisByEquipmentId ?? {};
    const synced = equipments.filter((e) => e.syncedFromDesktop);
    let totalConsumption = 0;
    let hasConsumption = false;
    const pfs: number[] = [];
    let pfWorstStatus: 'normal' | 'warning' | 'critical' = 'normal';
    const thdVs: number[] = [];
    const thdIs: number[] = [];
    let equipsWithData = 0;

    for (const eq of synced) {
      const kRec = getKpiRecordFromBundle(kpisMap, eq.id);
      if (!kpiRecordHasDisplayableData(kRec)) continue;
      equipsWithData++;
      const kwh = getConsumptionKwhFromKpi(kRec);
      if (kwh != null && kwh > 0) { totalConsumption += kwh; hasConsumption = true; }
      const pfBundle = getPfFromKpi(kRec);
      if (pfBundle.value != null) {
        pfs.push(pfBundle.value);
        if (pfBundle.status === 'critical') pfWorstStatus = 'critical';
        else if (pfBundle.status === 'warning' && pfWorstStatus !== 'critical') pfWorstStatus = 'warning';
      }
      const thdV = num((kRec?.harmonics as Record<string, unknown> | undefined)?.thdTotal);
      if (thdV != null) thdVs.push(thdV);
      const thdCurr = kRec?.thdCurrent as Record<string, unknown> | undefined;
      const thdI = num(thdCurr?.average ?? thdCurr?.thdTotal);
      if (thdI != null) thdIs.push(thdI);
    }

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    return {
      totalConsumptionKwh: hasConsumption ? totalConsumption : null,
      avgPf: avg(pfs), minPf: pfs.length ? Math.min(...pfs) : null, maxPf: pfs.length ? Math.max(...pfs) : null,
      pfWorstStatus, avgThdV: avg(thdVs), avgThdI: avg(thdIs), equipsWithData, equipsTotal: synced.length,
    };
  }, [equipments, desktopBundle]);

  if (loadEq || (!desktopBundle && fetchKpi)) {
    return <View style={styles.center}><ActivityIndicator color={C.blue} /></View>;
  }

  const coveragePct = agg.equipsTotal > 0 ? Math.round((agg.equipsWithData / agg.equipsTotal) * 100) : 0;

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={fetchKpi} onRefresh={refetch} tintColor={C.blue} />}
    >
      <Text style={styles.title}>Analyses</Text>
      <Text style={styles.caption}>
        {cloudLinked
          ? `Agregats KPI -- ${agg.equipsWithData} / ${agg.equipsTotal} equipement(s) avec donnees.`
          : 'Appairez le mobile au bureau pour voir les analyses KPI.'}
      </Text>

      {cloudLinked && agg.equipsTotal > 0 ? (
        <>
          {/* Consommation totale */}
          <View style={styles.heroCard}>
            <View style={styles.heroLeft}>
              <View style={[styles.heroIcon, { backgroundColor: C.cyanSoft }]}>
                <Ionicons name="flash" size={22} color={C.cyan} />
              </View>
              <View>
                <Text style={styles.heroLabel}>Consommation totale</Text>
                <Text style={styles.heroSub}>tous equipements confondus</Text>
              </View>
            </View>
            <Text style={[styles.heroValue, { color: C.cyan }]}>
              {agg.totalConsumptionKwh != null ? formatConsumptionKwh(agg.totalConsumptionKwh) : '--'}
            </Text>
          </View>

          {/* Facteur de puissance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Facteur de puissance (TPF)</Text>
            <View style={styles.tilesRow}>
              <MetricTile
                label="Moyen"
                value={agg.avgPf != null ? agg.avgPf.toFixed(3) : '--'}
                color={statusColor(agg.pfWorstStatus)}
                bg={statusBg(agg.pfWorstStatus)}
                icon="speedometer-outline"
              />
              <MetricTile
                label="Minimum"
                value={agg.minPf != null ? agg.minPf.toFixed(3) : '--'}
                color={C.red}
                bg={C.redSoft}
                icon="arrow-down-outline"
              />
              <MetricTile
                label="Maximum"
                value={agg.maxPf != null ? agg.maxPf.toFixed(3) : '--'}
                color={C.green}
                bg={C.greenSoft}
                icon="arrow-up-outline"
              />
            </View>
          </View>

          {/* Harmoniques */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Harmoniques (moyennes)</Text>
            <View style={styles.tilesRow}>
              <MetricTile
                label="THD tension"
                value={fmtPct(agg.avgThdV)}
                color={C.purple}
                bg={C.purpleSoft}
                icon="pulse-outline"
              />
              <MetricTile
                label="THD courant"
                value={fmtPct(agg.avgThdI)}
                color={C.blue}
                bg={C.blueSoft}
                icon="analytics-outline"
              />
            </View>
          </View>

          {/* Couverture */}
          <View style={styles.section}>
            <View style={styles.coverageHeader}>
              <Text style={styles.sectionTitle}>Couverture des donnees</Text>
              <Text style={[styles.pctBadge, { color: coveragePct >= 80 ? C.green : C.amber }]}>
                {coveragePct} %
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, {
                width: `${coveragePct}%` as `${number}%`,
                backgroundColor: coveragePct >= 80 ? C.green : coveragePct >= 50 ? C.amber : C.red,
              }]} />
            </View>
            <Text style={styles.coverageTxt}>
              {agg.equipsWithData} / {agg.equipsTotal} equipement(s) disposent de donnees KPI
            </Text>
          </View>
        </>
      ) : cloudLinked ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Aucun equipement synchronise</Text>
          <Text style={styles.emptyBody}>
            Importez des mesures sur le bureau et lancez une synchronisation.
          </Text>
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <Ionicons name="link-outline" size={48} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Non appaire</Text>
          <Text style={styles.emptyBody}>Appairez le mobile au bureau pour voir les analyses.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  caption: { color: C.textSub, fontSize: 13, lineHeight: 18 },

  heroCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...C.shadow,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  heroIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { color: C.text, fontSize: 14, fontWeight: '700' },
  heroSub: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  heroValue: { fontSize: 24, fontWeight: '800' },

  section: { gap: 10 },
  sectionTitle: { color: C.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tilesRow: { flexDirection: 'row', gap: 10 },
  metricTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    ...C.shadow,
  },
  metricIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 18, fontWeight: '800' },
  metricLabel: { color: C.textMuted, fontSize: 10, textAlign: 'center' },

  coverageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pctBadge: { fontSize: 14, fontWeight: '800' },
  barBg: { height: 8, backgroundColor: C.surface2, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  coverageTxt: { color: C.textSub, fontSize: 12 },

  emptyWrap: { alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

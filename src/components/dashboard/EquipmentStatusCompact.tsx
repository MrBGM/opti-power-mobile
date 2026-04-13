import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Equipment } from '@/domain/equipment';
import {
  computeEquipMetricsFromDesktopKpi,
  equipStatusLabelFr,
  type EquipStatus,
} from '@/lib/equipmentMetricsFromDesktop';
import { useDesktopKpiBundle } from '@/hooks/useDesktopKpiBundle';

type Props = {
  equipments: Equipment[];
  onRefresh?: () => void;
  loading?: boolean;
};

function statusPillStyle(status: EquipStatus) {
  switch (status) {
    case 'normal':
      return { border: 'rgba(16,185,129,0.35)', bg: 'rgba(16,185,129,0.12)', fg: '#6ee7b7' };
    case 'warning':
      return { border: 'rgba(245,158,11,0.4)', bg: 'rgba(245,158,11,0.12)', fg: '#fcd34d' };
    case 'critical':
      return { border: 'rgba(239,68,68,0.4)', bg: 'rgba(239,68,68,0.12)', fg: '#fca5a5' };
    default:
      return { border: 'rgba(148,163,184,0.2)', bg: 'rgba(30,41,59,0.5)', fg: '#94a3b8' };
  }
}

/** Aligné sur le tableau « État des équipements » du bureau (métriques + statut). */
export function EquipmentStatusCompact({ equipments, onRefresh, loading }: Props) {
  const { data: bundle } = useDesktopKpiBundle();
  const kpis = bundle?.kpisByEquipmentId ?? {};
  const statsMap = bundle?.measurementStatsByEquipmentId ?? {};

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>État des équipements</Text>
          <Text style={styles.sub}>Supervision — EN 50160 / IEEE 519 / WAPP (données bureau si sync)</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.countPill}>
            <Text style={styles.countText}>
              {equipments.length} équipement{equipments.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {onRefresh ? (
            <Pressable
              onPress={onRefresh}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="refresh" size={18} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <Ionicons name="refresh" size={22} color="#64748b" />
          <Text style={styles.muted}>Chargement…</Text>
        </View>
      ) : equipments.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={32} color="rgba(148,163,184,0.35)" />
          <Text style={styles.boldMuted}>Aucun équipement enregistré</Text>
          <Text style={styles.mutedSmall}>Créez des équipements dans la page Équipements</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {equipments.map((eq) => {
            const k = kpis[eq.id];
            const st = statsMap[eq.id];
            const m = computeEquipMetricsFromDesktopKpi(k, st);
            const pill = statusPillStyle(m.status);
            const sub =
              m.pf != null || m.thdI != null
                ? `PF ${m.pf != null ? m.pf.toFixed(2) : '—'} · THD ${m.thdI != null ? `${m.thdI.toFixed(1)}%` : '—'}`
                : eq.syncedFromDesktop
                  ? 'Fiche bureau — KPI en attente de sync'
                  : 'Données locales';

            return (
              <View key={eq.id} style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    m.status === 'normal' && { backgroundColor: '#10b981' },
                    m.status === 'warning' && { backgroundColor: '#f59e0b' },
                    m.status === 'critical' && { backgroundColor: '#ef4444' },
                  ]}
                />
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{eq.name}</Text>
                  <Text style={styles.rowMeta}>
                    {eq.site ?? '—'} · {eq.criticality ?? 'standard'}
                  </Text>
                  <Text style={styles.rowKpi}>{sub}</Text>
                </View>
                <View style={[styles.pillDynamic, { borderColor: pill.border, backgroundColor: pill.bg }]}>
                  <Text style={[styles.pillDynamicText, { color: pill.fg }]}>
                    {equipStatusLabelFr(m.status)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.footnote}>
        Statuts et PF/THD reproduisent la logique du bureau lorsque le snapshot KPI est reçu (même seuils
        0,90 / 0,85 et THD 8 % / 15 %).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    padding: 14,
    gap: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  sub: { color: '#64748b', fontSize: 12, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countPill: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    backgroundColor: 'rgba(30,41,59,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  countText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  muted: { color: '#64748b', fontSize: 13 },
  boldMuted: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  mutedSmall: { color: '#64748b', fontSize: 12, textAlign: 'center' },
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.08)',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148,163,184,0.45)',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  rowMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  rowKpi: { color: '#64748b', fontSize: 11, marginTop: 3 },
  pillDynamic: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 120,
  },
  pillDynamicText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  footnote: { color: '#475569', fontSize: 11, lineHeight: 16 },
});

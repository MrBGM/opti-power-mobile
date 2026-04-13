import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { DesktopSyncStatusBanner } from '@/components/sync/DesktopSyncStatusBanner';
import { useDesktopKpiBundle } from '@/hooks/useDesktopKpiBundle';
import { pullMobileSnapshotForce } from '@/hooks/useDesktopEquipmentsLiveSync';
import { useLocalEquipments } from '@/hooks/useLocalEquipments';
import { kpiEmptyLabel, kpiEmptyReason, kpiRecordHasDisplayableData } from '@/lib/desktopKpiDisplay';
import {
  computeEquipMetricsFromDesktopKpi,
  equipStatusLabelFr,
} from '@/lib/equipmentMetricsFromDesktop';
import { getKpiRecordFromBundle, getStatsRawFromBundle } from '@/lib/syncBundleLookup';
import type { EquipmentsStackParamList } from '@/navigation/types';
import type { Equipment } from '@/domain/equipment';
import { seedDemoData } from '@/storage/seed';
import { useMobileSnapshotSyncStore } from '@/store/mobileSnapshotSyncStore';
import { usePairingStore } from '@/store/pairingStore';
import { C } from '@/theme/colors';

type EquipNav = NativeStackNavigationProp<EquipmentsStackParamList, 'EquipmentsList'>;

const TYPE_LABELS: Record<string, string> = {
  power_analyzer: 'Analyseur de réseau',
  motor: 'Moteur',
  pump: 'Pompe',
  lighting: 'Éclairage',
  hvac: 'Climatisation',
  transformer: 'Transformateur',
  compressor: 'Compresseur',
};

function typeLabel(t: string | null | undefined): string {
  if (!t?.trim()) return '--';
  return TYPE_LABELS[t] ?? t.replace(/_/g, ' ');
}

function statusStyle(s: string | undefined): { color: string; bg: string } {
  if (s === 'critical') return { color: C.red, bg: C.redSoft };
  if (s === 'warning') return { color: C.amber, bg: C.amberSoft };
  if (s === 'normal') return { color: C.green, bg: C.greenSoft };
  return { color: C.textMuted, bg: C.surface2 };
}

function EquipmentCard({
  item,
  metrics,
  lastMeasure,
  onOpen,
  snapshotPulling,
  kpiStatusLabel,
}: {
  item: Equipment;
  metrics: ReturnType<typeof computeEquipMetricsFromDesktopKpi> | null;
  lastMeasure: string;
  onOpen: () => void;
  snapshotPulling: boolean;
  kpiStatusLabel?: string;
}) {
  const initial = (item.name?.trim().charAt(0) ?? '?').toUpperCase();

  const statusLabel = metrics
    ? equipStatusLabelFr(metrics.status)
    : item.syncedFromDesktop
      ? snapshotPulling
        ? 'Synchro...'
        : (kpiStatusLabel || 'En attente KPI')
      : '--';

  const ss = statusStyle(metrics?.status);

  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
      {/* En-tete carte */}
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{initial}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardType}>{typeLabel(item.equipmentType)}</Text>
          {item.site?.trim() ? (
            <View style={styles.siteRow}>
              <Ionicons name="location-outline" size={11} color={C.textMuted} />
              <Text style={styles.cardSite} numberOfLines={1}>{item.site}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.badges}>
          <View style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
            {item.syncedFromDesktop && snapshotPulling && !metrics ? (
              <ActivityIndicator size="small" color={C.blue} style={{ marginRight: 4 }} />
            ) : null}
            <Text style={[styles.statusBadgeTxt, { color: ss.color }]}>{statusLabel}</Text>
          </View>
          {item.syncedFromDesktop ? (
            <View style={[styles.srcBadge, { backgroundColor: C.blueSoft }]}>
              <Text style={[styles.srcBadgeTxt, { color: C.blue }]}>Bureau</Text>
            </View>
          ) : (
            <View style={[styles.srcBadge, { backgroundColor: C.surface2 }]}>
              <Text style={[styles.srcBadgeTxt, { color: C.textMuted }]}>Local</Text>
            </View>
          )}
        </View>
      </View>

      {/* Metriques KPI */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCell, { borderRightWidth: 1, borderRightColor: C.border }]}>
          <Text style={styles.kpiLabel}>Santé</Text>
          <Text style={[styles.kpiVal, metrics?.health != null ? { color: C.blue } : {}]}>
            {metrics?.health != null ? `${metrics.health}%` : '--'}
          </Text>
        </View>
        <View style={[styles.kpiCell, { borderRightWidth: 1, borderRightColor: C.border }]}>
          <Text style={styles.kpiLabel}>FP</Text>
          <Text style={[styles.kpiVal, metrics?.pf != null ? { color: C.purple } : {}]}>
            {metrics?.pf != null ? metrics.pf.toFixed(2) : '--'}
          </Text>
        </View>
        <View style={[styles.kpiCell, { borderRightWidth: 1, borderRightColor: C.border }]}>
          <Text style={styles.kpiLabel}>THD I</Text>
          <Text style={styles.kpiVal}>
            {metrics?.thdI != null ? `${metrics.thdI.toFixed(1)}%` : '--'}
          </Text>
        </View>
        <View style={styles.kpiCell}>
          <Text style={styles.kpiLabel}>Dernière mesure</Text>
          <Text style={[styles.kpiVal, { fontSize: 11 }]}>{lastMeasure}</Text>
        </View>
      </View>

      {/* Bouton voir */}
      <View style={styles.viewRow}>
        <Ionicons name="eye-outline" size={14} color={C.blue} />
        <Text style={styles.viewTxt}>Voir le détail</Text>
        <Ionicons name="chevron-forward" size={14} color={C.blue} />
      </View>
    </Pressable>
  );
}

export function EquipmentsScreen() {
  const navigation = useNavigation<EquipNav>();
  const queryClient = useQueryClient();

  const deviceToken = usePairingStore((s) => s.paired?.deviceToken);
  const linked = usePairingStore((s) => s.paired?.status === 'linked');
  const lastRev = usePairingStore((s) => s.paired?.lastEquipmentsRevision);

  const { data: items = [], isPending, refetch, isRefetching } = useLocalEquipments();
  const { data: desktopBundle } = useDesktopKpiBundle();
  const snapshotPulling = useMobileSnapshotSyncStore((s) => s.pullInFlight);

  const kpisMap = desktopBundle?.kpisByEquipmentId ?? {};
  const syncedItems = items.filter((i) => i.syncedFromDesktop);
  const withKpiCount = syncedItems.filter((i) =>
    kpiRecordHasDisplayableData(getKpiRecordFromBundle(kpisMap, i.id))
  ).length;
  const listHasAllKpi = syncedItems.length > 0 && withKpiCount === syncedItems.length;
  const listSubtitle =
    syncedItems.length > 0
      ? `${withKpiCount}/${syncedItems.length} équipement(s) avec indicateurs bureau.`
      : undefined;

  const reload = useCallback(async () => {
    await refetch();
    await queryClient.invalidateQueries({ queryKey: ['local', 'desktop-kpi-bundle'] });
  }, [refetch, queryClient]);

  useFocusEffect(
    useCallback(() => {
      if (linked && deviceToken) {
        void pullMobileSnapshotForce(queryClient);
      }
    }, [deviceToken, linked, queryClient])
  );

  const openDetail = useCallback(
    (id: string) => { navigation.navigate('EquipmentDetail', { equipmentId: id }); },
    [navigation]
  );

  return (
    <View style={styles.container}>
      {/* En-tete */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Équipements</Text>
          <Text style={styles.subtitle}>
            {linked && deviceToken
              ? `Synchronisé · révision ${lastRev ?? '--'}`
              : 'Stockage local · appairez pour synchroniser'}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeTxt}>{items.length}</Text>
        </View>
      </View>

      {/* Bannière sync */}
      {linked && deviceToken && syncedItems.length > 0 ? (
        <View style={{ marginBottom: 8 }}>
          <DesktopSyncStatusBanner
            linked
            hasKpiData={listHasAllKpi}
            subtitle={listSubtitle}
            compactSuccess={listHasAllKpi}
          />
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {!(linked && deviceToken) ? (
          <Pressable
            onPress={async () => {
              await seedDemoData();
              await queryClient.invalidateQueries({ queryKey: ['local', 'equipments'] });
              await queryClient.invalidateQueries({ queryKey: ['local', 'alerts'] });
            }}
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="flask-outline" size={14} color="#fff" />
            <Text style={styles.btnTxt}>Données démo</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={reload}
          style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="refresh-outline" size={14} color={C.blue} />
          <Text style={[styles.btnTxt, { color: C.blue }]}>{isRefetching ? 'Actualisation...' : 'Actualiser'}</Text>
        </Pressable>
      </View>

      {/* Liste */}
      {isPending ? (
        <ActivityIndicator color={C.blue} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={reload}
          renderItem={({ item }) => {
            const kpis = desktopBundle?.kpisByEquipmentId ?? {};
            const stats = desktopBundle?.measurementStatsByEquipmentId ?? {};
            const kRec = getKpiRecordFromBundle(kpis, item.id);
            const sRaw = getStatsRawFromBundle(stats, item.id);
            const m = item.syncedFromDesktop ? computeEquipMetricsFromDesktopKpi(kRec, sRaw) : null;
            let lastMeasure = '--';
            if (sRaw && typeof sRaw === 'object' && !Array.isArray(sRaw)) {
              const lm = (sRaw as Record<string, unknown>).last_measurement ?? (sRaw as Record<string, unknown>).lastMeasurement;
              if (typeof lm === 'string' && lm) {
                try {
                  lastMeasure = new Intl.DateTimeFormat('fr-FR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  }).format(new Date(lm));
                } catch { lastMeasure = '--'; }
              }
            }
            const kpiLabel = item.syncedFromDesktop && !m
              ? (kpiEmptyLabel(kpiEmptyReason(kRec)) || undefined)
              : undefined;
            return (
              <EquipmentCard
                item={item}
                metrics={m}
                lastMeasure={lastMeasure}
                onOpen={() => openDetail(item.id)}
                snapshotPulling={snapshotPulling}
                kpiStatusLabel={kpiLabel}
              />
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="hardware-chip-outline" size={48} color={C.textMuted} />
              <Text style={styles.emptyTitle}>Aucun équipement</Text>
              <Text style={styles.emptyBody}>Ajoutez des données démo ou appairez le bureau.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: { flex: 1 },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: C.textSub, fontSize: 13, marginTop: 2 },
  countBadge: {
    backgroundColor: C.blueSoft,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeTxt: { color: C.blue, fontSize: 15, fontWeight: '800' },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.blue,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.blueSoft,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  btnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },

  list: { gap: 10, paddingHorizontal: 16, paddingBottom: 32 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...C.shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: C.blue, fontSize: 18, fontWeight: '800' },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardName: { color: C.text, fontSize: 15, fontWeight: '800' },
  cardType: { color: C.textSub, fontSize: 12 },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardSite: { color: C.textMuted, fontSize: 11 },
  badges: { gap: 5, alignItems: 'flex-end' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeTxt: { fontSize: 11, fontWeight: '700' },
  srcBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  srcBadgeTxt: { fontSize: 10, fontWeight: '800' },

  kpiRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  kpiCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  kpiLabel: { color: C.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 },
  kpiVal: { color: C.text, fontSize: 13, fontWeight: '700' },

  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.blueSoft,
  },
  viewTxt: { color: C.blue, fontSize: 13, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 24 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DesktopSyncStatusBanner } from '@/components/sync/DesktopSyncStatusBanner';
import type { Equipment } from '@/domain/equipment';
import {
  consumptionSubtitleFromKpi,
  costFcfaFromKpi,
  formatConsumptionKwh,
  formatFcfa,
  getConsumptionKwhFromKpi,
  getKpiRecordForEquipment,
  getPfFromKpi,
  kpiEmptyLabel,
  kpiEmptyReason,
  kpiRecordHasDisplayableData,
} from '@/lib/desktopKpiDisplay';
import { useAppLayout } from '@/hooks/useAppLayout';
import { useDesktopKpiBundle } from '@/hooks/useDesktopKpiBundle';
import { useLocalAlerts } from '@/hooks/useLocalAlerts';
import { useLocalEquipments } from '@/hooks/useLocalEquipments';
import { usePairingStore } from '@/store/pairingStore';
import { C, statusColor } from '@/theme/colors';

const STORAGE_KEY = 'selectedEquipmentId';

// ── Carte KPI ────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  accentBg: string;
  unit?: string;
}

function KpiCard({ title, value, subtitle, icon, accentColor, accentBg, unit }: KpiCardProps) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: accentColor }]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: accentBg }]}>
        <Ionicons name={icon} size={18} color={accentColor} />
      </View>
      <Text style={styles.kpiTitle}>{title}</Text>
      <View style={styles.kpiValueRow}>
        <Text style={[styles.kpiValue, { color: accentColor }]}>{value}</Text>
        {unit ? <Text style={[styles.kpiUnit, { color: accentColor }]}>{unit}</Text> : null}
      </View>
      <Text style={styles.kpiSubtitle} numberOfLines={2}>{subtitle}</Text>
    </View>
  );
}

// ── Alerte compacte ───────────────────────────────────────────────────────
function AlertRow({ title, equip, sev }: { title: string; equip: string | null; sev: string }) {
  const dot = sev === 'critical' ? C.red : sev === 'warning' ? C.amber : C.blueMid;
  return (
    <View style={styles.alertRow}>
      <View style={[styles.alertDot, { backgroundColor: dot }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.alertTitle} numberOfLines={1}>{title}</Text>
        {equip ? <Text style={styles.alertEquip} numberOfLines={1}>{equip}</Text> : null}
      </View>
    </View>
  );
}

// ── Equipement compact ────────────────────────────────────────────────────
function EquipRow({ name, site, hasKpi }: { name: string; site?: string | null; hasKpi: boolean }) {
  const initial = (name?.trim().charAt(0) ?? '?').toUpperCase();
  return (
    <View style={styles.equipRow}>
      <View style={styles.equipAvatar}>
        <Text style={styles.equipAvatarTxt}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.equipName} numberOfLines={1}>{name}</Text>
        {site ? <Text style={styles.equipSite} numberOfLines={1}>{site}</Text> : null}
      </View>
      <View style={[styles.equipStatus, { backgroundColor: hasKpi ? C.greenSoft : C.surface2 }]}>
        <Text style={[styles.equipStatusTxt, { color: hasKpi ? C.green : C.textMuted }]}>
          {hasKpi ? 'KPI' : '--'}
        </Text>
      </View>
    </View>
  );
}

// ── Ecran principal ───────────────────────────────────────────────────────
export function DashboardScreen() {
  const layout = useAppLayout();
  const deviceToken = usePairingStore((s) => s.paired?.deviceToken);
  const linked = usePairingStore((s) => s.paired?.status === 'linked');
  const cloudLinked = Boolean(linked && deviceToken);

  const { data: equipments = [], isLoading: loadEq, isFetching: fetchEq, refetch: refetchEq, dataUpdatedAt: eqUpdatedAt } = useLocalEquipments();
  const { data: alerts = [], isFetching: fetchAl, refetch: refetchAl, dataUpdatedAt: alUpdatedAt } = useLocalAlerts();
  const { data: desktopBundle, isFetching: fetchKpi, refetch: refetchKpi } = useDesktopKpiBundle();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && v) setSelectedId(v);
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageReady || equipments.length === 0) return;
    const valid = selectedId && equipments.some((e) => e.id === selectedId);
    if (!valid) {
      const first = equipments[0].id;
      setSelectedId(first);
      void AsyncStorage.setItem(STORAGE_KEY, first);
    }
  }, [storageReady, equipments, selectedId]);

  const equipmentId = selectedId ?? equipments[0]?.id ?? null;
  const selectedEquip = equipments.find((e) => e.id === equipmentId);
  const equipmentName = selectedEquip?.name ?? null;

  const handleEquipChange = useCallback((id: string) => {
    setSelectedId(id);
    void AsyncStorage.setItem(STORAGE_KEY, id);
    setPickerOpen(false);
  }, []);

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchEq(), refetchAl(), refetchKpi()]);
  }, [refetchEq, refetchAl, refetchKpi]);

  const refreshing = fetchEq || fetchAl || fetchKpi;
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status !== 'resolved'), [alerts]);
  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter((a) => a.severity === 'warning').length;
  const hasDesktopSyncedEquip = useMemo(() => equipments.some((e) => e.syncedFromDesktop), [equipments]);

  const kpiRecord = useMemo(
    () => getKpiRecordForEquipment(desktopBundle?.kpisByEquipmentId, equipmentId),
    [desktopBundle?.kpisByEquipmentId, equipmentId]
  );
  const hasKpiForSelection = kpiRecordHasDisplayableData(kpiRecord);
  const emptyKpiLabel = useMemo(() => kpiEmptyLabel(kpiEmptyReason(kpiRecord)), [kpiRecord]);

  const consumptionKwh = useMemo(() => getConsumptionKwhFromKpi(kpiRecord), [kpiRecord]);
  const pfBundle = useMemo(() => getPfFromKpi(kpiRecord), [kpiRecord]);
  const costFcfa = useMemo(() => costFcfaFromKpi(kpiRecord), [kpiRecord]);

  const consumpValue = consumptionKwh != null && consumptionKwh > 0 ? formatConsumptionKwh(consumptionKwh) : '--';
  const consumpSubtitle = useMemo(() => {
    if (!hasKpiForSelection) return hasDesktopSyncedEquip ? (emptyKpiLabel || 'En attente des KPI bureau') : 'Appairez le bureau';
    const base = consumptionSubtitleFromKpi(kpiRecord);
    return costFcfa != null && costFcfa > 0 ? `${base}  ${formatFcfa(costFcfa)}` : base;
  }, [kpiRecord, costFcfa, hasKpiForSelection, hasDesktopSyncedEquip, emptyKpiLabel]);

  const pfValue = pfBundle.value != null && pfBundle.value > 0 ? pfBundle.value.toFixed(3) : '--';
  const pfColor = statusColor(pfBundle.status);
  const pfSubtitle = hasKpiForSelection ? (equipmentName ? equipmentName : 'Donnees bureau') : '--';

  const harmonicsThd = kpiRecord?.harmonics && typeof kpiRecord.harmonics === 'object'
    ? (kpiRecord.harmonics as { thdTotal?: number }).thdTotal
    : undefined;

  const lastUpdateMs = Math.max(eqUpdatedAt ?? 0, alUpdatedAt ?? 0);
  const lastUpdate = lastUpdateMs > 0
    ? new Date(lastUpdateMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const alertColor = criticalCount > 0 ? C.red : warningCount > 0 ? C.amber : C.green;
  const alertBg = criticalCount > 0 ? C.redSoft : warningCount > 0 ? C.amberSoft : C.greenSoft;

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.scrollInner, { paddingHorizontal: layout.padH, paddingBottom: layout.insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blue} />}
    >
      {/* ── En-tete ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateText}>{today}</Text>
          <Text style={styles.h1}>Tableau de bord</Text>
          <Text style={styles.h1Sub}>Qualite de l&apos;energie</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={11} color={C.textMuted} />
            <Text style={styles.timeTxt}>{lastUpdate}</Text>
          </View>
          {equipments.length > 0 ? (
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [styles.equipBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="hardware-chip-outline" size={13} color={C.blue} />
              <Text style={styles.equipBtnText} numberOfLines={1}>{equipmentName ?? 'Equipement'}</Text>
              <Text style={styles.chevron}>▼</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── Banniere sync ─────────────────────────────────────────── */}
      {hasDesktopSyncedEquip && cloudLinked ? (
        <DesktopSyncStatusBanner
          linked
          hasKpiData={hasKpiForSelection}
          subtitle="Donnees KPI recues depuis le bureau."
          compactSuccess={hasKpiForSelection}
        />
      ) : null}

      {/* ── Grille KPI 2x2 ────────────────────────────────────────── */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiRow}>
          <KpiCard
            title="Consommation"
            value={consumpValue}
            subtitle={consumpSubtitle}
            icon="flash-outline"
            accentColor={C.cyan}
            accentBg={C.cyanSoft}
          />
          <KpiCard
            title="Facteur de puissance"
            value={pfValue}
            subtitle={pfSubtitle}
            icon="speedometer-outline"
            accentColor={pfColor}
            accentBg={pfColor === C.green ? C.greenSoft : pfColor === C.amber ? C.amberSoft : C.redSoft}
          />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard
            title="Alertes actives"
            value={String(activeAlerts.length)}
            subtitle={criticalCount + warningCount > 0 ? `${criticalCount} critique  ${warningCount} avert.` : 'Aucune alerte'}
            icon="warning-outline"
            accentColor={alertColor}
            accentBg={alertBg}
          />
          <KpiCard
            title="Equipements"
            value={String(equipments.length)}
            subtitle={hasDesktopSyncedEquip ? 'Snapshot bureau' : 'Base locale'}
            icon="desktop-outline"
            accentColor={C.purple}
            accentBg={C.purpleSoft}
          />
        </View>
      </View>

      {/* ── THD info (si disponible) ─────────────────────────────── */}
      {typeof harmonicsThd === 'number' && harmonicsThd >= 0 ? (
        <View style={styles.thdCard}>
          <View style={styles.thdLeft}>
            <Ionicons name="analytics-outline" size={18} color={C.purple} />
            <Text style={styles.thdLabel}>THD courant total</Text>
          </View>
          <Text style={styles.thdValue}>{harmonicsThd.toFixed(2)} %</Text>
        </View>
      ) : null}

      {/* ── Alertes recentes ─────────────────────────────────────── */}
      {activeAlerts.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Alertes recentes</Text>
            <View style={[styles.countBadge, { backgroundColor: alertBg }]}>
              <Text style={[styles.countBadgeTxt, { color: alertColor }]}>{activeAlerts.length}</Text>
            </View>
          </View>
          <View style={styles.sectionCard}>
            {activeAlerts.slice(0, 4).map((a) => (
              <AlertRow key={a.id} title={a.title} equip={a.equipmentName} sev={a.severity} />
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Equipements surveilles ────────────────────────────────── */}
      {equipments.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Equipements surveilles</Text>
            <Text style={styles.sectionCount}>{equipments.length}</Text>
          </View>
          <View style={styles.sectionCard}>
            {equipments.slice(0, 4).map((eq: Equipment) => {
              const kRec = desktopBundle?.kpisByEquipmentId
                ? getKpiRecordForEquipment(desktopBundle.kpisByEquipmentId, eq.id)
                : null;
              return (
                <EquipRow
                  key={eq.id}
                  name={eq.name}
                  site={eq.site}
                  hasKpi={kpiRecordHasDisplayableData(kRec)}
                />
              );
            })}
            {equipments.length > 4 ? (
              <Text style={styles.moreEquip}>+{equipments.length - 4} autres</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── Pied de page ─────────────────────────────────────────── */}
      {loadEq ? <ActivityIndicator color={C.blue} style={{ marginTop: 8 }} /> : null}
      <Text style={styles.footer}>
        KPI calcules sur le bureau et pousses via sync-service.
      </Text>

      {/* ── Modal choix equipement ────────────────────────────────── */}
      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Choisir un equipement</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {equipments.map((eq: Equipment) => (
                <Pressable
                  key={eq.id}
                  onPress={() => handleEquipChange(eq.id)}
                  style={({ pressed }) => [
                    styles.modalRow,
                    eq.id === equipmentId && styles.modalRowSelected,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <Text style={[styles.modalRowText, eq.id === equipmentId && styles.modalRowTextBold]}>
                    {eq.name}
                  </Text>
                  {eq.id === equipmentId ? (
                    <Ionicons name="checkmark" size={16} color={C.blue} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scrollInner: { paddingTop: 12, gap: 16 },

  // En-tete
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dateText: { color: C.textMuted, fontSize: 11, fontWeight: '500', textTransform: 'capitalize', marginBottom: 2 },
  h1: { color: C.text, fontSize: 22, fontWeight: '800' },
  h1Sub: { color: C.textSub, fontSize: 13, marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.surface2, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  timeTxt: { color: C.textSub, fontSize: 11, fontFamily: 'monospace' },
  equipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  equipBtnText: { color: C.blue, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  chevron: { color: C.textMuted, fontSize: 9 },

  // Grille KPI
  kpiGrid: { gap: 10 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderTopWidth: 3,
    padding: 14,
    gap: 6,
    ...C.shadow,
  },
  kpiIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  kpiTitle: { color: C.textSub, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiUnit: { fontSize: 12, fontWeight: '600' },
  kpiSubtitle: { color: C.textMuted, fontSize: 11, lineHeight: 15 },

  // THD
  thdCard: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...C.shadow },
  thdLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thdLabel: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  thdValue: { color: C.purple, fontSize: 18, fontWeight: '800' },

  // Sections
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '700', flex: 1 },
  sectionCount: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  countBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeTxt: { fontSize: 11, fontWeight: '800' },
  sectionCard: { backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden', ...C.shadow },

  // Alerte row
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderSub },
  alertDot: { width: 7, height: 7, borderRadius: 4 },
  alertTitle: { color: C.text, fontSize: 13, fontWeight: '600' },
  alertEquip: { color: C.textMuted, fontSize: 11 },

  // Equip row
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderSub },
  equipAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  equipAvatarTxt: { color: C.blue, fontSize: 14, fontWeight: '800' },
  equipName: { color: C.text, fontSize: 13, fontWeight: '600' },
  equipSite: { color: C.textMuted, fontSize: 11 },
  equipStatus: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  equipStatusTxt: { fontSize: 10, fontWeight: '800' },
  moreEquip: { color: C.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 10 },

  footer: { color: C.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingVertical: 8, maxHeight: '70%', ...C.shadowMd },
  modalTitle: { color: C.text, fontWeight: '800', fontSize: 16, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  modalRowSelected: { backgroundColor: C.blueSoft },
  modalRowText: { color: C.text, fontSize: 15 },
  modalRowTextBold: { fontWeight: '800', color: C.blue },
});

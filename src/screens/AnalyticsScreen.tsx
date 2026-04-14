import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  AnalysisCard,
  AnalyticsSplitRow,
  MobileConsumptionHeatmap,
  MobileConsumptionTrendChart,
  MobileEnergyCurvesChart,
  MobileEnergyDonutChart,
  MobileHarmonicsSpectrumChart,
  MobileIECComplianceGrid,
  MobilePhaseBalanceVerticalChart,
  MobilePhaseRadarChart,
  MobilePhaseVoltageImbalanceChart,
} from '@/components/analytics';
import { useAppLayout } from '@/hooks/useAppLayout';
import { useDesktopKpiBundle } from '@/hooks/useDesktopKpiBundle';
import { useLocalEquipments } from '@/hooks/useLocalEquipments';
import {
  formatConsumptionKwh,
  formatFcfa,
  getConsumptionKwhFromKpi,
  getPfFromKpi,
  kpiRecordHasDisplayableData,
  costFcfaFromKpi,
} from '@/lib/desktopKpiDisplay';
import { buildComplianceItemsFromKpi } from '@/lib/iecComplianceFromKpi';
import { getKpiRecordFromBundle, getStatsRawFromBundle } from '@/lib/syncBundleLookup';
import { usePairingStore } from '@/store/pairingStore';
import { C, statusBg, statusColor } from '@/theme/colors';

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function fmtPct(v: number | null, decimals = 1): string {
  if (v == null) return '--';
  return `${v.toFixed(decimals)} %`;
}

function MetricTile({ label, value, color, bg, icon }: {
  label: string; value: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[tiles.tile, { backgroundColor: C.surface }]}>
      <View style={[tiles.icon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <Text style={[tiles.value, { color }]}>{value}</Text>
      <Text style={tiles.label}>{label}</Text>
    </View>
  );
}

const tiles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    alignItems: 'center',
    gap: 8,
    ...C.shadowCard,
  },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 19, fontWeight: '800' },
  label: { color: C.textMuted, fontSize: 11, textAlign: 'center', fontWeight: '600' },
});

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={detail.row}>
      <Text style={detail.label}>{label}</Text>
      <Text style={[detail.value, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

const detail = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.borderSub },
  label: { color: C.textSub, fontSize: 13 },
  value: { color: C.text, fontSize: 13, fontWeight: '700' },
});

const CH_HARM = 220;
const CH_PHASE_H = 200;
const CH_TREND = 230;
const CH_CURVES = 240;
const CH_RADAR = 260;
const CH_VERT = 240;
const CH_DONUT = 260;

export function AnalyticsScreen() {
  const layout = useAppLayout();
  const { width: screenW } = useWindowDimensions();
  const linked = usePairingStore((s) => s.paired?.status === 'linked');
  const deviceToken = usePairingStore((s) => s.paired?.deviceToken);
  const cloudLinked = Boolean(linked && deviceToken);

  const { data: equipments = [], isLoading: loadEq } = useLocalEquipments();
  const { data: desktopBundle, isFetching: fetchKpi, refetch } = useDesktopKpiBundle();

  const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dataView, setDataView] = useState<'all' | 'recording' | 'energy'>('all');

  const syncedEquipments = equipments.filter((e) => e.syncedFromDesktop);
  const selectedEquip = syncedEquipments.find((e) => e.id === selectedEquipId) ?? syncedEquipments[0] ?? null;
  const effectiveId = selectedEquip?.id ?? null;

  const kpiRecord = useMemo(() => {
    if (!desktopBundle || !effectiveId) return null;
    return getKpiRecordFromBundle(desktopBundle.kpisByEquipmentId, effectiveId);
  }, [desktopBundle, effectiveId]);

  const measStats = useMemo(() => {
    if (!desktopBundle || !effectiveId) return null;
    return getStatsRawFromBundle(desktopBundle.measurementStatsByEquipmentId, effectiveId);
  }, [desktopBundle, effectiveId]);

  const hasKpi = kpiRecordHasDisplayableData(kpiRecord);

  const harmObj = kpiRecord?.harmonics as Record<string, unknown> | undefined;
  const harmList = harmObj && Array.isArray(harmObj.harmonics) ? (harmObj.harmonics as { rank?: number; value?: number; status?: string }[]) : [];
  const thdTotal = num(harmObj?.thdTotal) ?? 0;
  const thdLimit = num(harmObj?.thdLimit) ?? 8;
  const thdCurr = kpiRecord?.thdCurrent as Record<string, unknown> | undefined;
  const thdIVal = thdCurr ? num(thdCurr.value ?? thdCurr.average ?? thdCurr.thdTotal) : null;

  const ecBlock = useMemo(() => {
    if (!kpiRecord) return null;
    const ec = kpiRecord.energyConsumption as Record<string, unknown> | undefined;
    if (!ec || typeof ec !== 'object') return null;
    const series = Array.isArray(ec.series) ? (ec.series as { active?: number }[]) : [];
    return {
      peakKw: num(ec.peakKw),
      totalMWh: num(ec.totalMWh),
      costFcfa: num(ec.costFcfa),
      periodDays: num(ec.periodDays),
      series,
    };
  }, [kpiRecord]);

  const pbBlock = useMemo(() => {
    if (!kpiRecord) return null;
    const pb = kpiRecord.phaseBalance as Record<string, unknown> | undefined;
    if (!pb || typeof pb !== 'object') return null;
    const phases = pb.phases as Record<string, unknown> | undefined;
    const L1 = phases ? num(phases.L1) : null;
    const L2 = phases ? num(phases.L2) : null;
    const L3 = phases ? num(phases.L3) : null;
    if (L1 == null && L2 == null && L3 == null) return null;
    return {
      L1: L1 ?? 0,
      L2: L2 ?? 0,
      L3: L3 ?? 0,
      nominal: num(pb.nominal) ?? 230,
      unbalancePercent: num(pb.unbalancePercent) ?? 0,
      unit: typeof pb.unit === 'string' ? pb.unit : 'V',
      status: String(pb.status ?? 'normal') as 'normal' | 'warning' | 'critical',
      norm: typeof pb.norm === 'string' ? pb.norm : 'EN 50160',
    };
  }, [kpiRecord]);

  const cbBlock = useMemo(() => {
    if (!kpiRecord) return null;
    const cb = kpiRecord.currentBalance as Record<string, unknown> | undefined;
    if (!cb || typeof cb !== 'object') return null;
    const phases = cb.phases as Record<string, unknown> | undefined;
    const L1 = phases ? num(phases.L1) : null;
    const L2 = phases ? num(phases.L2) : null;
    const L3 = phases ? num(phases.L3) : null;
    if (L1 == null && L2 == null && L3 == null) return null;
    return {
      L1: L1 ?? 0,
      L2: L2 ?? 0,
      L3: L3 ?? 0,
      unit: typeof cb.unit === 'string' ? cb.unit : 'A',
    };
  }, [kpiRecord]);

  const energyCurvesSeries = useMemo(() => {
    const ec = kpiRecord?.energyCurves as Record<string, unknown> | undefined;
    if (!ec || !Array.isArray(ec.series)) return null;
    const s = ec.series as { epT?: number; eqT?: number; edT?: number }[];
    return s.length > 1 ? s : null;
  }, [kpiRecord]);

  const heatmapCells = useMemo(() => {
    const hm = kpiRecord?.heatmap as Record<string, unknown> | undefined;
    if (!hm || !Array.isArray(hm.cells)) return null;
    return hm.cells as { dayOfWeek?: number; hour?: number; value?: number; level?: string }[];
  }, [kpiRecord]);

  const heatmapSubtitle = useMemo(() => {
    const hm = kpiRecord?.heatmap as Record<string, unknown> | undefined;
    return typeof hm?.subtitle === 'string' ? hm.subtitle : undefined;
  }, [kpiRecord]);

  const energyDistribution = useMemo(() => {
    if (!kpiRecord) return null;
    const ek = kpiRecord.energyKPIs as Record<string, unknown> | undefined;
    if (ek) {
      return {
        totalActiveEnergy: num(ek.totalActiveEnergy) ?? 0,
        totalReactiveEnergy: num(ek.totalReactiveEnergy) ?? 0,
        distortionRateEnergy: num(ek.distortionRateEnergy) ?? 0,
      };
    }
    const ec = kpiRecord.energyConsumption as Record<string, unknown> | undefined;
    const pfVal = num((kpiRecord.powerFactor as Record<string, unknown> | undefined)?.value);
    if (ec && pfVal != null) {
      const totalMWh = num(ec.totalMWh);
      if (totalMWh == null) return null;
      const totalActiveEnergy = totalMWh * 1000;
      const cosPhi = Math.max(0.01, Math.min(1, pfVal));
      const tanPhi = Math.sqrt(Math.max(0, 1 / (cosPhi * cosPhi) - 1));
      return {
        totalActiveEnergy,
        totalReactiveEnergy: totalActiveEnergy * tanPhi,
        distortionRateEnergy: 0,
      };
    }
    return null;
  }, [kpiRecord]);

  const complianceItems = useMemo(() => {
    if (!kpiRecord) return [];
    return buildComplianceItemsFromKpi(kpiRecord as Record<string, unknown>);
  }, [kpiRecord]);

  const hasBoth = Boolean(kpiRecord?.hasRecordingData && kpiRecord?.hasEnergyData);
  const showRecording = dataView === 'all' || dataView === 'recording';
  const showEnergy = dataView === 'all' || dataView === 'energy';

  const isWide = screenW >= 760;
  const gap = 12;
  const fullW = Math.max(0, screenW - layout.padH * 2);
  const colW = isWide ? (fullW - gap) / 2 : fullW;

  const kwh = getConsumptionKwhFromKpi(kpiRecord);
  const costFcfa = costFcfaFromKpi(kpiRecord);

  const agg = useMemo(() => {
    const kpisMap = desktopBundle?.kpisByEquipmentId ?? {};
    let totalConsumption = 0;
    let hasConsumption = false;
    const pfs: number[] = [];
    const thdVs: number[] = [];
    const thdIs: number[] = [];
    let equipsWithData = 0;
    for (const eq of syncedEquipments) {
      const kRec = getKpiRecordFromBundle(kpisMap, eq.id);
      if (!kpiRecordHasDisplayableData(kRec)) continue;
      equipsWithData++;
      const k2 = getConsumptionKwhFromKpi(kRec);
      if (k2 != null && k2 > 0) { totalConsumption += k2; hasConsumption = true; }
      const pf2 = getPfFromKpi(kRec);
      if (pf2.value != null) pfs.push(pf2.value);
      const thdV = num((kRec?.harmonics as Record<string, unknown> | undefined)?.thdTotal);
      if (thdV != null) thdVs.push(thdV);
      const thdCurr2 = kRec?.thdCurrent as Record<string, unknown> | undefined;
      const thdI = num(thdCurr2?.value ?? thdCurr2?.average ?? thdCurr2?.thdTotal);
      if (thdI != null) thdIs.push(thdI);
    }
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    return {
      totalConsumptionKwh: hasConsumption ? totalConsumption : null,
      avgPf: avg(pfs),
      avgThdV: avg(thdVs),
      avgThdI: avg(thdIs),
      equipsWithData,
      equipsTotal: syncedEquipments.length,
    };
  }, [syncedEquipments, desktopBundle]);

  if (loadEq) {
    return <View style={styles.center}><ActivityIndicator color={C.blue} /></View>;
  }

  const noHarmData = kpiRecord != null && !harmObj;
  const noPhaseVolt = kpiRecord != null && !pbBlock;
  const noRadar = kpiRecord != null && !pbBlock && !cbBlock;

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={[styles.content, { paddingHorizontal: layout.padH }]}
      refreshControl={<RefreshControl refreshing={fetchKpi} onRefresh={refetch} tintColor={C.blue} />}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontSize: layout.fontTitle }]}>Analyses</Text>
          <Text style={styles.caption}>
            {cloudLinked
              ? `${agg.equipsWithData} / ${agg.equipsTotal} équipement(s) avec données KPI`
              : 'Appairez le mobile au bureau pour voir les analyses.'}
          </Text>
        </View>
        {syncedEquipments.length > 0 && cloudLinked ? (
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.equipBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="hardware-chip-outline" size={13} color={C.blue} />
            <Text style={styles.equipBtnTxt} numberOfLines={1}>
              {selectedEquip?.name ?? 'Équipement'}
            </Text>
            <Ionicons name="chevron-down" size={12} color={C.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {!cloudLinked ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="link-outline" size={52} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Non appairé</Text>
          <Text style={styles.emptyBody}>Appairez le mobile au bureau pour voir les analyses KPI.</Text>
        </View>
      ) : syncedEquipments.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="cloud-offline-outline" size={52} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Aucun équipement synchronisé</Text>
          <Text style={styles.emptyBody}>Importez des mesures sur le bureau et lancez une synchronisation.</Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vue globale</Text>
            <View style={styles.heroCard}>
              <View style={[styles.heroIcon, { backgroundColor: C.cyanSoft }]}>
                <Ionicons name="flash" size={22} color={C.cyan} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Consommation totale</Text>
                <Text style={styles.heroSub}>{agg.equipsWithData} équipement(s)</Text>
              </View>
              <Text style={[styles.heroValue, { color: C.cyan }]}>
                {agg.totalConsumptionKwh != null ? formatConsumptionKwh(agg.totalConsumptionKwh) : '--'}
              </Text>
            </View>
            <View style={styles.tilesRow}>
              <MetricTile label="FP moyen" value={agg.avgPf != null ? agg.avgPf.toFixed(3) : '--'} color={C.blue} bg={C.blueSoft} icon="speedometer-outline" />
              <MetricTile label="THD tension moy." value={fmtPct(agg.avgThdV)} color={C.purple} bg={C.purpleSoft} icon="pulse-outline" />
              <MetricTile label="THD courant moy." value={fmtPct(agg.avgThdI)} color={C.cyan} bg={C.cyanSoft} icon="analytics-outline" />
            </View>
          </View>

          {selectedEquip ? (
            <>
              <View style={styles.equipBanner}>
                <View style={styles.equipBannerAvatar}>
                  <Text style={styles.equipBannerAvatarTxt}>
                    {selectedEquip.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.equipBannerName}>{selectedEquip.name}</Text>
                  {selectedEquip.site ? <Text style={styles.equipBannerSite}>{selectedEquip.site}</Text> : null}
                </View>
                {!hasKpi ? (
                  <View style={styles.noDataBadge}>
                    <Text style={styles.noDataBadgeTxt}>Sans données</Text>
                  </View>
                ) : null}
              </View>

              {!hasKpi ? (
                <View style={styles.noKpiCard}>
                  <Ionicons name="cloud-offline-outline" size={32} color={C.textMuted} />
                  <Text style={styles.noKpiTxt}>Aucune donnée KPI disponible pour cet équipement.</Text>
                  <Text style={styles.noKpiSub}>Lancez une synchronisation depuis le bureau.</Text>
                </View>
              ) : (
                <View style={{ gap: gap }}>
                  {hasBoth ? (
                    <View style={styles.dataViewBar}>
                      <Text style={styles.dataViewLabel}>Données à afficher :</Text>
                      <View style={styles.dataViewSeg}>
                        {([
                          { key: 'all' as const, label: 'Tout' },
                          { key: 'recording' as const, label: 'Enregistrement' },
                          { key: 'energy' as const, label: 'Énergie' },
                        ]).map(({ key, label }) => (
                          <Pressable
                            key={key}
                            onPress={() => setDataView(key)}
                            style={[styles.dataViewBtn, dataView === key && styles.dataViewBtnOn]}
                          >
                            <Text style={[styles.dataViewBtnTxt, dataView === key && styles.dataViewBtnTxtOn]}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {/* Ligne 1 — Spectre harmoniques + Déséquilibre phases (tension) */}
                  <AnalyticsSplitRow isWide={isWide} gap={gap}>
                      <AnalysisCard
                        title="Spectre harmoniques (THD par rang)"
                        hint="Rangs 2–25 selon IEEE 519. Données issues des enregistrements qualité."
                      >
                        {noHarmData ? (
                          <Text style={styles.mutedBox}>
                            Données harmoniques non disponibles pour les imports d&apos;énergie cumulative.
                            Importez un fichier Enregistrement.xlsx pour accéder aux mesures de qualité.
                          </Text>
                        ) : (
                          <MobileHarmonicsSpectrumChart
                            width={colW - 4}
                            height={CH_HARM}
                            harmonics={harmList.length ? harmList : null}
                            thdTotal={thdTotal}
                            thdLimit={thdLimit}
                          />
                        )}
                      </AnalysisCard>
                      <AnalysisCard
                        title="Déséquilibre phases"
                        hint="Tensions L1 / L2 / L3 (seuil déséquilibre 5 %)."
                      >
                        {noPhaseVolt ? (
                          <Text style={styles.mutedBox}>
                            Mesures de tension non disponibles pour les imports d&apos;énergie cumulative.
                          </Text>
                        ) : pbBlock ? (
                          <MobilePhaseVoltageImbalanceChart
                            width={colW - 4}
                            height={CH_PHASE_H}
                            L1={pbBlock.L1}
                            L2={pbBlock.L2}
                            L3={pbBlock.L3}
                            nominal={pbBlock.nominal}
                            unbalancePercent={pbBlock.unbalancePercent}
                            unit={pbBlock.unit}
                          />
                        ) : null}
                      </AnalysisCard>
                  </AnalyticsSplitRow>

                  {/* Ligne 2 — Courbes énergie + Tendance consommation */}
                  {(showEnergy && energyCurvesSeries) || (showRecording && ecBlock && ecBlock.series.length > 1) ? (
                    <AnalyticsSplitRow isWide={isWide} gap={gap}>
                      {showEnergy && energyCurvesSeries ? (
                        <AnalysisCard title="Énergie consommées (EpT / EqT / EdT)" hint="Données cumulatives import Énergie (CA8336 / CA8436).">
                          <MobileEnergyCurvesChart width={colW - 4} height={CH_CURVES} series={energyCurvesSeries} />
                          <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#1E3A5F' }]} /><Text style={styles.legendLabel}>EpT</Text></View>
                            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} /><Text style={styles.legendLabel}>EqT</Text></View>
                            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F97316' }]} /><Text style={styles.legendLabel}>EdT</Text></View>
                          </View>
                        </AnalysisCard>
                      ) : null}
                      {showRecording && ecBlock && ecBlock.series.length > 1 ? (
                        <AnalysisCard title="Tendance de consommation" hint="Évolution de la puissance active (kW) sur la période.">
                          <MobileConsumptionTrendChart width={colW - 4} height={CH_TREND} series={ecBlock.series} />
                        </AnalysisCard>
                      ) : showRecording && (!ecBlock || ecBlock.series.length <= 1) && !energyCurvesSeries ? (
                        <AnalysisCard title="Tendance de consommation" hint="Évolution de la puissance active.">
                          <Text style={styles.mutedBox}>Pas assez de points de série pour afficher la tendance.</Text>
                        </AnalysisCard>
                      ) : null}
                    </AnalyticsSplitRow>
                  ) : null}

                  {/* Conformité IEC */}
                  <AnalysisCard title="Conformité IEC 61000-4-30" hint="Comparaison aux normes internationales de qualité d&apos;énergie (EN 50160, IEEE 519, WAPP, SONABEL).">
                    <MobileIECComplianceGrid items={complianceItems} />
                  </AnalysisCard>

                  {/* Équilibre phases radar + Équilibre triphasé */}
                  <AnalyticsSplitRow isWide={isWide} gap={gap}>
                      <AnalysisCard title="Équilibre des phases" hint="% de la moyenne par phase (100 % = équilibré). Tension vs courant.">
                        {noRadar ? (
                          <Text style={styles.mutedBox}>
                            Mesures tension et courant non disponibles pour les imports d&apos;énergie cumulative.
                          </Text>
                        ) : pbBlock && cbBlock ? (
                          <MobilePhaseRadarChart
                            width={colW - 4}
                            height={CH_RADAR}
                            vPhases={{ L1: pbBlock.L1, L2: pbBlock.L2, L3: pbBlock.L3 }}
                            iPhases={{ L1: cbBlock.L1, L2: cbBlock.L2, L3: cbBlock.L3 }}
                          />
                        ) : (
                          <Text style={styles.mutedBox}>Données radar incomplètes (tension ou courant par phase).</Text>
                        )}
                      </AnalysisCard>
                      {pbBlock ? (
                        <AnalysisCard
                          title="Équilibre triphasé"
                          hint="Barres tensions par phase avec ligne nominale."
                          right={(
                            <View style={[styles.badgeSoft, { backgroundColor: statusBg(pbBlock.status) }]}>
                              <Text style={[styles.badgeSoftTxt, { color: statusColor(pbBlock.status) }]}>
                                {`Déséquilibre: ${pbBlock.unbalancePercent.toFixed(2)}%`}
                              </Text>
                            </View>
                          )}
                        >
                          <MobilePhaseBalanceVerticalChart
                            width={colW - 4}
                            height={CH_VERT}
                            L1={pbBlock.L1}
                            L2={pbBlock.L2}
                            L3={pbBlock.L3}
                            nominal={pbBlock.nominal}
                            unbalancePercent={pbBlock.unbalancePercent}
                            unit={pbBlock.unit}
                            status={pbBlock.status}
                          />
                        </AnalysisCard>
                      ) : null}
                  </AnalyticsSplitRow>

                  {/* Répartition énergies + Carte consommation */}
                  <AnalyticsSplitRow isWide={isWide} gap={gap}>
                      {energyDistribution ? (
                        <AnalysisCard title="Répartition des énergies" hint="Énergie active, réactive et déformante sur la période.">
                          <MobileEnergyDonutChart
                            width={colW - 4}
                            height={CH_DONUT}
                            totalActiveEnergy={energyDistribution.totalActiveEnergy}
                            totalReactiveEnergy={energyDistribution.totalReactiveEnergy}
                            distortionRateEnergy={energyDistribution.distortionRateEnergy}
                          />
                          <View style={styles.legendRow}>
                            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} /><Text style={styles.legendLabel}>Énergie active (Ep)</Text></View>
                            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#F97316' }]} /><Text style={styles.legendLabel}>Énergie réactive (Eq)</Text></View>
                            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={styles.legendLabel}>Énergie déformante (Ed)</Text></View>
                          </View>
                        </AnalysisCard>
                      ) : (
                        <AnalysisCard title="Répartition des énergies">
                          <Text style={styles.mutedBox}>Agrégats énergie non disponibles pour cet équipement.</Text>
                        </AnalysisCard>
                      )}
                      <AnalysisCard title="Carte de consommation" subtitle="Par heure et jour de la semaine">
                        {heatmapCells && heatmapCells.length > 0 ? (
                          <MobileConsumptionHeatmap
                            cells={heatmapCells}
                            subtitle={heatmapSubtitle}
                            scrollMinWidth={colW}
                          />
                        ) : (
                          <Text style={styles.mutedBox}>Pas de heatmap synchronisée (données insuffisantes).</Text>
                        )}
                      </AnalysisCard>
                  </AnalyticsSplitRow>

                  {/* Récap chiffres clés (énergie / THD) */}
                  <AnalysisCard title="Indicateurs clés" hint="Synthèse numérique complémentaire aux graphiques.">
                    <View style={{ gap: 4 }}>
                      {kwh != null ? <DetailRow label="Énergie active (période)" value={formatConsumptionKwh(kwh)} accent={C.cyan} /> : null}
                      {ecBlock?.peakKw != null ? <DetailRow label="Puissance de pointe" value={`${ecBlock.peakKw.toFixed(1)} kW`} /> : null}
                      {costFcfa != null && costFcfa > 0 ? (
                        <DetailRow label="Coût estimé SONABEL" value={formatFcfa(costFcfa)} accent={C.green} />
                      ) : null}
                      {thdTotal > 0 || harmObj ? <DetailRow label="THD tension (global)" value={fmtPct(thdTotal)} /> : null}
                      {thdIVal != null ? <DetailRow label="THD courant (agrégé)" value={fmtPct(thdIVal)} /> : null}
                    </View>
                  </AnalysisCard>

                  {measStats && typeof measStats === 'object' ? (
                    <AnalysisCard title="Statistiques mesures">
                      <View>
                        {num((measStats as Record<string, unknown>).total_count) != null ? (
                          <DetailRow label="Nb. mesures" value={String((measStats as Record<string, unknown>).total_count)} />
                        ) : null}
                        {typeof (measStats as Record<string, unknown>).first_measurement === 'string' ? (
                          <DetailRow
                            label="Première mesure"
                            value={new Date(String((measStats as Record<string, unknown>).first_measurement)).toLocaleDateString('fr-FR')}
                          />
                        ) : null}
                        {typeof (measStats as Record<string, unknown>).last_measurement === 'string' ? (
                          <DetailRow
                            label="Dernière mesure"
                            value={new Date(String((measStats as Record<string, unknown>).last_measurement)).toLocaleDateString('fr-FR')}
                          />
                        ) : null}
                      </View>
                    </AnalysisCard>
                  ) : null}
                </View>
              )}
            </>
          ) : null}
        </>
      )}

      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[styles.pickerCard, { marginHorizontal: layout.padH }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.pickerTitle}>Choisir un équipement</Text>
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {syncedEquipments.map((eq) => {
                const kRec = desktopBundle
                  ? getKpiRecordFromBundle(desktopBundle.kpisByEquipmentId, eq.id)
                  : null;
                const hasData = kpiRecordHasDisplayableData(kRec);
                const isSelected = (effectiveId === eq.id);
                return (
                  <Pressable
                    key={eq.id}
                    onPress={() => { setSelectedEquipId(eq.id); setPickerOpen(false); }}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      isSelected && styles.pickerRowSelected,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View style={styles.pickerAvatar}>
                      <Text style={styles.pickerAvatarTxt}>{eq.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerRowTxt, isSelected && styles.pickerRowTxtActive]}>{eq.name}</Text>
                      {eq.site ? <Text style={styles.pickerRowSub}>{eq.site}</Text> : null}
                    </View>
                    <View style={[styles.kpiBadge, { backgroundColor: hasData ? C.greenSoft : C.surface2 }]}>
                      <Text style={[styles.kpiBadgeTxt, { color: hasData ? C.green : C.textMuted }]}>{hasData ? 'KPI' : '--'}</Text>
                    </View>
                    {isSelected ? <Ionicons name="checkmark" size={16} color={C.blue} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  content: { paddingTop: 14, paddingBottom: 48, gap: 16 },
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: C.text, fontWeight: '800' },
  caption: { color: C.textSub, fontSize: 13, lineHeight: 18, marginTop: 3 },
  equipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 220,
    ...C.shadowCard,
  },
  equipBtnTxt: { color: C.blue, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  section: { gap: 10 },
  sectionTitle: { color: C.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...C.shadowCard,
  },
  heroIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { color: C.text, fontSize: 14, fontWeight: '700' },
  heroSub: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  heroValue: { fontSize: 22, fontWeight: '800' },
  tilesRow: { flexDirection: 'row', gap: 8 },
  equipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.blueSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 16,
    ...C.shadowCard,
  },
  equipBannerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipBannerAvatarTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  equipBannerName: { color: C.text, fontSize: 15, fontWeight: '800' },
  equipBannerSite: { color: C.textSub, fontSize: 12, marginTop: 2 },
  noDataBadge: { backgroundColor: C.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  noDataBadgeTxt: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  noKpiCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 28,
    ...C.shadowCard,
  },
  noKpiTxt: { color: C.textSub, fontSize: 14, textAlign: 'center' },
  noKpiSub: { color: C.textMuted, fontSize: 12, textAlign: 'center' },
  emptyWrap: { alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: 16 },
  pickerCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...C.shadowCard,
  },
  pickerTitle: { color: C.text, fontWeight: '800', fontSize: 16, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSub,
  },
  pickerRowSelected: { backgroundColor: C.blueSoft },
  pickerRowTxt: { fontSize: 14, color: C.text },
  pickerRowTxtActive: { fontWeight: '700', color: C.blue },
  pickerRowSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  pickerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarTxt: { color: C.blue, fontSize: 12, fontWeight: '800' },
  kpiBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  kpiBadgeTxt: { fontSize: 10, fontWeight: '800' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { color: C.textSub, fontSize: 11 },
  mutedBox: { color: C.textMuted, fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  dataViewBar: { gap: 8 },
  dataViewLabel: { fontSize: 12, color: C.textMuted },
  dataViewSeg: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dataViewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
  },
  dataViewBtnOn: { backgroundColor: C.surface, borderColor: C.blue },
  dataViewBtnTxt: { fontSize: 12, fontWeight: '600', color: C.textMuted },
  dataViewBtnTxtOn: { color: C.blue },
  badgeSoft: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 160 },
  badgeSoftTxt: { fontSize: 11, fontWeight: '700' },
});

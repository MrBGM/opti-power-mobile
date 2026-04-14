import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';

import type { Equipment } from '@/domain/equipment';
import {
  MobilePowerEvolutionChart,
  powerChartLegend,
  type PowerSeriesPoint,
} from '@/components/equipment/MobilePowerEvolutionChart';
import { DesktopSyncStatusBanner } from '@/components/sync/DesktopSyncStatusBanner';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import {
  consumptionSubtitleFromKpi,
  formatConsumptionKwh,
  formatFcfa,
  getConsumptionKwhFromKpi,
  getKpiRecordForEquipment,
  getPfFromKpi,
  costFcfaFromKpi,
  kpiRecordHasDisplayableData,
} from '@/lib/desktopKpiDisplay';
import {
  electricalSpecificationsRowsDesktop,
  simpleDetailRowsExcludingIdentity,
  siteZoneFromLocationConfig,
  locationRows,
} from '@/lib/equipmentDesktopDetail';
import {
  complianceLabelFr,
  computeEquipMetricsFromDesktopKpi,
  equipStatusLabelFr,
} from '@/lib/equipmentMetricsFromDesktop';
import { useDesktopKpiBundle } from '@/hooks/useDesktopKpiBundle';
import { pullMobileSnapshotForce } from '@/hooks/useDesktopEquipmentsLiveSync';
import type { EquipmentsStackParamList } from '@/navigation/types';
import { getStatsRawFromBundle } from '@/lib/syncBundleLookup';
import { getEquipmentById } from '@/storage/equipmentsRepo';
import { usePairingStore } from '@/store/pairingStore';

const TYPE_LABELS: Record<string, string> = {
  power_analyzer: 'Analyseur de réseau',
  compressor: 'Compresseur',
  motor: 'Moteur',
  pump: 'Pompe',
  lighting: 'Éclairage',
  hvac: 'Climatisation',
  transformer: 'Transformateur',
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(iso)
    );
  } catch {
    return '—';
  }
}

function fmtDateTimeShort(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function pfKpiStatusFr(status: string): string {
  switch (status) {
    case 'critical':
      return 'Critique';
    case 'warning':
      return 'À surveiller';
    default:
      return 'Normal';
  }
}

function dbStatusLabelFr(raw: string | null | undefined): string {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'operational' || s === 'ok') return 'Opérationnel';
  if (s === 'warning') return 'Avertissement';
  if (s === 'critical' || s === 'fault') return 'Critique';
  if (s === 'offline' || s === 'disconnected') return 'Hors ligne';
  return raw?.trim() ? raw : '—';
}

/** Stats mesures : tolère snake_case (SQLite) et camelCase (JSON intermédiaire). */
function asMeasurementStats(raw: unknown): {
  total_count: number;
  first_measurement: string | null;
  last_measurement: string | null;
} | null {
  if (raw === undefined) return null;
  if (raw === null || (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length === 0)) {
    return { total_count: 0, first_measurement: null, last_measurement: null };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tc = o.total_count ?? o.totalCount;
  const total_count = typeof tc === 'number' && Number.isFinite(tc) ? tc : 0;
  const fm = o.first_measurement ?? o.firstMeasurement;
  const lm = o.last_measurement ?? o.lastMeasurement;
  return {
    total_count,
    first_measurement: typeof fm === 'string' ? fm : null,
    last_measurement: typeof lm === 'string' ? lm : null,
  };
}

export function EquipmentDetailScreen() {
  const route = useRoute<RouteProp<EquipmentsStackParamList, 'EquipmentDetail'>>();
  const queryClient = useQueryClient();
  const { data: desktopBundle, isLoading: bundleLoading, refetch: refetchBundle } = useDesktopKpiBundle();
  const [row, setRow] = useState<Equipment | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const linked = usePairingStore((s) => s.paired?.status === 'linked');
  const hasToken = Boolean(usePairingStore((s) => s.paired?.deviceToken));

  const equipmentId = route.params.equipmentId;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void queryClient.invalidateQueries({ queryKey: ['local', 'desktop-kpi-bundle'] });
      void (async () => {
        const r = await getEquipmentById(equipmentId);
        if (alive) setRow(r);
      })();
      return () => {
        alive = false;
      };
    }, [equipmentId, queryClient])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (linked && hasToken) {
        await pullMobileSnapshotForce(queryClient);
      }
      await refetchBundle();
      const r = await getEquipmentById(equipmentId);
      setRow(r);
    } finally {
      setRefreshing(false);
    }
  }, [equipmentId, hasToken, linked, queryClient, refetchBundle]);

  let detail: Record<string, unknown> | null = null;
  if (row?.syncPayload) {
    try {
      detail = JSON.parse(row.syncPayload) as Record<string, unknown>;
    } catch {
      detail = null;
    }
  }

  const description =
    detail && typeof detail.description === 'string' && detail.description.trim()
      ? detail.description.trim()
      : null;

  const locationR = detail ? locationRows(detail.location_config) : [];
  const otherSimple = detail ? simpleDetailRowsExcludingIdentity(detail) : [];
  const specRows = electricalSpecificationsRowsDesktop(detail?.electrical_config);
  const siteZone = siteZoneFromLocationConfig(detail?.location_config, row?.site);

  const typeLabel =
    row?.equipmentType != null && String(row.equipmentType).trim()
      ? TYPE_LABELS[String(row.equipmentType)] ?? String(row.equipmentType)
      : '—';

  const kpiRecord =
    row?.syncedFromDesktop && desktopBundle
      ? getKpiRecordForEquipment(desktopBundle.kpisByEquipmentId, equipmentId)
      : null;
  const measStatsRaw =
    row?.syncedFromDesktop && desktopBundle
      ? getStatsRawFromBundle(desktopBundle.measurementStatsByEquipmentId, equipmentId)
      : undefined;
  const measStats = asMeasurementStats(measStatsRaw);

  const metrics = useMemo(() => {
    if (!row?.syncedFromDesktop) return null;
    const statsForMetrics =
      measStats ?? ({ total_count: 0, first_measurement: null, last_measurement: null } as const);
    return computeEquipMetricsFromDesktopKpi(kpiRecord, statsForMetrics);
  }, [row?.syncedFromDesktop, kpiRecord, measStats]);

  const pfDisp = kpiRecord ? getPfFromKpi(kpiRecord) : { value: null, status: 'normal' as const };
  const kwh = kpiRecord ? getConsumptionKwhFromKpi(kpiRecord) : null;
  const cost = kpiRecord ? costFcfaFromKpi(kpiRecord) : null;
  const freqObj = kpiRecord?.frequency as { avgHz?: number } | undefined;
  const voltObj = kpiRecord?.voltage as { vLnAvg?: number; vLlAvg?: number } | undefined;

  const pfBlock = useMemo(() => {
    if (!kpiRecord) return null;
    const pf = kpiRecord.powerFactor as Record<string, unknown> | undefined;
    if (!pf || typeof pf !== 'object') return null;
    return {
      value: num(pf.value),
      dpf: num(pf.dpf),
      target: num(pf.target) ?? 0.9,
      threshold: num(pf.threshold) ?? 0.85,
      status: String(pf.status ?? 'normal'),
    };
  }, [kpiRecord]);

  const harmBlock = useMemo(() => {
    if (!kpiRecord) return null;
    const h = kpiRecord.harmonics as Record<string, unknown> | undefined;
    if (!h || typeof h !== 'object') return null;
    const harmonics = Array.isArray(h.harmonics) ? h.harmonics : [];
    return {
      thdTotal: num(h.thdTotal),
      thdLimit: num(h.thdLimit) ?? 8,
      status: String(h.status ?? 'normal'),
      harmonics: harmonics as { rank?: number; value?: number; status?: string }[],
    };
  }, [kpiRecord]);

  const ecBlock = useMemo(() => {
    if (!kpiRecord) return null;
    const ec = kpiRecord.energyConsumption as Record<string, unknown> | undefined;
    if (!ec || typeof ec !== 'object') return null;
    const series = Array.isArray(ec.series) ? (ec.series as PowerSeriesPoint[]) : [];
    return {
      peakKw: num(ec.peakKw),
      totalMWh: num(ec.totalMWh),
      costFcfa: num(ec.costFcfa),
      costEnergyFcfa: num(ec.costEnergyFcfa),
      costPrimeFcfa: num(ec.costPrimeFcfa),
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
      nominal: num(pb.nominal) ?? 0,
      unbalancePercent: num(pb.unbalancePercent),
      unit: typeof pb.unit === 'string' ? pb.unit : 'V',
      status: String(pb.status ?? 'normal'),
    };
  }, [kpiRecord]);

  const chartW = Math.min(Dimensions.get('window').width - 48, 400);
  const chartH = 168;

  const peakKw = ecBlock?.peakKw ?? metrics?.consoKw ?? null;
  const freqHz = freqObj?.avgHz ?? null;
  const vLn = voltObj?.vLnAvg ?? null;

  const identificationRows = [
    { label: 'Type', value: typeLabel },
    { label: 'Site / Zone', value: siteZone },
    {
      label: 'Fabricant',
      value:
        detail && typeof detail.manufacturer === 'string' && detail.manufacturer.trim()
          ? detail.manufacturer.trim()
          : '—',
    },
    {
      label: 'Modèle',
      value: detail && typeof detail.model === 'string' && detail.model.trim() ? detail.model.trim() : '—',
    },
    {
      label: 'N° de série',
      value:
        detail && typeof detail.serial_number === 'string' && detail.serial_number.trim()
          ? detail.serial_number.trim()
          : '—',
    },
    {
      label: 'Installé le',
      value:
        detail && typeof detail.installation_date === 'string' && detail.installation_date.trim()
          ? fmtDateShort(detail.installation_date)
          : '—',
    },
  ];

  if (row === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#38bdf8" />
        <Text style={[styles.muted, { marginTop: 12 }]}>Chargement…</Text>
      </View>
    );
  }

  if (row === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Équipement introuvable.</Text>
      </View>
    );
  }

  const kpiHasData = kpiRecordHasDisplayableData(kpiRecord);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#38bdf8"
          colors={['#38bdf8']}
        />
      }
    >
      {row.syncedFromDesktop ? (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyTitle}>Lecture seule</Text>
          <Text style={styles.readOnlySub}>
            Vue miroir du bureau : supervision et courbes calculées sur le PC. Aucune modification possible depuis le
            mobile.
          </Text>
        </View>
      ) : null}

      {row.syncedFromDesktop && linked && hasToken ? (
        <View style={{ marginBottom: 12 }}>
          <DesktopSyncStatusBanner
            linked
            hasKpiData={kpiHasData}
            subtitle="Cet équipement : les blocs KPI se remplissent quand le bureau les inclut dans le snapshot."
            compactSuccess={kpiHasData}
          />
        </View>
      ) : null}

      {/* Bandeau identité — aligné EquipmentDetail bureau */}
      <View style={styles.card}>
        <Text style={styles.name}>{row.name}</Text>
        {row.syncedFromDesktop ? (
          <Text style={styles.badge}>Synchronisé avec le desktop</Text>
        ) : (
          <Text style={styles.badgeLocal}>Données locales / démo</Text>
        )}
        {description ? <Text style={styles.desc}>{description}</Text> : null}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.subLine}>
              {typeLabel} · {siteZone !== '—' ? siteZone : row.site?.trim() || '—'}
            </Text>
            <Meta label="Statut fiche" value={dbStatusLabelFr(row.dbStatus)} />
            {row.syncedFromDesktop && metrics ? (
              <Meta label="Statut supervision" value={equipStatusLabelFr(metrics.status)} />
            ) : null}
            <Meta label="Alimentation" value={row.powerSource} />
            <Meta label="Criticité" value={row.criticality} />
          </View>
          {row.syncedFromDesktop && metrics?.health != null ? (
            <View style={styles.healthPill}>
              <Text style={styles.healthVal}>{metrics.health}%</Text>
              <Text style={styles.healthLbl}>Santé</Text>
            </View>
          ) : null}
        </View>
      </View>

      {row.syncedFromDesktop ? (
        <>
          {bundleLoading && !desktopBundle ? (
            <View style={styles.hintRow}>
              <ActivityIndicator size="small" color="#64748b" />
              <Text style={styles.mutedSmall}>Chargement du cache KPI local…</Text>
            </View>
          ) : null}

          {kpiRecord?.error != null ? (
            <View style={styles.syncHintCard}>
              <Text style={styles.syncHintTitle}>Calcul KPI côté bureau</Text>
              <Text style={styles.mutedSmall} selectable>
                {String(kpiRecord.error)}
              </Text>
            </View>
          ) : null}

          <CollapsibleSection
            title="Indicateurs clés"
            subtitle="Même grille que le tableau de bord équipement du bureau — touchez pour afficher ou masquer."
            defaultExpanded
            badge="KPI"
          >
            <View style={styles.kpiGrid}>
              <KpiMiniCard
                label="Facteur de puissance"
                value={pfDisp.value != null ? pfDisp.value.toFixed(3) : '—'}
                sub="Cible ≥ 0.90"
                accent={pfDisp.status === 'critical' ? '#f87171' : pfDisp.status === 'warning' ? '#fbbf24' : '#e2e8f0'}
              />
              <KpiMiniCard
                label="THD courant"
                value={harmBlock?.thdTotal != null ? `${harmBlock.thdTotal.toFixed(1)} %` : '—'}
                sub="Limite IEEE 519 : 15 %"
                accent={
                  harmBlock?.status === 'critical'
                    ? '#f87171'
                    : harmBlock?.status === 'warning'
                      ? '#fbbf24'
                      : '#e2e8f0'
                }
              />
              <KpiMiniCard
                label="Puissance de pointe"
                value={peakKw != null ? `${peakKw.toFixed(1)} kW` : '—'}
                sub={ecBlock?.periodDays != null ? `Période ~${ecBlock.periodDays} j` : undefined}
              />
              <KpiMiniCard
                label="Tension moyenne"
                value={vLn != null ? `${vLn.toFixed(0)} V` : '—'}
                sub="Cible 230 V (L-N)"
              />
              <KpiMiniCard
                label="Fréquence"
                value={freqHz != null ? `${freqHz.toFixed(2)} Hz` : '—'}
                sub="Cible 50 Hz (WAPP)"
              />
              <KpiMiniCard
                label="Dernière mesure"
                value={fmtDateTimeShort(measStats?.last_measurement)}
                sub={
                  measStats ? `${measStats.total_count.toLocaleString('fr-FR')} mesures en base` : undefined
                }
              />
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            title="Énergie & courbes"
            subtitle="Évolution de la puissance (active, réactive, apparente) et totaux synchronisés."
            badge="kW"
          >
            <View style={styles.legendRow}>
              {powerChartLegend().map((leg) => (
                <View key={leg.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: leg.color }]} />
                  <Text style={styles.legendTxt}>{leg.label}</Text>
                </View>
              ))}
            </View>
            {ecBlock && ecBlock.series.length > 0 ? (
              <View style={styles.chartBox}>
                <MobilePowerEvolutionChart width={chartW} height={chartH} series={ecBlock.series} />
              </View>
            ) : (
              <Text style={styles.mutedSmall}>
                Pas encore de points de série dans le snapshot (réduction de taille côté bureau possible). Les totaux
                ci-dessous restent envoyés quand ils sont calculables.
              </Text>
            )}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Pic journalier</Text>
                <Text style={styles.summaryValue}>
                  {ecBlock?.peakKw != null ? `${ecBlock.peakKw.toFixed(1)} kW` : '—'}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Consommation totale</Text>
                <Text style={styles.summaryValue}>
                  {ecBlock?.totalMWh != null && ecBlock.totalMWh > 0
                    ? `${ecBlock.totalMWh.toFixed(3)} MWh`
                    : '—'}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Coût estimé</Text>
                <Text style={styles.summaryValue}>
                  {ecBlock?.costFcfa != null && ecBlock.costFcfa > 0 ? formatFcfa(ecBlock.costFcfa) : '—'}
                </Text>
              </View>
            </View>
            {kpiRecord ? <Text style={styles.summaryMuted}>{consumptionSubtitleFromKpi(kpiRecord)}</Text> : null}
          </CollapsibleSection>

          <CollapsibleSection
            title="Qualité réseau"
            subtitle="Facteur de puissance détaillé et spectre harmonique (comme les cartes bureau)."
            badge="PF / THD"
          >
            <View style={styles.twoCol}>
              <View style={[styles.innerPanel, styles.half]}>
                <Text style={styles.innerTitle}>Facteur de puissance</Text>
                {pfBlock ? (
                  <>
                    <Text style={styles.pfBig}>
                      {pfBlock.value != null ? pfBlock.value.toFixed(4) : '—'}
                    </Text>
                    <Text style={styles.pfSub}>TPF moyen · objectif {pfBlock.target.toFixed(2)}</Text>
                    <Meta label="DPF (cos φ₁)" value={pfBlock.dpf != null ? pfBlock.dpf.toFixed(4) : '—'} />
                    <Meta label="Seuil min" value={pfBlock.threshold.toFixed(2)} />
                    <Meta label="Statut" value={pfKpiStatusFr(pfBlock.status)} />
                  </>
                ) : (
                  <Text style={styles.mutedSmall}>Bloc non présent dans le dernier snapshot.</Text>
                )}
              </View>
              <View style={[styles.innerPanel, styles.half]}>
                <Text style={styles.innerTitle}>Harmoniques</Text>
                {harmBlock && (harmBlock.thdTotal != null || harmBlock.harmonics.length > 0) ? (
                  <>
                    <Text style={styles.cardSubtitle}>
                      THD {harmBlock.thdTotal != null ? `${harmBlock.thdTotal.toFixed(1)} %` : '—'} · limite{' '}
                      {harmBlock.thdLimit.toFixed(1)} %
                    </Text>
                    {harmBlock.harmonics.length > 0 ? (
                      harmBlock.harmonics.map((h, idx) => {
                        const rank = typeof h.rank === 'number' ? h.rank : idx;
                        const val = num(h.value) ?? 0;
                        const maxBar = Math.max(harmBlock.thdLimit, val, 0.1);
                        const pct = Math.min(100, (val / maxBar) * 100);
                        return (
                          <View key={`h-${rank}`} style={styles.harmRow}>
                            <Text style={styles.harmRank}>H{rank}</Text>
                            <View style={styles.harmBarBg}>
                              <View style={[styles.harmBarFill, { width: `${pct}%` }]} />
                            </View>
                            <Text style={styles.harmVal}>{val.toFixed(2)} %</Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.mutedSmall}>Barres par ordre non incluses dans ce snapshot.</Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.mutedSmall}>Spectre non disponible dans le snapshot.</Text>
                )}
              </View>
            </View>
          </CollapsibleSection>

          {ecBlock && ecBlock.costFcfa != null && ecBlock.costFcfa > 0 ? (
            <CollapsibleSection title="Coût SONABEL" subtitle="Détail énergie et charges fixes (tarif E2)." badge="FCFA">
              <View style={styles.costInner}>
                <Meta label="Coût total" value={formatFcfa(ecBlock.costFcfa)} />
                {ecBlock.totalMWh != null && ecBlock.totalMWh > 0 ? (
                  <Meta label="Énergie consommée" value={`${ecBlock.totalMWh.toFixed(3)} MWh`} />
                ) : null}
                {ecBlock.periodDays != null ? (
                  <Meta label="Période" value={`${ecBlock.periodDays} jour(s)`} />
                ) : null}
                {ecBlock.costEnergyFcfa != null && ecBlock.costEnergyFcfa > 0 ? (
                  <Meta label="Part énergie" value={formatFcfa(ecBlock.costEnergyFcfa)} />
                ) : null}
                {ecBlock.costPrimeFcfa != null && ecBlock.costPrimeFcfa > 0 ? (
                  <Meta label="Charges fixes / prime" value={formatFcfa(ecBlock.costPrimeFcfa)} />
                ) : null}
                <Text style={styles.mutedTiny}>Aligné sur le calcul bureau.</Text>
              </View>
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection
            title="Équilibre triphasé"
            subtitle="Tensions par phase et déséquilibre (%)"
            badge="L1–L3"
          >
            {pbBlock ? (
              <>
                {(['L1', 'L2', 'L3'] as const).map((ph) => {
                  const val = pbBlock[ph];
                  const pct = pbBlock.nominal > 0 ? Math.min(100, Math.round((val / pbBlock.nominal) * 100)) : 50;
                  const warn = Math.abs(pct - 100) > 5;
                  return (
                    <View key={ph} style={styles.phaseRow}>
                      <Text style={styles.phaseLbl}>{ph}</Text>
                      <View style={styles.phaseBarBg}>
                        <View
                          style={[
                            styles.phaseBarFill,
                            { width: `${pct}%`, backgroundColor: warn ? '#fbbf24' : '#34d399' },
                          ]}
                        />
                      </View>
                      <Text style={styles.phaseVal}>
                        {val.toFixed(1)} {pbBlock.unit}
                      </Text>
                    </View>
                  );
                })}
                <View style={styles.imbalanceFooter}>
                  <Text style={styles.imbalanceLbl}>Déséquilibre</Text>
                  <Text
                    style={[
                      styles.imbalanceVal,
                      pbBlock.status === 'critical'
                        ? { color: '#f87171' }
                        : pbBlock.status === 'warning'
                          ? { color: '#fbbf24' }
                          : { color: '#34d399' },
                    ]}
                  >
                    {pbBlock.unbalancePercent != null ? `${pbBlock.unbalancePercent.toFixed(2)} %` : '—'}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.mutedSmall}>Pas de données de phases dans le snapshot.</Text>
            )}
          </CollapsibleSection>

          {metrics ? (
            <CollapsibleSection
              title="Synthèse supervision"
              subtitle="Conformité et rappels énergétiques — mêmes seuils que l’état des équipements bureau."
            >
              <Meta label="Conformité" value={complianceLabelFr(metrics.compliance)} />
              {kwh != null && kwh > 0 ? (
                <Meta label="Énergie active (période)" value={formatConsumptionKwh(kwh)} />
              ) : null}
              {cost != null && cost > 0 ? <Meta label="Coût estimé (rappel)" value={formatFcfa(cost)} /> : null}
              {voltObj?.vLlAvg != null ? (
                <Meta label="Tension L-L moy." value={`${voltObj.vLlAvg.toFixed(1)} V`} />
              ) : null}
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection
            title="Alertes"
            subtitle="Lecture seule — détail et acquittement sur le bureau."
          >
            <Text style={styles.mutedSmall}>
              Les alertes actives, l’historique et l’acquittement restent sur l’application desktop. Les cartes KPI et
              supervision ci-dessus reflètent déjà l’état dérivé des mesures synchronisées.
            </Text>
          </CollapsibleSection>
        </>
      ) : null}

      <CollapsibleSection title="Identification" subtitle="Type, site, fabricant, série — fiche équipement.">
        {identificationRows.map((r, i) => (
          <Meta key={`id-${i}`} label={r.label} value={r.value} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection title="Spécifications électriques" subtitle="Données nominales issues de la fiche bureau.">
        {specRows.map((r, i) => (
          <Meta key={`sp-${i}`} label={r.label} value={r.value} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection title="Données de mesure" subtitle="Volume et plage temporelle des mesures en base.">
        {row.syncedFromDesktop ? (
          measStats != null ? (
            <>
              <Meta
                label="Total mesures"
                value={measStats.total_count > 0 ? measStats.total_count.toLocaleString('fr-FR') : '0'}
              />
              <Meta label="Première mesure" value={fmtDateShort(measStats.first_measurement)} />
              <Meta label="Dernière mesure" value={fmtDateTimeShort(measStats.last_measurement)} />
            </>
          ) : bundleLoading ? (
            <Text style={styles.mutedSmall}>Chargement des statistiques…</Text>
          ) : linked && hasToken ? (
            <Text style={styles.mutedSmall}>
              Statistiques absentes du snapshot pour cet équipement. Tirez vers le bas pour resynchroniser.
            </Text>
          ) : (
            <Text style={styles.mutedSmall}>Appairez le mobile sur le bureau pour recevoir les stats.</Text>
          )
        ) : (
          <Text style={styles.mutedSmall}>Réservé aux équipements synchronisés depuis le desktop.</Text>
        )}
      </CollapsibleSection>

      {description && !row.syncedFromDesktop ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.bodyText}>{description}</Text>
        </View>
      ) : null}

      {locationR.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Localisation (détail)</Text>
          {locationR.map((r, i) => (
            <Meta key={`loc-${i}`} label={r.label} value={r.value} />
          ))}
        </View>
      ) : null}

      {otherSimple.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Informations complémentaires</Text>
          {otherSimple.map((r, i) => (
            <Meta key={`o-${i}`} label={r.label} value={r.value} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function KpiMiniCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <View style={[styles.kpiMini, accent ? { borderLeftColor: accent } : undefined]}>
      <Text style={styles.kpiMiniLabel}>{label}</Text>
      <Text style={styles.kpiMiniVal}>{value}</Text>
      {sub ? <Text style={styles.kpiMiniSub}>{sub}</Text> : null}
    </View>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaVal} selectable>
        {value?.trim() ? value : '—'}
      </Text>
    </View>
  );
}

const S = {
  bg: '#f8fafc', surface: '#ffffff', surface2: '#f1f5f9',
  border: '#e2e8f0', text: '#0f172a', textSub: '#475569', textMuted: '#94a3b8',
  blue: '#2563eb', blueSoft: '#eff6ff', green: '#059669', greenSoft: '#ecfdf5',
  amber: '#d97706', amberSoft: '#fffbeb', red: '#dc2626',
  shadow: { shadowColor: '#0f172a', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: S.bg },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: S.bg, alignItems: 'center', justifyContent: 'center' },
  muted: { color: S.textMuted },
  mutedSmall: { color: S.textMuted, fontSize: 12, lineHeight: 18 },
  mutedTiny: { color: S.textMuted, fontSize: 10, lineHeight: 14, marginTop: 8 },
  readOnlyBanner: {
    backgroundColor: S.blueSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    padding: 12,
    gap: 4,
  },
  readOnlyTitle: { color: S.blue, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  readOnlySub: { color: S.textSub, fontSize: 12, lineHeight: 18 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  syncHintCard: {
    backgroundColor: S.amberSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 12,
    gap: 6,
  },
  syncHintTitle: { color: S.amber, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: S.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: S.border,
    padding: 14,
    gap: 10,
    ...S.shadow,
  },
  cardTitle: { color: S.text, fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: S.textMuted, fontSize: 12, marginBottom: 4 },
  costCard: { borderColor: '#fde68a', backgroundColor: S.amberSoft },
  name: { color: S.text, fontSize: 21, fontWeight: '800' },
  desc: { color: S.textSub, fontSize: 13, lineHeight: 19, marginTop: 6, fontStyle: 'italic' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: S.greenSoft,
    color: S.green,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  badgeLocal: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: S.surface2,
    color: S.textMuted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 },
  headerLeft: { flex: 1, gap: 6 },
  subLine: { color: S.textSub, fontSize: 13, marginBottom: 4 },
  healthPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: S.green,
    minWidth: 72,
  },
  healthVal: { color: S.green, fontSize: 18, fontWeight: '800' },
  healthLbl: { color: S.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
  metaLabel: { color: S.textMuted, fontSize: 13, fontWeight: '600', maxWidth: '42%' },
  metaVal: { color: S.text, fontSize: 13, flex: 1, textAlign: 'right' },
  sectionTitle: { color: S.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiHint: { color: S.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 4 },
  bodyText: { color: S.textSub, fontSize: 14, lineHeight: 21 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiMini: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: S.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: S.border,
    borderLeftWidth: 3,
    borderLeftColor: S.border,
    padding: 12,
    gap: 4,
    ...S.shadow,
  },
  kpiMiniLabel: { color: S.textMuted, fontSize: 11, fontWeight: '600' },
  kpiMiniVal: { color: S.text, fontSize: 17, fontWeight: '800' },
  kpiMiniSub: { color: S.textMuted, fontSize: 10, lineHeight: 14 },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { color: S.textMuted, fontSize: 10, fontWeight: '600' },
  chartBox: {
    alignItems: 'center',
    marginVertical: 6,
    padding: 8,
    backgroundColor: S.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: S.border,
    ...S.shadow,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  summaryCell: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: S.surface2,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  summaryLabel: { color: S.textMuted, fontSize: 10, fontWeight: '600' },
  summaryValue: { color: S.text, fontSize: 13, fontWeight: '700' },
  summaryMuted: { color: S.textMuted, fontSize: 11, marginTop: 8 },
  twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  half: { flex: 1, minWidth: 160 },
  innerPanel: {
    backgroundColor: S.surface2,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: S.border,
    gap: 8,
  },
  innerTitle: { color: S.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  costInner: { gap: 8 },
  pfBig: { color: S.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pfSub: { color: S.textMuted, fontSize: 11, marginBottom: 8 },
  harmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  harmRank: { width: 28, color: S.textMuted, fontSize: 12, fontWeight: '700' },
  harmBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: S.border, overflow: 'hidden' },
  harmBarFill: { height: '100%', backgroundColor: S.blue, borderRadius: 4 },
  harmVal: { width: 48, textAlign: 'right', color: S.text, fontSize: 11, fontVariant: ['tabular-nums'] },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  phaseLbl: { width: 28, color: S.textMuted, fontSize: 12, fontWeight: '700' },
  phaseBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: S.border, overflow: 'hidden' },
  phaseBarFill: { height: '100%', borderRadius: 4 },
  phaseVal: { width: 64, textAlign: 'right', color: S.text, fontSize: 11, fontVariant: ['tabular-nums'] },
  imbalanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: S.greenSoft,
  },
  imbalanceLbl: { color: S.green, fontSize: 12, fontWeight: '600' },
  imbalanceVal: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
});

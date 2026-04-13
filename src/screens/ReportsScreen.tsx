import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { VoiceNoteBar } from '@/components/VoiceNoteBar';
import { useDesktopKpiBundle } from '@/hooks/useDesktopKpiBundle';
import { useLocalEquipments } from '@/hooks/useLocalEquipments';
import {
  consumptionSubtitleFromKpi,
  formatConsumptionKwh,
  formatFcfa,
  getConsumptionKwhFromKpi,
  getPfFromKpi,
  kpiEmptyLabel,
  kpiEmptyReason,
  kpiRecordHasDisplayableData,
} from '@/lib/desktopKpiDisplay';
import { fmtDuration } from '@/lib/reportStructurer';
import { getKpiRecordFromBundle, getStatsRawFromBundle } from '@/lib/syncBundleLookup';
import { usePairingStore } from '@/store/pairingStore';
import { listVoiceReports, deleteVoiceReport } from '@/storage/voiceReportsRepo';
import type { VoiceReport } from '@/storage/voiceReportsRepo';
import { C, statusColor } from '@/theme/colors';

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function fmtPct(v: number | null): string {
  return v != null ? `${v.toFixed(1)} %` : '--';
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '--';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(s));
  } catch { return '--'; }
}

type EquipReport = {
  id: string;
  name: string;
  site: string | null;
  hasData: boolean;
  emptyLabel: string;
  consumptionKwh: number | null;
  consumptionSubtitle: string;
  costFcfa: number | null;
  pf: number | null;
  pfStatus: 'normal' | 'warning' | 'critical';
  thdV: number | null;
  thdI: number | null;
  totalCount: number | null;
  lastMeasurement: string | null;
  period: string | null;
};

export function ReportsScreen() {
  const linked = usePairingStore((s) => s.paired?.status === 'linked');
  const deviceToken = usePairingStore((s) => s.paired?.deviceToken);
  const cloudLinked = Boolean(linked && deviceToken);

  const { data: equipments = [], isLoading: loadEq } = useLocalEquipments();
  const { data: desktopBundle, isFetching: fetchKpi, refetch } = useDesktopKpiBundle();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [voiceExpanded, setVoiceExpanded] = useState<string | null>(null);

  const {
    data: voiceReports = [],
    refetch: refetchVoice,
  } = useQuery({
    queryKey: ['voice-reports'],
    queryFn: () => listVoiceReports(),
  });

  const reports: EquipReport[] = equipments
    .filter((e) => e.syncedFromDesktop)
    .map((e) => {
      const kpisMap = desktopBundle?.kpisByEquipmentId ?? {};
      const statsMap = desktopBundle?.measurementStatsByEquipmentId ?? {};
      const kRec = getKpiRecordFromBundle(kpisMap, e.id);
      const rawStats = getStatsRawFromBundle(statsMap, e.id);
      const hasData = kpiRecordHasDisplayableData(kRec);
      const pfBundle = getPfFromKpi(kRec);
      const kwh = getConsumptionKwhFromKpi(kRec);
      const ec = kRec?.energyConsumption as Record<string, unknown> | undefined;
      const costFcfa = ec ? num(ec.costFcfa) : null;
      const harmonics = kRec?.harmonics as Record<string, unknown> | undefined;
      const thdV = num(harmonics?.thdTotal);
      const thdCurr = kRec?.thdCurrent as Record<string, unknown> | undefined;
      const thdI = num(thdCurr?.average ?? thdCurr?.thdTotal);
      let totalCount: number | null = null;
      let lastMeasurement: string | null = null;
      if (rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats)) {
        const s = rawStats as Record<string, unknown>;
        const tc = s.total_count ?? s.totalCount;
        if (typeof tc === 'number') totalCount = tc;
        const lm = s.last_measurement ?? s.lastMeasurement;
        if (typeof lm === 'string') lastMeasurement = lm;
      }
      const period = typeof kRec?.period === 'string' ? kRec.period : null;
      return {
        id: e.id, name: e.name, site: e.site ?? null, hasData,
        emptyLabel: kpiEmptyLabel(kpiEmptyReason(kRec)),
        consumptionKwh: kwh,
        consumptionSubtitle: hasData ? consumptionSubtitleFromKpi(kRec) : '',
        costFcfa, pf: pfBundle.value, pfStatus: pfBundle.status,
        thdV, thdI, totalCount, lastMeasurement, period,
      };
    });

  if (loadEq || (!desktopBundle && fetchKpi)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.blue} />
      </View>
    );
  }

  const equipmentList = equipments.map((e) => ({ id: e.id, name: e.name, site: e.site }));

  return (
    <View style={styles.rootWrap}>
      <ScrollView
        style={styles.wrap}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={fetchKpi} onRefresh={refetch} tintColor={C.blue} />}
      >
        <Text style={styles.title}>Rapports</Text>
        <Text style={styles.caption}>
          {cloudLinked
            ? `Fiches KPI par équipement · ${reports.filter((r) => r.hasData).length} / ${reports.length} avec données.`
            : 'Appairez le mobile au bureau pour consulter les rapports.'}
        </Text>

        {/* ── Notes vocales terrain ───────────────────────────────── */}
        {voiceReports.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Notes vocales terrain
              <Text style={styles.sectionCount}> ({voiceReports.length})</Text>
            </Text>
            {voiceReports.map((vr: VoiceReport) => {
              const isVExp = voiceExpanded === vr.id;
              const s = vr.structuredJson;
              const hasStructured = s.observations.length > 0 || s.anomalies.length > 0 || s.consumption.length > 0 || s.actions.length > 0;
              return (
                <View key={vr.id} style={styles.voiceCard}>
                  <TouchableOpacity
                    onPress={() => setVoiceExpanded(isVExp ? null : vr.id)}
                    activeOpacity={0.75}
                    style={styles.cardHeader}
                  >
                    <View style={[styles.voiceIcon, { backgroundColor: C.cyanSoft }]}>
                      <Ionicons name="mic" size={16} color={C.cyan} />
                    </View>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {vr.equipmentName ?? 'Note générale'}
                      </Text>
                      <Text style={styles.cardDate}>
                        {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(vr.createdAt))}
                      </Text>
                    </View>
                    <View style={styles.cardMetaRight}>
                      <View style={styles.durPill}>
                        <Text style={styles.durTxt}>{fmtDuration(vr.durationMs)}</Text>
                      </View>
                      <Ionicons name={isVExp ? 'chevron-up' : 'chevron-down'} size={14} color={C.textMuted} />
                    </View>
                  </TouchableOpacity>

                  {isVExp && (
                    <View style={styles.detail}>
                      {/* Miniatures images si présentes */}
                      {vr.imageUris && vr.imageUris.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                          {vr.imageUris.map((uri, idx) => (
                            <Image key={idx} source={{ uri }} style={styles.thumb} />
                          ))}
                        </ScrollView>
                      )}

                      {vr.transcription ? (
                        <Text style={styles.voiceTranscription}>{vr.transcription}</Text>
                      ) : null}

                      {hasStructured && (
                        <View style={styles.structuredBlock}>
                          {s.observations.length > 0 && (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.cyan }]}>Observations</Text>
                              {s.observations.map((o, i) => <Text key={i} style={styles.structItem}>• {o}</Text>)}
                            </View>
                          )}
                          {s.anomalies.length > 0 && (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.red }]}>Anomalies</Text>
                              {s.anomalies.map((o, i) => <Text key={i} style={styles.structItem}>• {o}</Text>)}
                            </View>
                          )}
                          {s.consumption.length > 0 && (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.green }]}>Énergie</Text>
                              {s.consumption.map((o, i) => <Text key={i} style={styles.structItem}>• {o}</Text>)}
                            </View>
                          )}
                          {s.actions.length > 0 && (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.amber }]}>Actions</Text>
                              {s.actions.map((o, i) => <Text key={i} style={styles.structItem}>• {o}</Text>)}
                            </View>
                          )}
                        </View>
                      )}

                      <TouchableOpacity
                        onPress={async () => {
                          await deleteVoiceReport(vr.id);
                          void refetchVoice();
                        }}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={13} color={C.red} />
                        <Text style={styles.deleteBtnText}>Supprimer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* ── Fiches KPI par équipement ───────────────────────────── */}
        {reports.length > 0 && (
          <Text style={styles.sectionTitle}>Fiches KPI équipements</Text>
        )}

        {cloudLinked && reports.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="document-text-outline" size={48} color={C.textMuted} />
            <Text style={styles.emptyTitle}>Aucun équipement synchronisé</Text>
            <Text style={styles.emptyBody}>Importez des données sur le bureau et lancez une synchronisation.</Text>
          </View>
        ) : null}

        {reports.map((r) => {
          const isExpanded = expanded === r.id;
          return (
            <View key={r.id} style={styles.card}>
              <TouchableOpacity
                onPress={() => setExpanded(isExpanded ? null : r.id)}
                activeOpacity={0.75}
                style={styles.cardHeader}
              >
                <View style={[styles.equAvatar, { backgroundColor: C.surface2 }]}>
                  <Text style={styles.equAvatarTxt}>{(r.name.charAt(0) ?? '?').toUpperCase()}</Text>
                </View>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardName} numberOfLines={1}>{r.name}</Text>
                  {r.site ? <Text style={styles.cardDate}>{r.site}</Text> : null}
                </View>
                <View style={styles.cardMetaRight}>
                  {r.hasData ? (
                    <View style={[styles.kpiPill, { backgroundColor: C.greenSoft }]}>
                      <Text style={[styles.kpiPillTxt, { color: C.green }]}>
                        {r.consumptionKwh != null ? formatConsumptionKwh(r.consumptionKwh) : 'Données'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.kpiPill, { backgroundColor: C.surface2 }]}>
                      <Text style={[styles.kpiPillTxt, { color: C.textMuted }]}>{r.emptyLabel || 'Pas de données'}</Text>
                    </View>
                  )}
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={C.textMuted} />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.detail}>
                  {r.hasData ? (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Consommation</Text>
                        <View style={styles.detailRight}>
                          <Text style={[styles.detailValue, { color: C.cyan }]}>
                            {r.consumptionKwh != null ? formatConsumptionKwh(r.consumptionKwh) : '--'}
                          </Text>
                          {r.costFcfa != null && r.costFcfa > 0 ? (
                            <Text style={styles.detailSub}>{formatFcfa(r.costFcfa)}</Text>
                          ) : null}
                          <Text style={styles.detailSub}>{r.consumptionSubtitle}</Text>
                        </View>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Facteur de puissance</Text>
                        <Text style={[styles.detailValue, { color: statusColor(r.pfStatus) }]}>
                          {r.pf != null ? r.pf.toFixed(3) : '--'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>THD tension</Text>
                        <Text style={styles.detailValue}>{fmtPct(r.thdV)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>THD courant</Text>
                        <Text style={styles.detailValue}>{fmtPct(r.thdI)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Période</Text>
                        <Text style={styles.detailValue}>{r.period ?? 'AUTO'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Mesures importées</Text>
                        <Text style={styles.detailValue}>
                          {r.totalCount != null ? new Intl.NumberFormat('fr-FR').format(r.totalCount) : '--'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Dernière mesure</Text>
                        <Text style={styles.detailValue}>{fmtDate(r.lastMeasurement)}</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.noDataTxt}>{r.emptyLabel || 'Données non disponibles.'}</Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <VoiceNoteBar
        equipments={equipmentList}
        onSaved={() => void refetchVoice()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrap: { flex: 1, backgroundColor: C.bg },
  wrap: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 100, gap: 12 },
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  caption: { color: C.textSub, fontSize: 13, lineHeight: 18 },

  sectionTitle: { color: C.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { color: C.textMuted, fontWeight: '400', textTransform: 'none' },

  // Cartes notes vocales
  voiceCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    borderLeftColor: C.cyan,
    overflow: 'hidden',
    ...C.shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  voiceIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  equAvatar: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  equAvatarTxt: { color: C.textSub, fontSize: 14, fontWeight: '800' },
  cardTitleRow: { flex: 1, gap: 2 },
  cardName: { color: C.text, fontSize: 14, fontWeight: '700' },
  cardDate: { color: C.textMuted, fontSize: 11 },
  cardMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  durPill: { backgroundColor: C.cyanSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  durTxt: { color: C.cyan, fontSize: 11, fontWeight: '700' },
  kpiPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 120 },
  kpiPillTxt: { fontSize: 11, fontWeight: '700' },

  detail: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 14,
    gap: 10,
  },
  thumbRow: { marginBottom: 6 },
  thumb: { width: 80, height: 80, borderRadius: 8, marginRight: 8, backgroundColor: C.surface2 },

  voiceTranscription: {
    color: C.textSub,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  structuredBlock: {
    backgroundColor: C.surface2,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  structSect: { gap: 4 },
  structLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  structItem: { color: C.textSub, fontSize: 13, lineHeight: 18, paddingLeft: 4 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  deleteBtnText: { color: C.red, fontSize: 12, fontWeight: '600' },

  // Cartes KPI
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...C.shadow,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailLabel: { color: C.textMuted, fontSize: 13, flex: 1 },
  detailRight: { alignItems: 'flex-end', flex: 1 },
  detailValue: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  detailSub: { color: C.textMuted, fontSize: 11, textAlign: 'right' },
  noDataTxt: { color: C.textMuted, fontSize: 13, fontStyle: 'italic' },

  emptyWrap: { alignItems: 'center', marginTop: 40, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

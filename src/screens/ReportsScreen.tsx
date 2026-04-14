import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { MaintenanceReportCharts } from '@/components/MaintenanceReportCharts';
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
import { submitReportToSupervisor, fetchMyReportStatuses } from '@/lib/reportSubmitApi';
import { fmtDuration } from '@/lib/reportStructurer';
import { getKpiRecordFromBundle, getStatsRawFromBundle } from '@/lib/syncBundleLookup';
import { useAuthStore } from '@/store/authStore';
import { usePairingStore } from '@/store/pairingStore';
import { listVoiceReports, deleteVoiceReport, updateVoiceReportSubmission } from '@/storage/voiceReportsRepo';
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
  const { width: winW } = useWindowDimensions();
  const linked       = usePairingStore((s) => s.paired?.status === 'linked');
  const deviceToken  = usePairingStore((s) => s.paired?.deviceToken);
  const syncEndpoint = usePairingStore((s) => s.paired?.cloudApiBase);
  const cloudLinked  = Boolean(linked && deviceToken && syncEndpoint);

  // Infos technicien connecté (pour l'en-tête du rapport soumis)
  const session       = useAuthStore((s) => s.session);
  const technicianInfo = {
    name:   session?.user.fullName ?? 'Technicien',
    email:  session?.user.email   ?? '',
    userId: session?.user.id      ?? '',
  };

  const { data: equipments = [], isLoading: loadEq } = useLocalEquipments();
  const { data: desktopBundle, isFetching: fetchKpi, refetch } = useDesktopKpiBundle();

  const [expanded, setExpanded]         = useState<string | null>(null);
  const [voiceExpanded, setVoiceExpanded] = useState<string | null>(null);
  const [submittingId, setSubmittingId]   = useState<string | null>(null);

  const {
    data: voiceReports = [],
    refetch: refetchVoice,
  } = useQuery({
    queryKey: ['voice-reports'],
    queryFn:  () => listVoiceReports(),
  });

  // Polling des statuts de revue — tourne quand l'écran est visible, toutes les 30 s
  const isPollingRef = useRef(false);
  const checkReviewStatuses = useCallback(async (showAlert = false) => {
    if (!cloudLinked || !deviceToken || !syncEndpoint || isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const statuses = await fetchMyReportStatuses(syncEndpoint, deviceToken);
      const currentReports = await listVoiceReports();
      const changed: { name: string; status: 'accepted' | 'rejected'; note: string | null }[] = [];

      for (const s of statuses) {
        if (!s.localReportId) continue;
        const local = currentReports.find((r) => r.id === s.localReportId);
        // Détecter un changement de statut (pending → accepted/rejected)
        if ((s.status === 'accepted' || s.status === 'rejected') && local && local.reviewStatus !== s.status) {
          await updateVoiceReportSubmission(s.localReportId, {
            reviewStatus: s.status,
            reviewNote:   s.reviewNote,
          });
          changed.push({
            name:   local.equipmentName ?? 'Note vocale',
            status: s.status,
            note:   s.reviewNote,
          });
        }
      }

      if (changed.length > 0) {
        void refetchVoice();
        // Notification pour chaque rapport dont le statut a changé
        for (const c of changed) {
          const titre  = c.status === 'accepted' ? '✅ Rapport approuvé' : '❌ Rapport refusé';
          const detail = c.status === 'rejected' && c.note
            ? `Motif : ${c.note}`
            : c.status === 'accepted'
              ? 'Le superviseur a validé votre rapport.'
              : 'Le superviseur a refusé votre rapport.';
          Alert.alert(titre, `${c.name}\n\n${detail}`);
        }
      } else if (showAlert) {
        void refetchVoice();
      }
    } catch { /* non bloquant */ }
    finally { isPollingRef.current = false; }
  }, [cloudLinked, deviceToken, syncEndpoint, refetchVoice]);

  // Poll immédiat + toutes les 30 s quand l'écran est au premier plan
  useFocusEffect(
    useCallback(() => {
      if (!cloudLinked) return;
      void checkReviewStatuses(true);
      const id = setInterval(() => void checkReviewStatuses(false), 30_000);
      return () => clearInterval(id);
    }, [cloudLinked, checkReviewStatuses]),
  );

  const handleSubmitReport = useCallback(async (vr: VoiceReport) => {
    if (!cloudLinked || !deviceToken || !syncEndpoint) {
      Alert.alert('Non appairé', 'Appairez l\'application avec le bureau avant d\'envoyer un rapport.');
      return;
    }
    if (submittingId) return;

    setSubmittingId(vr.id);
    try {
      const result = await submitReportToSupervisor(syncEndpoint, deviceToken, vr, technicianInfo);
      if (result.success && result.cloudReportId) {
        await updateVoiceReportSubmission(vr.id, {
          cloudReportId: result.cloudReportId,
          submittedAt:   new Date().toISOString(),
          reviewStatus:  'pending',
        });
        await refetchVoice();
        Alert.alert('Rapport envoyé ✓', 'Le superviseur a été notifié. Vous serez informé de sa décision ici.');
      } else if (result.duplicate) {
        Alert.alert('Déjà soumis', 'Ce rapport a déjà été envoyé au superviseur.');
      } else {
        Alert.alert('Erreur', result.error ?? 'Impossible d\'envoyer le rapport.');
      }
    } finally {
      setSubmittingId(null);
    }
  }, [cloudLinked, deviceToken, syncEndpoint, submittingId, technicianInfo, refetchVoice]);

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
        <Text style={styles.fabScreenHint}>
          Note vocale terrain : microphone flottant en bas à droite — touchez pour enregistrer, puis l’icône document pour structurer et sauvegarder.
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
              const sec = s._sections;
              const hasSections = Boolean(
                sec &&
                  (sec.objet.length > 0 ||
                    sec.constats.length > 0 ||
                    sec.mesures.length > 0 ||
                    sec.travaux.length > 0 ||
                    sec.recommandations.length > 0)
              );
              const hasStructured =
                Boolean(s.charts?.length) ||
                hasSections ||
                s.observations.length > 0 ||
                s.anomalies.length > 0 ||
                s.consumption.length > 0 ||
                s.actions.length > 0;
              const extraN = vr.extraAudioUris?.length ?? 0;
              return (
                <View key={vr.id} style={styles.voiceCard}>
                  <TouchableOpacity
                    onPress={() => setVoiceExpanded(isVExp ? null : vr.id)}
                    activeOpacity={0.75}
                    style={styles.cardHeader}
                  >
                    <View style={[styles.voiceIcon, { backgroundColor: C.cyanSoft }]}>
                      <Ionicons name="mic" size={20} color={C.cyan} />
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
                      {vr.reviewStatus === 'accepted' ? (
                        <View style={[styles.reviewBadge, { backgroundColor: '#d1fae5' }]}>
                          <Ionicons name="checkmark-circle" size={13} color={C.green} />
                          <Text style={[styles.reviewBadgeTxt, { color: C.green }]}>Approuvé</Text>
                        </View>
                      ) : vr.reviewStatus === 'rejected' ? (
                        <View style={[styles.reviewBadge, { backgroundColor: '#fee2e2' }]}>
                          <Ionicons name="close-circle" size={13} color={C.red} />
                          <Text style={[styles.reviewBadgeTxt, { color: C.red }]}>Rejeté</Text>
                        </View>
                      ) : vr.reviewStatus === 'pending' ? (
                        <View style={[styles.reviewBadge, { backgroundColor: '#fef3c7' }]}>
                          <Ionicons name="time-outline" size={13} color="#d97706" />
                          <Text style={[styles.reviewBadgeTxt, { color: '#d97706' }]}>En attente</Text>
                        </View>
                      ) : null}
                      <Ionicons name={isVExp ? 'chevron-up' : 'chevron-down'} size={20} color={C.textSub} />
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

                      {extraN > 0 ? (
                        <Text style={styles.extraAudioNote}>
                          {extraN} piste{extraN > 1 ? 's' : ''} audio complémentaire{extraN > 1 ? 's' : ''} (fichiers locaux).
                        </Text>
                      ) : null}

                      {hasStructured && (
                        <View style={styles.structuredBlock}>
                          {sec && sec.objet.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.blue }]}>I. Objet</Text>
                              {sec.objet.map((o, i) => (
                                <Text key={`o-${i}`} style={styles.structItem}>• {o}</Text>
                              ))}
                            </View>
                          ) : null}
                          {sec && sec.constats.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.cyan }]}>II. Constatations</Text>
                              {sec.constats.map((o, i) => (
                                <Text key={`c-${i}`} style={styles.structItem}>• {o}</Text>
                              ))}
                            </View>
                          ) : null}
                          {s.anomalies.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.red }]}>III. Anomalies</Text>
                              {s.anomalies.map((o, i) => (
                                <Text key={`a-${i}`} style={styles.structItem}>• {o}</Text>
                              ))}
                            </View>
                          ) : null}
                          {sec && sec.mesures.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.green }]}>IV. Mesures</Text>
                              {sec.mesures.map((o, i) => (
                                <Text key={`m-${i}`} style={styles.structItem}>• {o}</Text>
                              ))}
                            </View>
                          ) : null}
                          {sec && sec.travaux.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.purple }]}>V. Travaux</Text>
                              {sec.travaux.map((o, i) => (
                                <Text key={`t-${i}`} style={styles.structItem}>• {o}</Text>
                              ))}
                            </View>
                          ) : null}
                          {sec && sec.recommandations.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.amber }]}>VI. Recommandations</Text>
                              {sec.recommandations.map((o, i) => (
                                <Text key={`r-${i}`} style={styles.structItem}>• {o}</Text>
                              ))}
                            </View>
                          ) : null}
                          {!sec && s.observations.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.cyan }]}>Observations</Text>
                              {s.observations.map((o, i) => <Text key={i} style={styles.structItem}>• {o}</Text>)}
                            </View>
                          ) : null}
                          {!sec && s.consumption.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.green }]}>Énergie / mesures</Text>
                              {s.consumption.map((o, i) => <Text key={i} style={styles.structItem}>• {o}</Text>)}
                            </View>
                          ) : null}
                          {!sec && s.actions.length > 0 ? (
                            <View style={styles.structSect}>
                              <Text style={[styles.structLabel, { color: C.amber }]}>Actions</Text>
                              {s.actions.map((o, i) => <Text key={i} style={styles.structItem}>• {o}</Text>)}
                            </View>
                          ) : null}
                          {s.charts && s.charts.length > 0 ? (
                            <MaintenanceReportCharts charts={s.charts} width={Math.min(winW - 56, 520)} />
                          ) : null}
                        </View>
                      )}

                      {/* ── Revue superviseur ── */}
                      {vr.reviewStatus === 'rejected' && vr.reviewNote ? (
                        <View style={styles.reviewNoteBox}>
                          <Ionicons name="alert-circle-outline" size={14} color={C.red} />
                          <Text style={styles.reviewNoteText}>
                            <Text style={{ fontWeight: '700' }}>Motif de refus : </Text>
                            {vr.reviewNote}
                          </Text>
                        </View>
                      ) : vr.reviewStatus === 'accepted' ? (
                        <View style={[styles.reviewNoteBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                          <Ionicons name="checkmark-circle-outline" size={14} color={C.green} />
                          <Text style={[styles.reviewNoteText, { color: C.green }]}>Rapport approuvé par le superviseur.</Text>
                        </View>
                      ) : null}

                      {/* ── Bouton d'envoi au superviseur ── */}
                      <View style={styles.actionRow}>
                        {!vr.submittedAt ? (
                          <TouchableOpacity
                            onPress={() => void handleSubmitReport(vr)}
                            disabled={submittingId === vr.id || !cloudLinked || vr.status !== 'saved'}
                            style={[
                              styles.submitBtn,
                              (!cloudLinked || vr.status !== 'saved' || submittingId === vr.id) && styles.submitBtnDisabled,
                            ]}
                          >
                            <Ionicons name="send-outline" size={13} color="#fff" />
                            <Text style={styles.submitBtnText}>
                              {submittingId === vr.id
                                ? 'Envoi…'
                                : vr.status !== 'saved'
                                  ? 'Finalisez d\'abord le rapport'
                                  : !cloudLinked
                                    ? 'Appairage requis'
                                    : 'Envoyer au superviseur'}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.submittedInfo}>
                            <Ionicons name="cloud-done-outline" size={13} color={C.textMuted} />
                            <Text style={styles.submittedInfoText}>
                              Soumis le {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(vr.submittedAt))}
                            </Text>
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
                    <View style={[styles.kpiPill, { backgroundColor: C.greenSoft, borderColor: '#a7f3d0' }]}>
                      <Text style={[styles.kpiPillTxt, { color: C.green }]}>
                        {r.consumptionKwh != null ? formatConsumptionKwh(r.consumptionKwh) : 'Données'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.kpiPill, { backgroundColor: C.surface2 }]}>
                      <Text style={[styles.kpiPillTxt, { color: C.textMuted }]}>{r.emptyLabel || 'Pas de données'}</Text>
                    </View>
                  )}
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={C.textSub} />
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
  content: { padding: 16, paddingBottom: 112, gap: 16 },
  center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  caption: { color: C.textSub, fontSize: 13, lineHeight: 18 },
  fabScreenHint: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
    marginBottom: 4,
  },

  sectionTitle: {
    color: C.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 2,
  },
  sectionCount: { color: C.textMuted, fontWeight: '600', textTransform: 'none', letterSpacing: 0 },

  // Cartes notes vocales
  voiceCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: C.cyan,
    overflow: 'hidden',
    ...C.shadowCard,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#fafbfc',
  },
  voiceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  equAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  equAvatarTxt: { color: C.textSub, fontSize: 16, fontWeight: '800' },
  cardTitleRow: { flex: 1, gap: 2 },
  cardName: { color: C.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  cardDate: { color: C.textMuted, fontSize: 12, fontWeight: '500' },
  cardMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  durPill: {
    backgroundColor: C.cyanSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  durTxt: { color: C.cyan, fontSize: 12, fontWeight: '800' },
  kpiPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 140, borderWidth: 1, borderColor: C.border },
  kpiPillTxt: { fontSize: 12, fontWeight: '800' },

  detail: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: 16,
    gap: 12,
    backgroundColor: C.surface,
  },
  thumbRow: { marginBottom: 6 },
  thumb: { width: 88, height: 88, borderRadius: 12, marginRight: 10, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },

  voiceTranscription: {
    color: C.textSub,
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
    backgroundColor: C.blueSoft,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  extraAudioNote: { color: C.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' },
  structuredBlock: {
    backgroundColor: C.surface2,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  structSect: { gap: 6 },
  structLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  structItem: { color: C.textSub, fontSize: 14, lineHeight: 20, paddingLeft: 2 },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reviewBadgeTxt: { fontSize: 11, fontWeight: '700' },
  reviewNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#fff1f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
  },
  reviewNoteText: { color: C.red, fontSize: 13, lineHeight: 18, flex: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.blue,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  submitBtnDisabled: { backgroundColor: C.textMuted, opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  submittedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  submittedInfoText: { color: C.textMuted, fontSize: 12, fontStyle: 'italic' },
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...C.shadowCard,
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

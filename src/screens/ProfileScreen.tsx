/**
 * ProfileScreen — Profil utilisateur + fiche de performance
 *
 * Sections :
 *  - En-tête  : avatar, nom complet, rôle, email, identifiant court
 *  - KPI      : total rapports, semaine, mois, équipements couverts
 *  - Graphique: activité hebdomadaire (barres SVG)
 *  - Rapports : liste des 10 derniers rapports locaux
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { C } from '@/theme/colors';
import { useAuthStore } from '@/store/authStore';
import { listVoiceReports, type VoiceReport } from '@/storage/voiceReportsRepo';
import type { UserRole } from '@/lib/authApi';

// ── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin:    'Administrateur',
  manager:  'Superviseur',
  operator: 'Technicien',
  viewer:   'Lecteur',
};

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  admin:    { bg: '#fef2f2', text: '#dc2626' },
  manager:  { bg: '#fffbeb', text: '#d97706' },
  operator: { bg: '#eff6ff', text: '#2563eb' },
  viewer:   { bg: '#f8fafc', text: '#475569' },
};

type Period = '7d' | '30d' | 'all';

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBefore(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoWeek(dateStr: string): string {
  const d  = new Date(dateStr);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-S${String(week).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── Composant graphique en barres (SVG) ──────────────────────────────────────

function WeeklyBarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return null;

  const WIDTH    = 320;
  const HEIGHT   = 120;
  const PADX     = 8;
  const PADY     = 24;
  const maxVal   = Math.max(...data.map((d) => d.value), 1);
  const barW     = Math.max(6, Math.floor((WIDTH - PADX * 2) / data.length) - 4);
  const gap      = Math.floor((WIDTH - PADX * 2 - barW * data.length) / Math.max(data.length - 1, 1));
  const chartH   = HEIGHT - PADY;

  return (
    <Svg width={WIDTH} height={HEIGHT} style={{ alignSelf: 'center' }}>
      {data.map((d, i) => {
        const barH = Math.max(4, Math.round((d.value / maxVal) * chartH));
        const x    = PADX + i * (barW + gap);
        const y    = HEIGHT - PADY - barH;
        return (
          <Svg key={d.label}>
            <Rect
              x={x} y={y} width={barW} height={barH}
              rx={3} fill={C.blue} opacity={0.85}
            />
            <SvgText
              x={x + barW / 2} y={HEIGHT - 6}
              textAnchor="middle" fontSize={8} fill={C.textMuted}
            >
              {d.label.replace(/^\d{4}-/, 'S')}
            </SvgText>
            {d.value > 0 && (
              <SvgText
                x={x + barW / 2} y={y - 3}
                textAnchor="middle" fontSize={9} fill={C.blue} fontWeight="700"
              >
                {d.value}
              </SvgText>
            )}
          </Svg>
        );
      })}
    </Svg>
  );
}

// ── Composant carte KPI ──────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color, bg }: {
  label: string; value: string | number;
  icon: keyof typeof Ionicons.glyphMap; color: string; bg: string;
}) {
  return (
    <View style={[styles.kpiCard, { backgroundColor: bg }]}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

// ── Écran principal ──────────────────────────────────────────────────────────

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const session    = useAuthStore((s) => s.session);
  const user       = session?.user;
  const role       = (user?.role ?? 'viewer') as UserRole;
  const roleStyle  = ROLE_COLORS[role];

  const [reports, setReports]     = useState<VoiceReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod]       = useState<Period>('30d');

  const loadReports = useCallback(async () => {
    try {
      const all = await listVoiceReports();
      setReports(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      /* ignoré */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadReports(); }, [loadReports]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadReports();
  };

  // Filtrage selon la période sélectionnée
  const cutoff = useMemo(() => {
    if (period === 'all') return new Date(0);
    return daysBefore(period === '7d' ? 7 : 30);
  }, [period]);

  const filtered = useMemo(
    () => reports.filter((r) => new Date(r.createdAt) >= cutoff),
    [reports, cutoff],
  );

  // KPI dérivés
  const totalAll      = reports.length;
  const totalPeriod   = filtered.length;
  const thisWeek      = useMemo(() => reports.filter((r) => new Date(r.createdAt) >= daysBefore(7)).length, [reports]);
  const thisMonth     = useMemo(() => reports.filter((r) => new Date(r.createdAt) >= daysBefore(30)).length, [reports]);
  const uniqueEquip   = useMemo(() => new Set(filtered.map((r) => r.equipmentId ?? r.equipmentName).filter(Boolean)).size, [filtered]);
  const avgDuration   = useMemo(() => {
    const withDur = filtered.filter((r) => r.durationMs > 0);
    if (withDur.length === 0) return '—';
    const avg = withDur.reduce((s, r) => s + r.durationMs, 0) / withDur.length / 1000;
    return `${Math.round(avg)} s`;
  }, [filtered]);

  // Données graphique hebdomadaire (6 dernières semaines)
  const weeklyData = useMemo(() => {
    const sixWeeksAgo = daysBefore(42);
    const map = new Map<string, number>();
    for (const r of reports) {
      if (new Date(r.createdAt) < sixWeeksAgo) continue;
      const w = isoWeek(r.createdAt);
      map.set(w, (map.get(w) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, value]) => ({ label, value }));
  }, [reports]);

  const recentReports = reports.slice(0, 10);

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── En-tête profil ─────────────────────────────────────────── */}
      <View style={styles.profileCard}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: roleStyle.text }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Infos */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user.fullName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
            <Text style={[styles.roleBadgeText, { color: roleStyle.text }]}>
              {ROLE_LABELS[role]}
            </Text>
          </View>
          {user.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={13} color={C.textMuted} />
              <Text style={styles.infoText}>{user.email}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={13} color={C.textMuted} />
            <Text style={styles.infoText}>{user.username}</Text>
          </View>
        </View>

        {/* Lien paramètres */}
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          style={({ pressed }) => [styles.settingsBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Ionicons name="settings-outline" size={20} color={C.textMuted} />
        </Pressable>
      </View>

      {/* ── Sélecteur de période ───────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ma performance</Text>
        <View style={styles.periodRow}>
          {(['7d', '30d', 'all'] as Period[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={({ pressed }) => [
                styles.periodChip,
                period === p && styles.periodChipActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.periodChipText, period === p && styles.periodChipTextActive]}>
                {p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : 'Tout'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={C.blue} style={{ marginVertical: 24 }} />
      ) : (
        <>
          {/* ── KPI ───────────────────────────────────────────────── */}
          <View style={styles.kpiGrid}>
            <KpiCard
              label={period === '7d' ? 'Cette semaine' : period === '30d' ? 'Ce mois' : 'Total'}
              value={totalPeriod}
              icon="document-text-outline"
              color={C.blue} bg={C.blueSoft}
            />
            <KpiCard
              label="Équipements"
              value={uniqueEquip}
              icon="flash-outline"
              color={C.green} bg={C.greenSoft}
            />
            <KpiCard
              label="Cette semaine"
              value={thisWeek}
              icon="calendar-outline"
              color="#8b5cf6" bg="#f5f3ff"
            />
            <KpiCard
              label="Durée moy."
              value={avgDuration}
              icon="time-outline"
              color={C.amber} bg={C.amberSoft}
            />
          </View>

          {/* ── Graphique activité hebdomadaire ────────────────────── */}
          {weeklyData.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Activité par semaine (6 sem.)</Text>
              <WeeklyBarChart data={weeklyData} />
            </View>
          )}

          {/* ── Couverture équipements ────────────────────────────── */}
          {filtered.length > 0 && (() => {
            const equipMap = new Map<string, number>();
            for (const r of filtered) {
              const name = r.equipmentName ?? 'Non précisé';
              equipMap.set(name, (equipMap.get(name) ?? 0) + 1);
            }
            const items = Array.from(equipMap.entries())
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5);
            const max = Math.max(...items.map(([, v]) => v), 1);

            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Équipements inspectés</Text>
                <View style={styles.card}>
                  {items.map(([name, count]) => (
                    <View key={name} style={styles.equipRow}>
                      <Text style={styles.equipName} numberOfLines={1}>{name}</Text>
                      <View style={styles.equipBarTrack}>
                        <View style={[styles.equipBar, { width: `${Math.round(count / max * 100)}%` as any }]} />
                      </View>
                      <Text style={styles.equipCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}

          {/* ── Derniers rapports ─────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Derniers rapports</Text>
            {recentReports.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-outline" size={32} color={C.textMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyText}>Aucun rapport enregistré.</Text>
                <Text style={styles.emptyHint}>Créez votre premier rapport depuis l'onglet Rapports.</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {recentReports.map((r, idx) => (
                  <View
                    key={r.id}
                    style={[styles.reportRow, idx < recentReports.length - 1 && styles.reportRowBorder]}
                  >
                    <View style={styles.reportIcon}>
                      <Ionicons name="mic-outline" size={14} color={C.blue} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.reportEquip} numberOfLines={1}>
                        {r.equipmentName ?? 'Équipement non précisé'}
                      </Text>
                      <Text style={styles.reportDate}>{fmtDate(r.createdAt)}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: r.status === 'saved' ? C.greenSoft : C.surface2 },
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: r.status === 'saved' ? C.green : C.textMuted },
                      ]}>
                        {r.status === 'saved' ? 'Soumis' : 'Brouillon'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Statistiques globales ─────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vue d'ensemble</Text>
            <View style={styles.statsRow}>
              {[
                { label: 'Total rapports',     value: totalAll },
                { label: '7 derniers jours',   value: thisWeek },
                { label: '30 derniers jours',  value: thisMonth },
              ].map((s) => (
                <View key={s.label} style={styles.statBox}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: C.bg },
  content:  { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },

  // Profil
  profileCard: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           14,
    backgroundColor: C.surface,
    borderRadius:  16,
    padding:       16,
    borderWidth:   1,
    borderColor:   C.border,
    marginBottom:  16,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:    { color: '#fff', fontWeight: '800', fontSize: 20 },
  profileInfo:   { flex: 1, gap: 4 },
  profileName:   { color: C.text, fontWeight: '800', fontSize: 16 },
  roleBadge:     { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  infoText:      { color: C.textMuted, fontSize: 12 },
  settingsBtn:   { padding: 4 },

  // Sections
  section:      { marginBottom: 16 },
  sectionTitle: { color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 10 },

  // Période
  periodRow:          { flexDirection: 'row', gap: 8 },
  periodChip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  periodChipActive:   { borderColor: C.blue, backgroundColor: C.blueSoft },
  periodChipText:     { color: C.textMuted, fontWeight: '600', fontSize: 12 },
  periodChipTextActive: { color: C.blue },

  // KPI grid
  kpiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16,
  },
  kpiCard: {
    flex: 1, minWidth: '45%', borderRadius: 14,
    padding: 14, alignItems: 'flex-start', gap: 6,
    borderWidth: 1, borderColor: C.border,
  },
  kpiIcon:  { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 24, fontWeight: '800' },
  kpiLabel: { color: C.textMuted, fontSize: 11, fontWeight: '600' },

  // Graphique
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 16, alignItems: 'center',
  },
  chartTitle: { color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 12, alignSelf: 'flex-start' },

  // Carte générique
  card: {
    backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },

  // Équipements
  equipRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  equipName:     { color: C.text, fontWeight: '600', fontSize: 12, width: 110 },
  equipBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.surface2, overflow: 'hidden' },
  equipBar:      { height: '100%', borderRadius: 3, backgroundColor: C.blue },
  equipCount:    { color: C.blue, fontWeight: '700', fontSize: 12, width: 22, textAlign: 'right' },

  // Rapports
  reportRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  reportRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  reportIcon:      { width: 28, height: 28, borderRadius: 8, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  reportEquip:     { color: C.text, fontWeight: '600', fontSize: 13 },
  reportDate:      { color: C.textMuted, fontSize: 11, marginTop: 1 },
  statusBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText:      { fontSize: 10, fontWeight: '700' },

  // Stats globales
  statsRow:   { flexDirection: 'row', gap: 10 },
  statBox:    { flex: 1, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, alignItems: 'center', gap: 4 },
  statValue:  { color: C.blue, fontWeight: '800', fontSize: 22 },
  statLabel:  { color: C.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Vide
  emptyCard: { backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 32, alignItems: 'center' },
  emptyText: { color: C.textMuted, fontWeight: '600', fontSize: 14 },
  emptyHint: { color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 },
});

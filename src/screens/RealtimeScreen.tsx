/**
 * RealtimeScreen — Monitoring temps réel des capteurs SEMAFO MANA
 *
 * Le desktop MQTT pousse un snapshot toutes les 3 s vers le sync-service.
 * Ce écran poll ce snapshot et affiche les valeurs capteurs en direct.
 *
 * Vues :
 *  - Par famille (puissance, température, pression…)
 *  - Par équipement (filtre sur les capteurs mappés)
 *  - Alarmes actives — bandeau rouge en haut
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMobileRealtime, type SensorReading } from '@/hooks/useMobileRealtime';
import { usePairingStore } from '@/store/pairingStore';
import { C } from '@/theme/colors';

// ── Couleurs famille ──────────────────────────────────────────────────────────

const FAMILLE_COLORS: Record<string, string> = {
  puissance:     '#f59e0b',
  temperature:   '#f97316',
  pression:      '#3b82f6',
  debit:         '#06b6d4',
  densite:       '#6366f1',
  granulometrie: '#8b5cf6',
  niveau:        '#14b8a6',
  qualite:       '#22c55e',
  vibration:     '#ef4444',
  vitesse:       '#ec4899',
  gaz_securite:  '#f43f5e',
  fuite:         '#dc2626',
  thermique:     '#d97706',
};

const FAMILLE_LABELS: Record<string, string> = {
  puissance:     'Puissance',
  temperature:   'Température',
  pression:      'Pression',
  debit:         'Débit',
  densite:       'Densité',
  granulometrie: 'Granulométrie',
  niveau:        'Niveau',
  qualite:       'Qualité',
  vibration:     'Vibration',
  vitesse:       'Vitesse',
  gaz_securite:  'Gaz / Sécurité',
  fuite:         'Fuite',
  thermique:     'Thermique',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(v: number, unite: string): string {
  if (unite === 'bool') return v >= 0.5 ? 'ACTIF' : 'OK';
  if (v >= 1000) return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  if (v >= 100)  return v.toFixed(1);
  if (v >= 1)    return v.toFixed(2);
  return v.toFixed(4);
}

function ageLabel(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  if (ms < 5000)   return 'À l\'instant';
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}min`;
}

// ── Composant carte capteur ───────────────────────────────────────────────────

function SensorCard({ reading, color }: { reading: SensorReading; color: string }) {
  const hasAlarm  = reading.alarmes && Object.keys(reading.alarmes).length > 0;
  const isBool    = reading.unite === 'bool';
  const boolOn    = isBool && reading.valeur >= 0.5;

  return (
    <View style={[styles.sensorCard, { borderLeftColor: color }, hasAlarm && styles.sensorCardAlarm]}>
      {/* Tag + description */}
      <View style={styles.sensorHeader}>
        <View style={styles.sensorTagRow}>
          {hasAlarm && (
            <Ionicons name="alert-circle" size={12} color={C.red} style={{ marginRight: 4 }} />
          )}
          <Text style={styles.sensorTag} numberOfLines={1}>{reading.tag}</Text>
          {reading.sil > 0 && (
            <View style={styles.silBadge}>
              <Text style={styles.silTxt}>SIL{reading.sil}</Text>
            </View>
          )}
        </View>
        <View style={styles.agePill}>
          <View style={[styles.ageDot, { backgroundColor: hasAlarm ? C.red : C.green }]} />
          <Text style={styles.ageTxt}>{ageLabel(reading.timestamp)}</Text>
        </View>
      </View>
      <Text style={styles.sensorDesc} numberOfLines={1}>{reading.description}</Text>

      {/* Valeur */}
      <View style={styles.sensorValueRow}>
        <Text style={[
          styles.sensorValue,
          hasAlarm && { color: C.red },
          boolOn && { color: C.red },
          isBool && !boolOn && { color: C.green },
        ]}>
          {formatValue(reading.valeur, reading.unite)}
        </Text>
        {!isBool && (
          <Text style={styles.sensorUnit}>{reading.unite}</Text>
        )}
        <Text style={styles.sensorQuality}>Q:{reading.qualite}%</Text>
      </View>

      {/* Alarme */}
      {hasAlarm && reading.alarmes && (
        <View style={styles.alarmDetail}>
          <Text style={styles.alarmDetailTxt} numberOfLines={2}>
            {Object.values(reading.alarmes).join(' · ')}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Groupe famille ────────────────────────────────────────────────────────────

function FamilleGroup({
  famille,
  readings,
}: {
  famille: string;
  readings: SensorReading[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const color = FAMILLE_COLORS[famille] ?? C.blue;
  const label = FAMILLE_LABELS[famille] ?? famille;
  const hasAlarms = readings.some((r) => r.alarmes && Object.keys(r.alarmes).length > 0);

  return (
    <View style={styles.familleGroup}>
      <Pressable
        onPress={() => setCollapsed(!collapsed)}
        style={({ pressed }) => [styles.familleHeader, pressed && { opacity: 0.8 }]}
      >
        <View style={[styles.familleDot, { backgroundColor: color }]} />
        <Text style={styles.familleLabel}>{label}</Text>
        {hasAlarms && (
          <View style={styles.alarmBadge}>
            <Ionicons name="alert-circle" size={11} color={C.red} />
          </View>
        )}
        <View style={styles.familleBadge}>
          <Text style={styles.familleBadgeTxt}>{readings.length}</Text>
        </View>
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={C.textMuted}
        />
      </Pressable>

      {!collapsed && (
        <View style={styles.sensorGrid}>
          {readings.map((r) => (
            <SensorCard key={r.tag} reading={r} color={color} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Écran principal ───────────────────────────────────────────────────────────

type ViewMode = 'famille' | 'all';

export function RealtimeScreen() {
  const linked       = usePairingStore((s) => s.paired?.status === 'linked');
  const [viewMode, setViewMode] = useState<ViewMode>('famille');
  const [forceRefresh, setForceRefresh] = useState(0);

  const rt = useMobileRealtime();

  // Forcer un re-poll quand l'écran redevient visible
  useFocusEffect(
    useCallback(() => {
      setForceRefresh((n) => n + 1);
    }, []),
  );

  // Toutes les lectures comme tableau trié par famille
  const allReadings = useMemo(
    () => Array.from(rt.readings.values()).sort((a, b) => a.famille.localeCompare(b.famille)),
    [rt.readings],
  );

  // Groupé par famille
  const byFamille = useMemo(() => {
    const map = new Map<string, SensorReading[]>();
    for (const r of allReadings) {
      const arr = map.get(r.famille) ?? [];
      arr.push(r);
      map.set(r.famille, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allReadings]);

  // ── Non appairé ──────────────────────────────────────────────────────────
  if (!linked) {
    return (
      <View style={styles.center}>
        <Ionicons name="link-outline" size={52} color={C.textMuted} />
        <Text style={styles.emptyTitle}>Non appairé</Text>
        <Text style={styles.emptyBody}>
          Appairez le mobile au bureau pour accéder aux données temps réel.
        </Text>
      </View>
    );
  }

  // ── Chargement initial ───────────────────────────────────────────────────
  if (!rt.updatedAt && !rt.error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.blue} size="large" />
        <Text style={[styles.emptyBody, { marginTop: 12 }]}>Connexion au flux temps réel…</Text>
      </View>
    );
  }

  const totalSensors = rt.readings.size;
  const alarmCount   = rt.alarms.length;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => setForceRefresh((n) => n + 1)}
          tintColor={C.blue}
        />
      }
    >
      {/* ── Statut connexion ─────────────────────────────────────────── */}
      <View style={[styles.statusBar, rt.isLive ? styles.statusBarLive : styles.statusBarOff]}>
        <View style={[styles.statusDot, { backgroundColor: rt.isLive ? C.green : C.amber }]} />
        <Text style={[styles.statusTxt, { color: rt.isLive ? C.green : C.amber }]}>
          {rt.isLive
            ? `En direct · ${totalSensors} capteur${totalSensors > 1 ? 's' : ''} · ${rt.msgCount} msg/cycle`
            : `Hors ligne — dernier snapshot ${rt.updatedAt
                ? `il y a ${Math.round(rt.snapshotAgeMs / 1000)}s`
                : 'inconnu'}`}
        </Text>
        {rt.error && (
          <Ionicons name="warning-outline" size={14} color={C.amber} style={{ marginLeft: 4 }} />
        )}
      </View>

      {/* ── Alarmes actives ──────────────────────────────────────────── */}
      {alarmCount > 0 && (
        <View style={styles.alarmsSection}>
          <View style={styles.alarmsSectionHeader}>
            <Ionicons name="alert-circle" size={16} color={C.red} />
            <Text style={styles.alarmsSectionTitle}>
              {alarmCount} alarme{alarmCount > 1 ? 's' : ''} active{alarmCount > 1 ? 's' : ''}
            </Text>
          </View>
          {rt.alarms.map((a) => (
            <View key={a.tag} style={styles.alarmRow}>
              <Ionicons name="alert-circle-outline" size={14} color={C.red} />
              <View style={styles.alarmRowContent}>
                <Text style={styles.alarmTag}>{a.tag}</Text>
                <Text style={styles.alarmDesc}>{a.description}</Text>
              </View>
              <Text style={styles.alarmValue}>
                {formatValue(a.valeur, a.unite)} {a.unite !== 'bool' ? a.unite : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Aucune donnée ────────────────────────────────────────────── */}
      {totalSensors === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="radio-outline" size={52} color={C.textMuted} />
          <Text style={styles.emptyTitle}>Aucune donnée capteur</Text>
          <Text style={styles.emptyBody}>
            Le bureau doit être connecté au broker MQTT et avoir reçu des données.
            Vérifiez la connexion MQTT dans l'application bureau.
          </Text>
        </View>
      )}

      {/* ── Barre de vue ─────────────────────────────────────────────── */}
      {totalSensors > 0 && (
        <>
          <View style={styles.viewBar}>
            <Pressable
              onPress={() => setViewMode('famille')}
              style={[styles.viewBtn, viewMode === 'famille' && styles.viewBtnActive]}
            >
              <Ionicons
                name="layers-outline"
                size={14}
                color={viewMode === 'famille' ? C.blue : C.textMuted}
              />
              <Text style={[styles.viewBtnTxt, viewMode === 'famille' && styles.viewBtnTxtActive]}>
                Par famille
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('all')}
              style={[styles.viewBtn, viewMode === 'all' && styles.viewBtnActive]}
            >
              <Ionicons
                name="list-outline"
                size={14}
                color={viewMode === 'all' ? C.blue : C.textMuted}
              />
              <Text style={[styles.viewBtnTxt, viewMode === 'all' && styles.viewBtnTxtActive]}>
                Tous ({totalSensors})
              </Text>
            </Pressable>
          </View>

          {/* ── Vue par famille ────────────────────────────────────── */}
          {viewMode === 'famille' && (
            <View style={styles.familleList}>
              {byFamille.map(([famille, readings]) => (
                <FamilleGroup key={famille} famille={famille} readings={readings} />
              ))}
            </View>
          )}

          {/* ── Vue tous les capteurs ──────────────────────────────── */}
          {viewMode === 'all' && (
            <View style={styles.sensorGrid}>
              {allReadings.map((r) => (
                <SensorCard
                  key={r.tag}
                  reading={r}
                  color={FAMILLE_COLORS[r.famille] ?? C.blue}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12, backgroundColor: C.bg },
  emptyWrap: { alignItems: 'center', marginTop: 32, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody:  { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Statut
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBarLive: {
    backgroundColor: C.greenSoft,
    borderColor: '#a7f3d0',
  },
  statusBarOff: {
    backgroundColor: C.amberSoft,
    borderColor: '#fde68a',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { flex: 1, fontSize: 12, fontWeight: '600' },

  // Alarmes
  alarmsSection: {
    backgroundColor: C.redSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    overflow: 'hidden',
  },
  alarmsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fca5a5',
  },
  alarmsSectionTitle: { color: C.red, fontWeight: '700', fontSize: 13 },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#fee2e2',
  },
  alarmRowContent: { flex: 1, minWidth: 0 },
  alarmTag:    { color: C.red, fontWeight: '700', fontSize: 12, fontFamily: 'monospace' },
  alarmDesc:   { color: C.textSub, fontSize: 11, marginTop: 1 },
  alarmValue:  { color: C.red, fontWeight: '700', fontSize: 13 },

  // Barre de vue
  viewBar: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: C.surface2,
    borderRadius: 10,
    padding: 4,
  },
  viewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewBtnActive: { backgroundColor: C.surface },
  viewBtnTxt:    { fontSize: 13, fontWeight: '600', color: C.textMuted },
  viewBtnTxtActive: { color: C.blue },

  // Familles
  familleList: { gap: 10 },
  familleGroup: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  familleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  familleDot:   { width: 10, height: 10, borderRadius: 5 },
  familleLabel: { flex: 1, color: C.text, fontSize: 14, fontWeight: '700' },
  familleBadge: {
    backgroundColor: C.surface2,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
  },
  familleBadgeTxt: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  alarmBadge:   { marginRight: 4 },

  // Grille capteurs
  sensorGrid: { padding: 10, gap: 8 },
  sensorCard: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    padding: 12,
    gap: 4,
  },
  sensorCardAlarm: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff7f7',
  },
  sensorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sensorTagRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  sensorTag:    { color: C.textSub, fontSize: 11, fontFamily: 'monospace', fontWeight: '700', flex: 1 },
  silBadge:     { marginLeft: 4, backgroundColor: '#fee2e2', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  silTxt:       { color: C.red, fontSize: 9, fontWeight: '800' },
  agePill:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ageDot:       { width: 6, height: 6, borderRadius: 3 },
  ageTxt:       { color: C.textMuted, fontSize: 10 },
  sensorDesc:   { color: C.textMuted, fontSize: 12 },
  sensorValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  sensorValue:  { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  sensorUnit:   { color: C.textSub, fontSize: 12, fontWeight: '600' },
  sensorQuality:{ color: C.textMuted, fontSize: 10, marginLeft: 'auto' },
  alarmDetail:  { backgroundColor: '#fef2f2', borderRadius: 6, padding: 6, marginTop: 4 },
  alarmDetailTxt: { color: C.red, fontSize: 11, fontWeight: '600' },
});

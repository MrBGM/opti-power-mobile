import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import { useFocusEffect } from '@react-navigation/native';

import { getAuthCloudApiBase, getCloudApiBase } from '@/config/env';
import { listVoiceReports } from '@/storage/voiceReportsRepo';
import { useAppLayout } from '@/hooks/useAppLayout';
import type { DrawerParamList } from '@/navigation/types';
import { useServerConfigStore } from '@/store/serverConfigStore';
import { usePairingStore } from '@/store/pairingStore';
import { C } from '@/theme/colors';

type Props = DrawerScreenProps<DrawerParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const layout = useAppLayout();
  const paired      = usePairingStore((s) => s.paired);
  const clearPairing = usePairingStore((s) => s.clearPairing);
  const isLinked    = paired?.status === 'linked' && !!paired.deviceToken;
  const {
    customIp, syncPort, authPort,
    setCustomIp, setSyncPort, setAuthPort,
    clearCustomServer,
  } = useServerConfigStore();

  const [ipInput, setIpInput] = useState(customIp ?? '');
  const [syncPortInput, setSyncPortInput] = useState(String(syncPort));
  const [authPortInput, setAuthPortInput] = useState(String(authPort));
  const [saved, setSaved] = useState(false);
  const [perfTotal, setPerfTotal] = useState<number | null>(null);
  const [perfWeek, setPerfWeek] = useState<number | null>(null);

  const loadPerf = useCallback(async () => {
    try {
      const all = await listVoiceReports();
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recent = all.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        return !Number.isNaN(t) && t >= weekAgo;
      }).length;
      setPerfTotal(all.length);
      setPerfWeek(recent);
    } catch {
      setPerfTotal(0);
      setPerfWeek(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPerf();
    }, [loadPerf]),
  );

  function handleApply() {
    const ip = ipInput.trim();
    const host = ip.replace(/:\d+$/, '').replace(/^https?:\/\//, '');
    if (!host) {
      Alert.alert('Adresse invalide', "Entre une adresse IP ou un nom d'hote valide.");
      return;
    }
    const sp = parseInt(syncPortInput, 10);
    const ap = parseInt(authPortInput, 10);
    if (isNaN(sp) || sp < 1 || sp > 65535) {
      Alert.alert('Port invalide', 'Le port sync doit etre entre 1 et 65535.');
      return;
    }
    if (isNaN(ap) || ap < 1 || ap > 65535) {
      Alert.alert('Port invalide', 'Le port auth doit etre entre 1 et 65535.');
      return;
    }
    setCustomIp(host);
    setSyncPort(sp);
    setAuthPort(ap);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    Alert.alert(
      'Reinitialiser le serveur',
      "Retour aux URLs configurees dans .env ou via l'appairage QR.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Reinitialiser',
          style: 'destructive',
          onPress: () => {
            clearCustomServer();
            setIpInput('');
            setSyncPortInput('3002');
            setAuthPortInput('3001');
          },
        },
      ]
    );
  }

  const activeSync = getCloudApiBase();
  const activeAuth = getAuthCloudApiBase();
  const isCustomActive = !!customIp;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? layout.insets.top : 0}
    >
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[
        styles.wrap,
        {
          paddingHorizontal: layout.padH,
          paddingTop: layout.insets.top + layout.padV,
          paddingBottom: layout.insets.bottom + 32,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { fontSize: layout.fontTitle }]}>Paramètres</Text>

      {/* ─── Section serveur ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.badge, isCustomActive ? styles.badgeCustom : styles.badgeAuto]}>
            <Text style={[styles.badgeText, isCustomActive ? styles.badgeCustomText : styles.badgeAutoText]}>
              {isCustomActive ? 'IP personnalisée' : 'Auto (QR / .env)'}
            </Text>
          </View>
          <Text style={styles.sectionTitle}>Configuration du serveur</Text>
        </View>

        <Text style={styles.label}>URLs actives</Text>
        <View style={styles.urlBox}>
          <Text style={styles.urlRow}>
            <Text style={styles.urlTag}>SYNC </Text>
            <Text style={styles.urlMono} selectable>{activeSync}</Text>
          </Text>
          <Text style={styles.urlRow}>
            <Text style={styles.urlTag}>AUTH </Text>
            <Text style={styles.urlMono} selectable>{activeAuth}</Text>
          </Text>
        </View>

        <Text style={styles.label}>Adresse IP du bureau</Text>
        <TextInput
          value={ipInput}
          onChangeText={(v) => { setIpInput(v); setSaved(false); }}
          placeholder="ex: 192.168.1.5"
          placeholderTextColor={C.textMuted}
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.hint}>
          Entre uniquement l'IP ou le nom d'hote. Les ports sont configurés ci-dessous.
        </Text>

        <View style={styles.portsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Port sync-service</Text>
            <TextInput
              value={syncPortInput}
              onChangeText={(v) => { setSyncPortInput(v); setSaved(false); }}
              placeholder="3002"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Port auth-service</Text>
            <TextInput
              value={authPortInput}
              onChangeText={(v) => { setAuthPortInput(v); setSaved(false); }}
              placeholder="3001"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.btnRow}>
          <Pressable
            onPress={handleApply}
            style={({ pressed }) => [styles.btnApply, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.btnApplyText}>{saved ? 'Appliqué !' : 'Appliquer'}</Text>
          </Pressable>
          {isCustomActive && (
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => [styles.btnClear, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.btnClearText}>Réinitialiser</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={14} color={C.blue} />
          <Text style={styles.infoBoxText}>
            Après avoir changé de Wi-Fi, entre la nouvelle IP et tape "Appliquer".
            Le changement est immédiat, sans redémarrer l'app.
          </Text>
        </View>
      </View>

      {/* ─── Performance technicien (rapports vocaux locaux) ───────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="stats-chart-outline" size={16} color={C.blue} />
          <Text style={styles.sectionTitle}>Ma performance</Text>
        </View>
        <Text style={styles.hint}>
          Indicateurs basés sur vos rapports vocaux enregistrés sur cet appareil (hors ligne inclus).
        </Text>
        <View style={styles.perfRow}>
          <View style={styles.perfCard}>
            <Text style={styles.perfValue}>{perfTotal === null ? '—' : String(perfTotal)}</Text>
            <Text style={styles.perfLabel}>Rapports enregistrés</Text>
          </View>
          <View style={styles.perfCard}>
            <Text style={styles.perfValue}>{perfWeek === null ? '—' : String(perfWeek)}</Text>
            <Text style={styles.perfLabel}>Ces 7 derniers jours</Text>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Reports')}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="document-text-outline" size={14} color={C.blue} />
          <Text style={styles.linkText}>Voir mes rapports</Text>
        </Pressable>
      </View>

      {/* ─── Appairage ───────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="qr-code-outline" size={16} color={C.blue} />
          <Text style={styles.sectionTitle}>Bureau lié</Text>
        </View>

        {isLinked ? (
          /* ── Déjà lié — affiche le statut et option de dissocier ─── */
          <>
            <View style={styles.pairingStatusRow}>
              <Ionicons name="checkmark-circle" size={18} color={C.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pairingLinkedLabel}>Connexion active</Text>
                <Text style={styles.pairingLinkedSub} numberOfLines={1}>
                  ID : {paired!.desktopDeviceId.slice(0, 16)}…
                </Text>
                {paired!.cloudApiBase ? (
                  <Text style={styles.pairingLinkedSub} numberOfLines={1}>
                    {paired!.cloudApiBase}
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable
              onPress={() =>
                Alert.alert(
                  'Dissocier le bureau',
                  'Vous devrez re-scanner le QR pour accéder aux données du bureau.',
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Dissocier', style: 'destructive', onPress: () => clearPairing() },
                  ],
                )
              }
              style={({ pressed }) => [styles.link, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="unlink-outline" size={14} color={C.red} />
              <Text style={[styles.linkText, { color: C.red }]}>Dissocier ce bureau</Text>
            </Pressable>
          </>
        ) : (
          /* ── Pas lié — proposer l'appairage ────────────────────── */
          <>
            <View style={styles.pairingStatusRow}>
              <Ionicons name="cloud-offline-outline" size={18} color={C.textMuted} />
              <Text style={styles.pairingUnlinkedLabel}>Aucun bureau associé</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Pairing')}
              style={({ pressed }) => [styles.link, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="qr-code-outline" size={14} color={C.blue} />
              <Text style={styles.linkText}>Scanner le QR du bureau</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  title: { color: C.text, fontWeight: '800' },

  section: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 10,
    ...C.shadow,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: C.text, fontWeight: '700', fontSize: 14 },

  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  badgeCustom: { backgroundColor: C.blueSoft },
  badgeAuto: { backgroundColor: C.surface2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeCustomText: { color: C.blue },
  badgeAutoText: { color: C.textMuted },

  label: { color: C.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  hint: { color: C.textSub, fontSize: 12, lineHeight: 17, marginTop: -4 },

  urlBox: {
    backgroundColor: C.surface2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    gap: 4,
  },
  urlRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  urlTag: { color: C.textMuted, fontSize: 10, fontWeight: '700', marginRight: 4 },
  urlMono: { color: C.blue, fontSize: 12 },

  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: C.text,
    fontSize: 14,
    backgroundColor: C.bg,
  },

  portsRow: { flexDirection: 'row' },

  btnRow: { flexDirection: 'row', gap: 10 },
  btnApply: {
    flex: 1,
    backgroundColor: C.blue,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  btnApplyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnClear: {
    flex: 1,
    backgroundColor: C.redSoft,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  btnClearText: { color: C.red, fontWeight: '700', fontSize: 13 },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: C.blueSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
  },
  infoBoxText: { color: C.blue, fontSize: 12, lineHeight: 17, flex: 1 },

  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.blueSoft,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  linkText: { color: C.blue, fontWeight: '700', fontSize: 13 },

  // Appairage
  pairingStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  pairingLinkedLabel: { color: C.green, fontWeight: '700', fontSize: 13 },
  pairingLinkedSub:   { color: C.textMuted, fontSize: 11, marginTop: 2 },
  pairingUnlinkedLabel: { color: C.textMuted, fontWeight: '600', fontSize: 13, flex: 1, alignSelf: 'center' },

  perfRow: { flexDirection: 'row', gap: 10 },
  perfCard: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  perfValue: { color: C.text, fontSize: 22, fontWeight: '800' },
  perfLabel: { color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 4, textAlign: 'center' },
});

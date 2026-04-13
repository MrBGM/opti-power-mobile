import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { DrawerScreenProps } from '@react-navigation/drawer';

import { getAuthCloudApiBase, getCloudApiBase } from '@/config/env';
import { useAppLayout } from '@/hooks/useAppLayout';
import type { DrawerParamList } from '@/navigation/types';
import { useServerConfigStore } from '@/store/serverConfigStore';

type Props = DrawerScreenProps<DrawerParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const layout = useAppLayout();
  const { customIp, syncPort, authPort, setCustomIp, setSyncPort, setAuthPort, clearCustomServer } =
    useServerConfigStore();

  const [ipInput, setIpInput] = useState(customIp ?? '');
  const [syncPortInput, setSyncPortInput] = useState(String(syncPort));
  const [authPortInput, setAuthPortInput] = useState(String(authPort));
  const [saved, setSaved] = useState(false);

  function handleApply() {
    const ip = ipInput.trim();
    // Accepte : "192.168.1.5" ou "192.168.1.5:3002" (on garde juste l'host)
    const host = ip.replace(/:\d+$/, '').replace(/^https?:\/\//, '');
    if (!host) {
      Alert.alert('Adresse invalide', 'Entre une adresse IP ou un nom d\'hote valide.');
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
      'Retour aux URLs configurees dans .env ou via l\'appairage QR.',
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
    <ScrollView
      style={{ flex: 1, backgroundColor: '#020617' }}
      contentContainerStyle={[
        styles.wrap,
        {
          paddingHorizontal: layout.padH,
          paddingTop: layout.insets.top + layout.padV,
          paddingBottom: layout.insets.bottom + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { fontSize: layout.fontTitle }]}>Parametres</Text>

      {/* ─── Section serveur ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.badge, isCustomActive ? styles.badgeCustom : styles.badgeAuto]}>
            <Text style={styles.badgeText}>
              {isCustomActive ? 'IP personnalisee' : 'Auto (QR / .env)'}
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
          placeholder="ex: 172.20.10.2"
          placeholderTextColor="#475569"
          keyboardType="default"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Text style={styles.hint}>
          Entre uniquement l'IP ou le nom d'hote. Les ports sont configures ci-dessous.
        </Text>

        <View style={styles.portsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Port sync-service</Text>
            <TextInput
              value={syncPortInput}
              onChangeText={(v) => { setSyncPortInput(v); setSaved(false); }}
              placeholder="3002"
              placeholderTextColor="#475569"
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
              placeholderTextColor="#475569"
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
            <Text style={styles.btnApplyText}>{saved ? 'Applique !' : 'Appliquer'}</Text>
          </Pressable>
          {isCustomActive && (
            <Pressable
              onPress={handleClear}
              style={({ pressed }) => [styles.btnClear, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.btnClearText}>Reinitialiser</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.infoBox}>
          Apres avoir change de Wi-Fi, entre la nouvelle IP et tape "Appliquer".
          Le changement est immediat, sans redemarrer l'app.
        </Text>
      </View>

      {/* ─── Appairage ───────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appairage desktop</Text>
        <Pressable
          onPress={() => navigation.navigate('Pairing')}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.linkText}>Appairage avec le bureau (QR / code)</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  title: { color: '#f8fafc', fontWeight: '800' },

  section: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    gap: 10,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },

  badge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  badgeCustom: { backgroundColor: '#0284c7' },
  badgeAuto: { backgroundColor: '#1e293b' },
  badgeText: { color: '#f0f9ff', fontSize: 10, fontWeight: '700' },

  label: { color: '#94a3b8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  hint: { color: '#475569', fontSize: 11, marginTop: -4 },

  urlBox: {
    backgroundColor: '#020617',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
    gap: 4,
  },
  urlRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  urlTag: { color: '#64748b', fontSize: 10, fontFamily: 'monospace', fontWeight: '700', marginRight: 4 },
  urlMono: { color: '#38bdf8', fontSize: 12, fontFamily: 'monospace' },

  input: {
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    backgroundColor: '#020617',
  },

  portsRow: { flexDirection: 'row' },

  btnRow: { flexDirection: 'row', gap: 10 },
  btnApply: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  btnApplyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnClear: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  btnClearText: { color: '#f87171', fontWeight: '700', fontSize: 13 },

  infoBox: {
    backgroundColor: '#0c1a2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a5f',
    padding: 10,
    color: '#7dd3fc',
    fontSize: 12,
    lineHeight: 17,
  },

  link: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  linkText: { color: '#93c5fd', fontWeight: '700', fontSize: 13 },
});

import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getAuthCloudApiBase } from '@/config/env';
import { useLogin } from '@/features/auth/useLogin';
import type { AuthStackParamList } from '@/navigation/types';
import { useServerConfigStore } from '@/store/serverConfigStore';
import { C } from '@/theme/colors';

type LoginNav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

/** Points décoratifs façon grille lumineuse */
function GridOverlay() {
  const COLS = 7;
  const ROWS = 14;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: ROWS }).map((_, r) => (
        <View key={r} style={grid.row}>
          {Array.from({ length: COLS }).map((_, c) => (
            <View key={c} style={grid.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const grid = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(59,130,246,0.07)',
  },
});

export function LoginScreen() {
  const navigation = useNavigation<LoginNav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();

  const { customIp, syncPort, authPort, setCustomIp, setSyncPort, setAuthPort, clearCustomServer } =
    useServerConfigStore();
  const [showServerPanel, setShowServerPanel] = useState(false);
  const [ipInput, setIpInput] = useState(customIp ?? '');
  const [syncPortInput, setSyncPortInput] = useState(String(syncPort));
  const [authPortInput, setAuthPortInput] = useState(String(authPort));

  const canSubmit = !!email.trim() && !!password && !login.isPending;
  const errMsg =
    login.isError && login.error instanceof Error
      ? login.error.message
      : login.isSuccess && login.data && !login.data.success
        ? login.data.error
        : null;

  function applyServer() {
    const host = ipInput.trim().replace(/:\d+$/, '').replace(/^https?:\/\//, '');
    if (!host) { Alert.alert('Adresse invalide', 'Entre une adresse IP valide.'); return; }
    const sp = parseInt(syncPortInput, 10);
    const ap = parseInt(authPortInput, 10);
    if (isNaN(sp) || isNaN(ap)) { Alert.alert('Ports invalides', 'Vérifie les ports sync et auth.'); return; }
    setCustomIp(host); setSyncPort(sp); setAuthPort(ap);
    setShowServerPanel(false);
  }

  function resetServer() {
    clearCustomServer();
    setIpInput(''); setSyncPortInput('3002'); setAuthPortInput('3001');
    setShowServerPanel(false);
  }

  const activeAuthUrl = getAuthCloudApiBase();
  const isCustom = !!customIp;

  return (
    /* Fond dégradé identique au desktop (mode clair) */
    <LinearGradient
      colors={['#dbeafe', '#ede9fe', '#cffafe']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      {/* Grille CSS */}
      <GridOverlay />

      {/* Halo central */}
      <View style={styles.halo} pointerEvents="none" />

      {/* Carte glassmorphism */}
      <View style={styles.card}>

        {/* Logo + titre */}
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Ionicons name="flash" size={28} color="#fff" />
          </View>
          <View>
            <Text style={styles.title}>Opti Power</Text>
            <Text style={styles.subtitle}>Accès mobile</Text>
          </View>
        </View>

        {/* Champs */}
        <View style={styles.fields}>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={16} color={C.textMuted} style={styles.inputIcon} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={16} color={C.textMuted} style={styles.inputIcon} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor={C.textMuted}
              secureTextEntry
              style={styles.input}
            />
          </View>
        </View>

        {errMsg ? (
          <View style={styles.errorWrap}>
            <Ionicons name="alert-circle-outline" size={14} color={C.red} />
            <Text style={styles.error}>{errMsg}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => login.mutate({ email: email.trim(), password })}
          disabled={!canSubmit}
          style={({ pressed }) => [styles.button, !canSubmit && styles.buttonDisabled, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.buttonText}>{login.isPending ? 'Connexion...' : 'Se connecter'}</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Pairing')}
          style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="link-outline" size={14} color={C.textSub} />
          <Text style={styles.secondaryBtnText}>Appairage desktop</Text>
        </Pressable>

        {/* ── Indicateur serveur ──────────────────────────────────── */}
        <Pressable
          onPress={() => setShowServerPanel((v) => !v)}
          style={styles.serverIndicator}
        >
          <View style={[styles.serverDot, isCustom ? styles.dotCustom : styles.dotAuto]} />
          <Text style={styles.serverIndicatorText} numberOfLines={1}>{activeAuthUrl}</Text>
          <Ionicons
            name={showServerPanel ? 'chevron-up' : 'chevron-down'}
            size={12}
            color={C.textMuted}
          />
        </Pressable>

        {showServerPanel && (
          <View style={styles.serverPanel}>
            <Text style={styles.serverPanelTitle}>Adresse du serveur</Text>

            <TextInput
              value={ipInput}
              onChangeText={setIpInput}
              placeholder="ex: 172.20.10.2"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              style={styles.serverInput}
            />

            <View style={styles.portsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serverPortLabel}>Port Sync</Text>
                <TextInput
                  value={syncPortInput}
                  onChangeText={setSyncPortInput}
                  placeholder="3002"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                  style={styles.serverInput}
                />
              </View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.serverPortLabel}>Port Auth</Text>
                <TextInput
                  value={authPortInput}
                  onChangeText={setAuthPortInput}
                  placeholder="3001"
                  placeholderTextColor={C.textMuted}
                  keyboardType="numeric"
                  style={styles.serverInput}
                />
              </View>
            </View>

            <View style={styles.serverBtnRow}>
              <Pressable
                onPress={applyServer}
                style={({ pressed }) => [styles.serverBtnApply, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.serverBtnApplyText}>Appliquer</Text>
              </Pressable>
              {isCustom && (
                <Pressable
                  onPress={resetServer}
                  style={({ pressed }) => [styles.serverBtnReset, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.serverBtnResetText}>Réinitialiser</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  // Halo central
  halo: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: 'rgba(59,130,246,0.12)',
    top: '50%',
    left: '50%',
    marginLeft: -240,
    marginTop: -240,
  },

  // Carte glassmorphism
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.96)',
    padding: 28,
    gap: 14,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },

  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#6366f1', fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Champs
  fields: { gap: 10 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: C.text,
    fontSize: 14,
  },

  errorWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  error: { color: C.red, fontSize: 12, flex: 1 },

  // Bouton principal
  button: {
    backgroundColor: C.blue,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    shadowColor: C.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Bouton secondaire
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    borderRadius: 12,
    backgroundColor: 'rgba(248,250,252,0.80)',
    paddingVertical: 12,
  },
  secondaryBtnText: { color: C.textSub, fontWeight: '600', fontSize: 13 },

  // Indicateur serveur
  serverIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(241,245,249,0.8)',
    paddingTop: 10,
    marginTop: -4,
    gap: 6,
  },
  serverDot: { width: 6, height: 6, borderRadius: 3 },
  dotCustom: { backgroundColor: C.blue },
  dotAuto: { backgroundColor: C.textMuted },
  serverIndicatorText: { flex: 1, color: C.textMuted, fontSize: 11 },

  // Panneau config serveur
  serverPanel: {
    backgroundColor: 'rgba(248,250,252,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.30)',
    padding: 14,
    gap: 10,
  },
  serverPanelTitle: { fontSize: 12, fontWeight: '700', color: C.textSub },
  serverInput: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: C.text,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  portsRow: { flexDirection: 'row' },
  serverPortLabel: { fontSize: 10, color: C.textMuted, fontWeight: '600', marginBottom: 4 },
  serverBtnRow: { flexDirection: 'row', gap: 8 },
  serverBtnApply: {
    flex: 1,
    backgroundColor: C.blue,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 9,
  },
  serverBtnApplyText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  serverBtnReset: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  serverBtnResetText: { color: C.textSub, fontWeight: '600', fontSize: 13 },
});

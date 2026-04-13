import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';

import { getCloudApiBase } from '@/config/env';
import { useAppLayout } from '@/hooks/useAppLayout';
import { goBackFromPairing } from '@/lib/navigationSafeBack';
import { parsePairingPayload } from '@/lib/pairingPayload';
import { fetchApprovedPairingSession, pollPairingSessionApproved } from '@/lib/pairingPoll';
import { usePairingStore } from '@/store/pairingStore';

type Tab = 'scan' | 'manual';

export function PairingScreen() {
  const navigation = useNavigation();
  const layout = useAppLayout();
  const [tab, setTab] = useState<Tab>('scan');
  const [manual, setManual] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const setPairedFromPayload = usePairingStore((s) => s.setPairedFromPayload);
  const setLinkedWithDeviceToken = usePairingStore((s) => s.setLinkedWithDeviceToken);
  const clearPairing = usePairingStore((s) => s.clearPairing);
  const paired = usePairingStore((s) => s.paired);

  const effectiveBase = getCloudApiBase();

  const claimPairing = useCallback(async (apiBase: string, body: Record<string, unknown>) => {
      const root = apiBase.replace(/\/$/, '');
      const response = await fetch(`${root}/v1/pairing/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const txt = await response.text();
        if (response.status === 409 && txt) {
          try {
            const j = JSON.parse(txt) as { error?: string };
            if (j?.error === 'pairing_already_approved') {
              const err = new Error('pairing_already_approved') as Error & { code: string };
              err.code = 'pairing_already_approved';
              throw err;
            }
          } catch (e) {
            if (e instanceof Error && (e as Error & { code?: string }).code === 'pairing_already_approved') {
              throw e;
            }
          }
        }
        throw new Error(txt || `Erreur appairage (${response.status})`);
      }
      return response.json();
    }, []);

  const applyPayload = useCallback(
    async (raw: string) => {
      try {
        const payload = parsePairingPayload(raw);
        const apiBase = payload.cloudApiBase ?? effectiveBase;
        await claimPairing(apiBase, {
          sessionId: payload.pairingSessionId,
          mobileDeviceId: `mobile-${Date.now()}`,
          mobileLabel: 'Agent Mobile',
        });
        setPairedFromPayload(payload);
        const { deviceToken } = await pollPairingSessionApproved(apiBase, payload.pairingSessionId);
        setLinkedWithDeviceToken(deviceToken);
        Alert.alert(
          'Appairage terminé',
          'Les équipements du bureau se mettent à jour automatiquement (sync-service).',
          [{ text: 'OK', onPress: () => goBackFromPairing(navigation as NavigationProp<ParamListBase>) }]
        );
      } catch (e) {
        const code =
          e instanceof Error && 'code' in e ? (e as Error & { code?: string }).code : undefined;
        if (code === 'pairing_already_approved') {
          try {
            const payload = parsePairingPayload(raw);
            const apiBase = payload.cloudApiBase ?? effectiveBase;
            const { deviceToken } = await fetchApprovedPairingSession(apiBase, payload.pairingSessionId);
            setPairedFromPayload(payload);
            setLinkedWithDeviceToken(deviceToken);
            Alert.alert(
              'Lien déjà actif',
              'Cette session a déjà été validée sur le bureau. Connexion rétablie.',
              [{ text: 'OK', onPress: () => goBackFromPairing(navigation as NavigationProp<ParamListBase>) }]
            );
          } catch {
            Alert.alert(
              'Appairage',
              'Ce QR a déjà été utilisé. Ouvrez Paramètres sur le bureau et générez un nouveau code, ou effacez l’appairage local sur le mobile puis recommencez.'
            );
          }
          return;
        }
        const msg = e instanceof Error ? e.message : 'Erreur';
        const friendly =
          /"error"\s*:\s*"pairing_already_approved"/.test(msg) || msg === 'pairing_already_approved'
            ? 'Ce QR a déjà été utilisé. Générez un nouveau code sur le bureau ou effacez l’appairage local.'
            : msg;
        Alert.alert('Appairage', friendly);
      }
    },
    [claimPairing, effectiveBase, navigation, setLinkedWithDeviceToken, setPairedFromPayload]
  );

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      void applyPayload(data);
      setTimeout(() => {
        scannedRef.current = false;
      }, 2500);
    },
    [applyPayload]
  );

  const padStyle = { paddingHorizontal: layout.padH, paddingTop: layout.insets.top + layout.padV };

  return (
    <View style={[styles.screen, { paddingBottom: layout.insets.bottom + 12 }]}>
      <View style={[styles.header, padStyle]}>
        <Pressable
          onPress={() => goBackFromPairing(navigation as NavigationProp<ParamListBase>)}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="chevron-back" size={22} color="#e2e8f0" />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={[styles.title, { fontSize: layout.fontTitle }]}>Appairage</Text>
          <Text style={[styles.sub, { fontSize: layout.fontBody }]}>
            Scannez le QR du desktop ou saisissez le code manuel.
          </Text>
      </View>

      <View style={[styles.tabs, { marginHorizontal: layout.padH }]}>
        <Pressable
          onPress={() => setTab('scan')}
          style={[styles.tab, tab === 'scan' && styles.tabOn]}
        >
          <Text style={[styles.tabTxt, tab === 'scan' && styles.tabTxtOn]}>Scanner</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('manual')}
          style={[styles.tab, tab === 'manual' && styles.tabOn]}
        >
          <Text style={[styles.tabTxt, tab === 'manual' && styles.tabTxtOn]}>Code manuel</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.padH, gap: layout.gap, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>URL API utilisée pour la connexion</Text>
          <Text style={styles.infoUrl} selectable>
            {effectiveBase}
          </Text>
          {paired ? (
            <Text style={styles.pairedOk}>
              Bureau lié : {paired.desktopDeviceId.slice(0, 12)}… — session{' '}
              {paired.pairingSessionId.slice(0, 8)}…
            </Text>
          ) : (
            <Text style={styles.pairedMuted}>Aucun bureau appairé pour l’instant.</Text>
          )}
        </View>

        {tab === 'scan' ? (
          <View style={styles.cameraWrap}>
            {!permission?.granted ? (
              <View style={styles.permBox}>
                <Text style={styles.permText}>La caméra est nécessaire pour lire le QR.</Text>
                <Pressable onPress={() => void requestPermission()} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnTxt}>Autoriser la caméra</Text>
                </Pressable>
              </View>
            ) : (
              <CameraView
                style={[styles.camera, { maxHeight: layout.height * 0.42 }]}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={onBarcodeScanned}
              />
            )}
          </View>
        ) : (
          <>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Code manuel (ex: 123456)"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              value={manual}
              onChangeText={setManual}
              placeholder="Optionnel: coller aussi le JSON du QR"
              placeholderTextColor="#64748b"
              multiline
              style={styles.textarea}
            />
            <Pressable
              onPress={() => {
                if (!manualCode.trim() && !manual.trim()) {
                  Alert.alert('Appairage', 'Saisissez un code manuel ou collez le JSON.');
                  return;
                }
                if (manual.trim()) {
                  void applyPayload(manual);
                  return;
                }
                void (async () => {
                  try {
                    const data = (await claimPairing(effectiveBase, {
                      manualCode: manualCode.trim(),
                      mobileDeviceId: `mobile-${Date.now()}`,
                      mobileLabel: 'Agent Mobile',
                    })) as { sessionId?: string };
                    const sid = data.sessionId;
                    if (!sid) {
                      throw new Error('Réponse serveur sans sessionId');
                    }
                    setPairedFromPayload({
                      pairingSessionId: sid,
                      desktopDeviceId: 'manual-code',
                      cloudApiBase: effectiveBase,
                    });
                    const { deviceToken } = await pollPairingSessionApproved(effectiveBase, sid);
                    setLinkedWithDeviceToken(deviceToken);
                    Alert.alert(
                      'Appairage terminé',
                      'Les équipements du bureau se mettent à jour automatiquement.',
                      [{ text: 'OK', onPress: () => goBackFromPairing(navigation as NavigationProp<ParamListBase>) }]
                    );
                  } catch (e) {
                    const code =
                      e instanceof Error && 'code' in e
                        ? (e as Error & { code?: string }).code
                        : undefined;
                    if (code === 'pairing_already_approved') {
                      Alert.alert(
                        'Appairage',
                        'Ce code a déjà été utilisé sur le bureau. Générez un nouveau code ou collez le JSON complet du QR pour rétablir le lien.'
                      );
                      return;
                    }
                    const msg = e instanceof Error ? e.message : 'Erreur';
                    Alert.alert('Appairage', msg);
                  }
                })();
              }}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.primaryBtnTxt}>Connecter le mobile</Text>
            </Pressable>
          </>
        )}

        <Pressable
          onPress={() => {
            clearPairing();
            Alert.alert('Appairage', 'Données d’appairage effacées.');
          }}
          style={styles.dangerGhost}
        >
          <Text style={styles.dangerGhostTxt}>Effacer l’appairage local</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  header: { gap: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  title: { color: '#f8fafc', fontWeight: '800' },
  sub: { color: '#94a3b8', lineHeight: 20 },
  mono: { fontFamily: 'monospace', color: '#a5b4fc', fontSize: 12 },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  tabOn: { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)' },
  tabTxt: { color: '#94a3b8', fontWeight: '700', fontSize: 13 },
  tabTxtOn: { color: '#e0e7ff' },
  infoCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    gap: 6,
  },
  infoLabel: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  infoUrl: { color: '#38bdf8', fontSize: 13, fontWeight: '600' },
  pairedOk: { color: '#86efac', fontSize: 12, marginTop: 4 },
  pairedMuted: { color: '#64748b', fontSize: 12, marginTop: 4 },
  cameraWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  camera: { width: '100%', minHeight: 220 },
  permBox: { padding: 24, alignItems: 'center', gap: 12 },
  permText: { color: '#94a3b8', textAlign: 'center', fontSize: 14 },
  textarea: {
    minHeight: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    padding: 14,
    fontSize: 13,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dangerGhost: { paddingVertical: 12, alignItems: 'center' },
  dangerGhostTxt: { color: '#f87171', fontWeight: '600', fontSize: 14 },
});

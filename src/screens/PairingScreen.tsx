import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';

import { getCloudApiBase } from '@/config/env';
import { useAppLayout } from '@/hooks/useAppLayout';
import { goBackFromPairing } from '@/lib/navigationSafeBack';
import type { BarcodeSettings } from 'expo-camera';
import type { PairingQrPayload } from '@/lib/pairingPayload';
import { parsePairingPayload } from '@/lib/pairingPayload';
import { fetchApprovedPairingSession, pollPairingSessionApproved } from '@/lib/pairingPoll';
import { usePairingStore } from '@/store/pairingStore';
import { C } from '@/theme/colors';

// ── Constante stable — NE PAS mettre inline dans le JSX. ─────────────────────
// Si l'objet est recréé à chaque render, expo-camera réinitialise le scanner
// et onBarcodeScanned ne fire jamais.
const QR_SCANNER_SETTINGS: BarcodeSettings = { barcodeTypes: ['qr'] };

type Tab = 'scan' | 'manual';

/**
 * Résout la base URL à utiliser pour l'appairage.
 * Si le QR payload contient "localhost" ou "127.0.0.1" (sync-service sans SYNC_PUBLIC_URL),
 * on utilise l'URL effective de l'app (IP réseau configurée).
 */
function resolveApiBase(cloudApiBase: string | undefined, fallback: string): string {
  if (!cloudApiBase) return fallback;
  const isLocal = cloudApiBase.includes('localhost') || cloudApiBase.includes('127.0.0.1');
  return isLocal ? fallback : cloudApiBase;
}

/** Enregistre des URL joignables depuis le mobile (évite localhost persisté après scan QR). */
function normalizePairingPayloadForStore(
  payload: PairingQrPayload,
  effectiveSyncBase: string,
): PairingQrPayload {
  const cloudApiBase = resolveApiBase(payload.cloudApiBase, effectiveSyncBase);
  let authApiBase = payload.authApiBase;
  if (authApiBase) {
    const authFallback = effectiveSyncBase.replace(/:3002(?=$|\/)/, ':3001');
    authApiBase = resolveApiBase(authApiBase, authFallback);
  }
  return { ...payload, cloudApiBase, authApiBase };
}

export function PairingScreen() {
  const navigation     = useNavigation();
  const layout         = useAppLayout();
  const [tab, setTab]  = useState<Tab>('scan');
  const [manual, setManual]         = useState('');
  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'processing' | 'error'>('idle');

  // expo-camera v17: [permission, requestPermission, getPermission]
  const [permission, requestPermission] = useCameraPermissions();

  const scannedRef  = useRef(false);
  const setPairedFromPayload    = usePairingStore((s) => s.setPairedFromPayload);
  const setLinkedWithDeviceToken = usePairingStore((s) => s.setLinkedWithDeviceToken);
  const clearPairing = usePairingStore((s) => s.clearPairing);
  const paired       = usePairingStore((s) => s.paired);

  const effectiveBase = getCloudApiBase();

  // ── Demander la permission caméra automatiquement ──────────────────────────
  // On ne demande QUE si l'état a été déterminé (≠ null) et n'est pas accordé.
  // Cela évite de déclencher le dialog avant que le hook ait fini de charger.
  useEffect(() => {
    if (tab === 'scan' && permission !== null && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [tab, permission, requestPermission]);

  const claimPairing = useCallback(
    async (apiBase: string, body: Record<string, unknown>) => {
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
            if (
              e instanceof Error &&
              (e as Error & { code?: string }).code === 'pairing_already_approved'
            ) throw e;
          }
        }
        throw new Error(txt || `Erreur appairage (${response.status})`);
      }
      return response.json();
    },
    [],
  );

  const applyPayload = useCallback(
    async (raw: string) => {
      setScanStatus('processing');
      try {
        const payload = parsePairingPayload(raw);
        const apiBase = resolveApiBase(payload.cloudApiBase, effectiveBase);
        await claimPairing(apiBase, {
          sessionId:    payload.pairingSessionId,
          mobileDeviceId: `mobile-${Date.now()}`,
          mobileLabel:  'Agent Mobile',
        });
        setPairedFromPayload(normalizePairingPayloadForStore(payload, effectiveBase));
        const { deviceToken } = await pollPairingSessionApproved(apiBase, payload.pairingSessionId);
        setLinkedWithDeviceToken(deviceToken);
        setScanStatus('idle');
        Alert.alert(
          'Appairage terminé',
          'Les équipements du bureau se mettent à jour automatiquement.',
          [{ text: 'OK', onPress: () => goBackFromPairing(navigation as NavigationProp<ParamListBase>) }],
        );
      } catch (e) {
        setScanStatus('error');
        // Réinitialiser immédiatement pour permettre un nouveau scan
        scannedRef.current = false;
        setTimeout(() => setScanStatus('idle'), 2000);

        const code = e instanceof Error && 'code' in e
          ? (e as Error & { code?: string }).code
          : undefined;

        if (code === 'pairing_already_approved') {
          try {
            const payload = parsePairingPayload(raw);
            const apiBase = resolveApiBase(payload.cloudApiBase, effectiveBase);
            const { deviceToken } = await fetchApprovedPairingSession(apiBase, payload.pairingSessionId);
            setPairedFromPayload(normalizePairingPayloadForStore(payload, effectiveBase));
            setLinkedWithDeviceToken(deviceToken);
            setScanStatus('idle');
            Alert.alert(
              'Lien déjà actif',
              'Session déjà validée. Connexion rétablie.',
              [{ text: 'OK', onPress: () => goBackFromPairing(navigation as NavigationProp<ParamListBase>) }],
            );
          } catch {
            Alert.alert('Appairage', 'Ce QR a déjà été utilisé. Générez un nouveau code sur le bureau.');
          }
          return;
        }
        const msg = e instanceof Error ? e.message : 'Erreur réseau ou QR expiré.';
        Alert.alert('Appairage échoué', msg);
      }
    },
    [claimPairing, effectiveBase, navigation, setLinkedWithDeviceToken, setPairedFromPayload],
  );

  // ── Callback scan QR ──────────────────────────────────────────────────────
  // expo-camera v17 : le callback reçoit directement un BarcodeScanningResult
  // { type: string, data: string, raw?: string, ... } — pas de wrapper nativeEvent ici.
  const onBarcodeScanned = useCallback(
    (result: { data?: string; raw?: string; [k: string]: unknown }) => {
      // Extraire la donnée brute
      const data = (
        typeof result?.data === 'string' ? result.data :
        typeof result?.raw  === 'string' ? result.raw  :
        ''
      ).trim();

      if (!data || scannedRef.current) return;
      scannedRef.current = true;
      void applyPayload(data);
    },
    [applyPayload],
  );

  const padH = layout.padH;

  // ── Vue caméra (tab scan) ──────────────────────────────────────────────────
  const renderCameraContent = () => {
    // Hook encore en train de charger
    if (permission === null) {
      return (
        <View style={styles.permBox}>
          <ActivityIndicator color={C.blue} size="large" />
          <Text style={styles.permText}>Vérification de la permission caméra…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.permBox}>
          <Ionicons name="camera-outline" size={40} color={C.textMuted} />
          <Text style={styles.permText}>La caméra est nécessaire pour lire le QR.</Text>
          {permission.canAskAgain ? (
            <Pressable
              onPress={() => void requestPermission()}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Autoriser la caméra</Text>
            </Pressable>
          ) : (
            <Text style={[styles.permText, { color: C.red }]}>
              Permission refusée définitivement. Activez-la dans les paramètres du téléphone.
            </Text>
          )}
        </View>
      );
    }

    return (
      <>
        {/* La CameraView utilise QR_SCANNER_SETTINGS — référence STABLE hors composant */}
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={QR_SCANNER_SETTINGS}
          onBarcodeScanned={onBarcodeScanned}
          active={scanStatus !== 'processing'}
        />
        {/* Overlay scan */}
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={[
            styles.scanFrame,
            scanStatus === 'processing' && styles.scanFrameProcessing,
            scanStatus === 'error' && styles.scanFrameError,
          ]} />
        </View>

        {/* Statut scan */}
        <View style={styles.scanStatusBar} pointerEvents="none">
          {scanStatus === 'processing' ? (
            <View style={styles.scanStatusPill}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.scanStatusTxt}>Connexion au bureau…</Text>
            </View>
          ) : scanStatus === 'error' ? (
            <View style={[styles.scanStatusPill, styles.scanStatusError]}>
              <Ionicons name="warning-outline" size={14} color="#fff" />
              <Text style={styles.scanStatusTxt}>Échec — réessayez</Text>
            </View>
          ) : (
            <Text style={styles.cameraHint}>Cadrez le QR affiché sur le bureau</Text>
          )}
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingBottom: layout.insets.bottom + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? layout.insets.top : 0}
    >
      <View style={styles.body}>
        {/* En-tête */}
        <View style={[styles.header, { paddingHorizontal: padH, paddingTop: layout.insets.top + layout.padV }]}>
          <Pressable
            onPress={() => goBackFromPairing(navigation as NavigationProp<ParamListBase>)}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="chevron-back" size={22} color={C.blue} />
            <Text style={styles.backText}>Retour</Text>
          </Pressable>
          <Text style={[styles.title, { fontSize: layout.fontTitle }]}>Appairage</Text>
          <Text style={[styles.sub, { fontSize: layout.fontBody }]}>
            Scannez le QR du desktop ou saisissez le code manuel.
          </Text>
        </View>

        {/* Onglets */}
        <View style={[styles.tabs, { marginHorizontal: padH }]}>
          <Pressable
            onPress={() => setTab('scan')}
            style={[styles.tab, tab === 'scan' && styles.tabOn]}
          >
            <Ionicons name="qr-code-outline" size={15} color={tab === 'scan' ? C.blue : C.textMuted} />
            <Text style={[styles.tabTxt, tab === 'scan' && styles.tabTxtOn]}>Scanner QR</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('manual')}
            style={[styles.tab, tab === 'manual' && styles.tabOn]}
          >
            <Ionicons name="keypad-outline" size={15} color={tab === 'manual' ? C.blue : C.textMuted} />
            <Text style={[styles.tabTxt, tab === 'manual' && styles.tabTxtOn]}>Code manuel</Text>
          </Pressable>
        </View>

        {tab === 'scan' ? (
          <>
            <View style={{ paddingHorizontal: padH, marginBottom: 10 }}>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Ionicons name="server-outline" size={14} color={C.textMuted} />
                  <Text style={styles.infoLabel}>Serveur utilisé</Text>
                </View>
                <Text style={styles.infoUrl} selectable>{effectiveBase}</Text>
                {paired ? (
                  <View style={styles.pairedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color={C.green} />
                    <Text style={styles.pairedOk}>
                      Bureau lié · {paired.desktopDeviceId.slice(0, 12)}…
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.pairedMuted}>Aucun bureau appairé pour l'instant.</Text>
                )}
              </View>
            </View>

            <View style={[styles.scanPane, { marginHorizontal: padH }]}>
              <View style={styles.cameraWrap}>
                {renderCameraContent()}
              </View>
            </View>

            <View style={{ paddingHorizontal: padH, paddingTop: 10 }}>
              <Pressable
                onPress={() => {
                  clearPairing();
                  Alert.alert('Appairage', 'Données d\'appairage effacées.');
                }}
                style={({ pressed }) => [styles.dangerGhost, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="trash-outline" size={14} color={C.red} />
                <Text style={styles.dangerGhostTxt}>Effacer l'appairage local</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <ScrollView
            style={styles.manualScroll}
            contentContainerStyle={{ paddingHorizontal: padH, gap: layout.gap, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="server-outline" size={14} color={C.textMuted} />
                <Text style={styles.infoLabel}>Serveur utilisé</Text>
              </View>
              <Text style={styles.infoUrl} selectable>{effectiveBase}</Text>
              {paired ? (
                <View style={styles.pairedBadge}>
                  <Ionicons name="checkmark-circle" size={13} color={C.green} />
                  <Text style={styles.pairedOk}>
                    Bureau lié · {paired.desktopDeviceId.slice(0, 12)}…
                  </Text>
                </View>
              ) : (
                <Text style={styles.pairedMuted}>Aucun bureau appairé pour l'instant.</Text>
              )}
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Code à 6 chiffres</Text>
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="123456"
                placeholderTextColor={C.textMuted}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>ou coller le JSON du QR</Text>
              <TextInput
                value={manual}
                onChangeText={setManual}
                placeholder='{"sessionId":"...","desktopDeviceId":"..."}'
                placeholderTextColor={C.textMuted}
                multiline
                style={styles.textarea}
              />
            </View>
            <Pressable
              onPress={() => {
                if (!manualCode.trim() && !manual.trim()) {
                  Alert.alert('Appairage', 'Saisissez un code ou collez le JSON.');
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
                    if (!sid) throw new Error('Réponse serveur sans sessionId');
                    setPairedFromPayload(
                      normalizePairingPayloadForStore(
                        { pairingSessionId: sid, desktopDeviceId: 'manual-code', cloudApiBase: effectiveBase },
                        effectiveBase,
                      ),
                    );
                    const { deviceToken } = await pollPairingSessionApproved(effectiveBase, sid);
                    setLinkedWithDeviceToken(deviceToken);
                    Alert.alert(
                      'Appairage terminé',
                      'Connexion établie avec le bureau.',
                      [{ text: 'OK', onPress: () => goBackFromPairing(navigation as NavigationProp<ParamListBase>) }],
                    );
                  } catch (e) {
                    Alert.alert('Appairage', e instanceof Error ? e.message : 'Erreur');
                  }
                })();
              }}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="link" size={16} color="#fff" />
              <Text style={styles.primaryBtnTxt}>Connecter le mobile</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                clearPairing();
                Alert.alert('Appairage', 'Données d\'appairage effacées.');
              }}
              style={({ pressed }) => [styles.dangerGhost, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="trash-outline" size={14} color={C.red} />
              <Text style={styles.dangerGhostTxt}>Effacer l'appairage local</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1 },
  manualScroll: { flex: 1 },
  header: {
    gap: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 6 },
  backText: { color: C.blue, fontSize: 15, fontWeight: '600' },
  title: { color: C.text, fontWeight: '800' },
  sub:   { color: C.textSub, lineHeight: 20 },

  tabs: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    ...C.shadow,
  },
  tabOn:    { borderColor: C.blue, backgroundColor: C.blueSoft },
  tabTxt:   { color: C.textMuted, fontWeight: '700', fontSize: 13 },
  tabTxtOn: { color: C.blue },

  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 6,
    ...C.shadow,
  },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoLabel:  { color: C.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  infoUrl:    { color: C.blue, fontSize: 13, fontWeight: '600' },
  pairedBadge:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  pairedOk:   { color: C.green, fontSize: 12, fontWeight: '600' },
  pairedMuted:{ color: C.textMuted, fontSize: 12, marginTop: 4 },

  scanPane: { flex: 1, minHeight: 300 },
  cameraWrap: {
    flex: 1,
    minHeight: 300,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#000',
    position: 'relative',
    ...C.shadow,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  scanFrameProcessing: { borderColor: C.blue },
  scanFrameError:      { borderColor: C.red },

  scanStatusBar: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37,99,235,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scanStatusError: { backgroundColor: 'rgba(220,38,38,0.85)' },
  scanStatusTxt:   { color: '#fff', fontSize: 13, fontWeight: '600' },
  cameraHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },

  permBox: {
    flex: 1,
    minHeight: 280,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: C.surface2,
  },
  permText: { color: C.textSub, textAlign: 'center', fontSize: 14, lineHeight: 20 },

  fieldWrap: { gap: 6 },
  fieldLabel: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textarea: {
    minHeight: 130,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    color: C.text,
    padding: 14,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingVertical: 14,
    ...C.shadow,
  },
  primaryBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  dangerGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  dangerGhostTxt: { color: C.red, fontWeight: '600', fontSize: 14 },
});

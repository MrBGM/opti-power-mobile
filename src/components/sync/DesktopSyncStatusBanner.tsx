import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { useMobileSnapshotSyncStore } from '@/store/mobileSnapshotSyncStore';

function useDebouncedPullVisible(inFlight: boolean) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (inFlight) {
      const id = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setVisible(false), 240);
    return () => clearTimeout(id);
  }, [inFlight]);
  return visible;
}

function IndeterminateBar() {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-100, 220] });
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barGlow, { transform: [{ translateX }] }]} />
    </View>
  );
}

function PulseWrap({ active, children }: { active: boolean; children: ReactNode }) {
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      op.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.78, duration: 850, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, op]);
  return <Animated.View style={{ opacity: op }}>{children}</Animated.View>;
}

const TONE: Record<'pull' | 'wait' | 'ok' | 'err', ViewStyle> = {
  pull: { borderColor: 'rgba(56,189,248,0.45)', backgroundColor: 'rgba(14,116,144,0.18)' },
  wait: { borderColor: 'rgba(251,191,36,0.4)', backgroundColor: 'rgba(120,53,15,0.2)' },
  ok: { borderColor: 'rgba(74,222,128,0.35)', backgroundColor: 'rgba(20,83,45,0.18)' },
  err: { borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(127,29,29,0.2)' },
};

type Props = {
  linked: boolean;
  /** Indique si les KPI affichables sont déjà présents pour le contexte (équipement sélectionné, liste, etc.). */
  hasKpiData: boolean;
  /** Détail affiché surtout en mode « attente » (ex. compteur X/Y). */
  subtitle?: string;
  /** Une seule ligne + icône si succès. */
  compactSuccess?: boolean;
};

export function DesktopSyncStatusBanner({
  linked,
  hasKpiData,
  subtitle,
  compactSuccess = false,
}: Props) {
  const pullInFlight = useMobileSnapshotSyncStore((s) => s.pullInFlight);
  const lastOkAt = useMobileSnapshotSyncStore((s) => s.lastOkAt);
  const lastError = useMobileSnapshotSyncStore((s) => s.lastError);
  const showPull = useDebouncedPullVisible(pullInFlight);

  const lastOkStr = useMemo(() => {
    if (!lastOkAt) return null;
    return new Date(lastOkAt).toLocaleTimeString('fr-FR');
  }, [lastOkAt]);

  if (!linked) return null;

  const waitingKpi = !hasKpiData && !showPull;

  let tone: keyof typeof TONE;
  let title: string;
  let body: string | undefined;

  if (lastError && !showPull) {
    tone = 'err';
    title = 'Synchro interrompue';
    body = lastError;
  } else if (showPull) {
    tone = 'pull';
    title = 'Synchronisation en cours…';
    body =
      'Récupération du snapshot sur le sync-service (équipements + KPI). Les cartes se mettent à jour à la fin du transfert.';
  } else if (waitingKpi) {
    tone = 'wait';
    title = 'En attente des indicateurs bureau';
    body =
      subtitle ??
      'Les fiches équipement sont synchronisées ; les valeurs (PF, THD, énergie…) apparaissent lorsque le desktop aura poussé un snapshot avec KPI calculés.';
  } else {
    tone = 'ok';
    title = 'Indicateurs à jour';
    body = lastOkStr ? `Dernière réception : ${lastOkStr}` : 'Les données affichées proviennent du dernier snapshot bureau.';
  }

  const pulse = tone === 'wait' || tone === 'pull';

  const inner = (
    <View style={[styles.wrap, TONE[tone]]}>
      {tone === 'pull' ? <IndeterminateBar /> : null}
      <View style={styles.row}>
        {tone === 'pull' ? (
          <ActivityIndicator color="#7dd3fc" size="small" />
        ) : tone === 'ok' ? (
          <Ionicons name="checkmark-circle" size={compactSuccess ? 20 : 22} color="#4ade80" />
        ) : tone === 'err' ? (
          <Ionicons name="cloud-offline-outline" size={22} color="#f87171" />
        ) : (
          <Ionicons name="hourglass-outline" size={22} color="#fbbf24" />
        )}
        <View style={styles.textCol}>
          <Text style={[styles.title, compactSuccess && tone === 'ok' && styles.titleCompact]}>{title}</Text>
          {body && !(compactSuccess && tone === 'ok') ? <Text style={styles.body}>{body}</Text> : null}
          {compactSuccess && tone === 'ok' && body ? <Text style={styles.bodyCompact}>{body}</Text> : null}
        </View>
      </View>
    </View>
  );

  return <PulseWrap active={pulse}>{inner}</PulseWrap>;
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 0,
  },
  barTrack: {
    height: 3,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: 'rgba(56,189,248,0.12)',
    marginBottom: 10,
  },
  barGlow: {
    width: 100,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(125,211,252,0.9)',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  textCol: { flex: 1, gap: 6 },
  title: { color: '#f1f5f9', fontSize: 14, fontWeight: '800' },
  titleCompact: { fontSize: 13 },
  body: { color: '#94a3b8', fontSize: 12, lineHeight: 17 },
  bodyCompact: { color: '#64748b', fontSize: 11, marginTop: 2 },
});

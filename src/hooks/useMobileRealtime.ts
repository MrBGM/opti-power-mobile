/**
 * useMobileRealtime — Polling du snapshot temps réel depuis le sync-service.
 *
 * Le desktop MQTT pousse le snapshot toutes les 3 s vers /v1/realtime.
 * Ce hook poll la même route toutes les 3 s pour maintenir les données fraîches.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePairingStore } from '@/store/pairingStore';

export interface SensorReading {
  tag:         string;
  famille:     string;
  description: string;
  valeur:      number;
  unite:       string;
  timestamp:   string;
  qualite:     number;
  sil:         number;
  alarmes?:    Record<string, unknown>;
}

export interface RealtimeState {
  /** map tag → dernière valeur */
  readings:    Map<string, SensorReading>;
  /** alarmes actives */
  alarms:      SensorReading[];
  /** dernière mise à jour du snapshot (côté sync-service) */
  updatedAt:   string | null;
  /** nombre de messages traités par le desktop depuis le dernier push */
  msgCount:    number;
  /** âge du snapshot en millisecondes (depuis updatedAt) */
  snapshotAgeMs: number;
  /** est-ce que le desktop est en train de pousser ? (snapshot < 10 s) */
  isLive:      boolean;
  /** erreur réseau */
  error:       string | null;
  /** polling en cours */
  polling:     boolean;
}

const POLL_INTERVAL_MS = 3000;
const LIVE_THRESHOLD_MS = 10_000; // si snapshot > 10 s → desktop déconnecté

export function useMobileRealtime() {
  const linked       = usePairingStore((s) => s.paired?.status === 'linked');
  const deviceToken  = usePairingStore((s) => s.paired?.deviceToken);
  const syncEndpoint = usePairingStore((s) => s.paired?.cloudApiBase);

  const [state, setState] = useState<RealtimeState>({
    readings:      new Map(),
    alarms:        [],
    updatedAt:     null,
    msgCount:      0,
    snapshotAgeMs: 0,
    isLive:        false,
    error:         null,
    polling:       false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!linked || !deviceToken || !syncEndpoint) return;
    try {
      const url = `${syncEndpoint.replace(/\/$/, '')}/v1/realtime`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${deviceToken}` },
        signal:  AbortSignal.timeout(4000),
      });
      if (!resp.ok) {
        setState((s) => ({ ...s, error: `HTTP ${resp.status}`, polling: false }));
        return;
      }
      const json = (await resp.json()) as {
        success?: boolean;
        readings?: Record<string, SensorReading>;
        alarms?:   SensorReading[];
        updatedAt?: string;
        msgCount?:  number;
      };

      if (!json.success) return;

      const rawReadings = json.readings ?? {};
      const readingsMap = new Map<string, SensorReading>(
        Object.entries(rawReadings),
      );
      const updatedAt = json.updatedAt ?? null;
      const snapshotAgeMs = updatedAt
        ? Date.now() - new Date(updatedAt).getTime()
        : 99_999;

      setState({
        readings:      readingsMap,
        alarms:        json.alarms ?? [],
        updatedAt,
        msgCount:      json.msgCount ?? 0,
        snapshotAgeMs,
        isLive:        snapshotAgeMs < LIVE_THRESHOLD_MS,
        error:         null,
        polling:       true,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        error: (e as Error).message,
        isLive: false,
        polling: false,
      }));
    }
  }, [linked, deviceToken, syncEndpoint]);

  useEffect(() => {
    if (!linked || !deviceToken || !syncEndpoint) {
      setState((s) => ({ ...s, polling: false, isLive: false }));
      return;
    }

    void poll(); // poll immédiat
    intervalRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, linked, deviceToken, syncEndpoint]);

  return state;
}

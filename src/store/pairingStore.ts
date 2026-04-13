import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PairingQrPayload } from '@/lib/pairingPayload';

export interface PairedDesktopState extends PairingQrPayload {
  pairedAt: string;
  /** Après validation desktop : jeton Bearer pour /v1/mobile/* */
  deviceToken?: string;
  /** Dernière révision snapshot équipements reçue du sync-service */
  lastEquipmentsRevision?: number;
  /** Statut handshake : pending = claim OK, attente desktop ; linked = token reçu */
  status: 'pending' | 'linked';
}

interface PairingStore {
  paired: PairedDesktopState | null;
  setPairedFromPayload: (payload: PairingQrPayload) => void;
  setLinkedWithDeviceToken: (deviceToken: string) => void;
  setLastEquipmentsRevision: (revision: number) => void;
  clearPairing: () => void;
}

export const usePairingStore = create<PairingStore>()(
  persist(
    (set) => ({
      paired: null,
      setPairedFromPayload: (payload) =>
        set({
          paired: {
            ...payload,
            pairedAt: new Date().toISOString(),
            status: 'pending',
          },
        }),
      setLinkedWithDeviceToken: (deviceToken) =>
        set((state) => ({
          paired: state.paired
            ? { ...state.paired, deviceToken, status: 'linked' as const }
            : null,
        })),
      setLastEquipmentsRevision: (revision) =>
        set((state) => ({
          paired: state.paired ? { ...state.paired, lastEquipmentsRevision: revision } : null,
        })),
      clearPairing: () => set({ paired: null }),
    }),
    {
      name: 'opti-power-mobile-pairing',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ paired: s.paired }),
    }
  )
);

/** Base URL du sync-service : priorité URL issue du QR, puis variable d'environnement. */
export function getPairedCloudApiBase(): string | null {
  const o = usePairingStore.getState().paired?.cloudApiBase?.trim();
  return o ? o.replace(/\/$/, '') : null;
}

/** Base URL du auth-service : priorité authApiBase du QR, sinon cloudApiBase, sinon null. */
export function getPairedAuthApiBase(): string | null {
  const paired = usePairingStore.getState().paired;
  const auth = paired?.authApiBase?.trim();
  if (auth) return auth.replace(/\/$/, '');
  // Fallback : si authApiBase absent du QR (vieux format), tenter de dériver depuis cloudApiBase
  // en remplaçant le port 3002 par 3001 (convention dev par défaut).
  const sync = paired?.cloudApiBase?.trim();
  if (sync) {
    const derived = sync.replace(/:3002$/, ':3001');
    return derived.replace(/\/$/, '');
  }
  return null;
}

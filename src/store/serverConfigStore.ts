/**
 * Store persistant pour la configuration manuelle du serveur.
 * Permet de changer l'IP sans modifier le .env ni redemarrer l'app.
 *
 * Priorite dans env.ts :
 *   1) customIp de ce store  (saisie manuelle dans l'app)
 *   2) cloudApiBase / authApiBase du QR d'appairage
 *   3) variables EXPO_PUBLIC_*
 *   4) URL publique par defaut
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface ServerConfigStore {
  /** Adresse IP ou hostname saisi par l'utilisateur (ex: "172.20.10.2"). Null = non configure. */
  customIp: string | null;
  /** Port sync-service (defaut 3002) */
  syncPort: number;
  /** Port auth-service (defaut 3001) */
  authPort: number;
  setCustomIp: (ip: string | null) => void;
  setSyncPort: (port: number) => void;
  setAuthPort: (port: number) => void;
  clearCustomServer: () => void;
}

export const useServerConfigStore = create<ServerConfigStore>()(
  persist(
    (set) => ({
      customIp: null,
      syncPort: 3002,
      authPort: 3001,
      setCustomIp: (ip) =>
        set({ customIp: ip ? ip.trim().replace(/\/$/, '') : null }),
      setSyncPort: (port) => set({ syncPort: port }),
      setAuthPort: (port) => set({ authPort: port }),
      clearCustomServer: () => set({ customIp: null, syncPort: 3002, authPort: 3001 }),
    }),
    {
      name: 'opti-power-server-config',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        customIp: s.customIp,
        syncPort: s.syncPort,
        authPort: s.authPort,
      }),
    }
  )
);

/**
 * Retourne l'URL base du sync-service depuis la config manuelle, ou null si non configure.
 * Ex: "http://172.20.10.2:3002"
 */
export function getCustomSyncBase(): string | null {
  const { customIp, syncPort } = useServerConfigStore.getState();
  if (!customIp) return null;
  return `http://${customIp}:${syncPort}`;
}

/**
 * Retourne l'URL base du auth-service depuis la config manuelle, ou null si non configure.
 * Ex: "http://172.20.10.2:3001"
 */
export function getCustomAuthBase(): string | null {
  const { customIp, authPort } = useServerConfigStore.getState();
  if (!customIp) return null;
  return `http://${customIp}:${authPort}`;
}

/** Indique la source active de la configuration serveur (pour affichage UI). */
export type ServerSource = 'custom' | 'pairing' | 'env' | 'default';

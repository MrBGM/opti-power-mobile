import { create } from 'zustand';

/**
 * État visuel de la synchro snapshot bureau ↔ sync-service (hors React Query).
 * Mis à jour dans `applySnapshotIfNewer` pour afficher un indicateur fiable pendant le fetch HTTP.
 */
interface MobileSnapshotSyncStore {
  pullDepth: number;
  pullInFlight: boolean;
  lastOkAt: number | null;
  lastError: string | null;
  beginPull: () => void;
  endPullSuccess: () => void;
  endPullError: (message: string) => void;
}

export const useMobileSnapshotSyncStore = create<MobileSnapshotSyncStore>((set) => ({
  pullDepth: 0,
  pullInFlight: false,
  lastOkAt: null,
  lastError: null,
  beginPull: () =>
    set((s) => ({
      pullDepth: s.pullDepth + 1,
      pullInFlight: true,
    })),
  endPullSuccess: () =>
    set((s) => {
      const pullDepth = Math.max(0, s.pullDepth - 1);
      return {
        pullDepth,
        pullInFlight: pullDepth > 0,
        ...(pullDepth === 0 ? { lastOkAt: Date.now(), lastError: null } : {}),
      };
    }),
  endPullError: (message) =>
    set((s) => {
      const pullDepth = Math.max(0, s.pullDepth - 1);
      return {
        pullDepth,
        pullInFlight: pullDepth > 0,
        lastError: message,
      };
    }),
}));

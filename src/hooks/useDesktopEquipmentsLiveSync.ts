import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchMobileEquipmentsSnapshot } from '@/api/mobileSync';
import { replaceDesktopAlertsSnapshot } from '@/storage/alertsRepo';
import { replaceDesktopKpisAndStats } from '@/storage/desktopSyncRepo';
import { dtoToEquipment, replaceDesktopEquipmentsSnapshot } from '@/storage/equipmentsRepo';
import { useMobileSnapshotSyncStore } from '@/store/mobileSnapshotSyncStore';
import { usePairingStore } from '@/store/pairingStore';

async function applySnapshotIfNewer(
  deviceToken: string,
  queryClient: QueryClient,
  force: boolean
): Promise<void> {
  const syncUi = useMobileSnapshotSyncStore.getState();
  syncUi.beginPull();
  try {
    const snap = await fetchMobileEquipmentsSnapshot(deviceToken);
    if (!force) {
      const prev = usePairingStore.getState().paired?.lastEquipmentsRevision ?? -1;
      if (snap.revision === prev) {
        syncUi.endPullSuccess();
        return;
      }
    }
    const eqs = snap.equipments.map(dtoToEquipment);
    await replaceDesktopEquipmentsSnapshot(eqs);
    await replaceDesktopKpisAndStats(snap.kpisByEquipmentId, snap.measurementStatsByEquipmentId);
    await replaceDesktopAlertsSnapshot(snap.alertsSnapshot ?? []);
    usePairingStore.getState().setLastEquipmentsRevision(snap.revision);
    await queryClient.invalidateQueries({ queryKey: ['local', 'equipments'] });
    await queryClient.invalidateQueries({ queryKey: ['local', 'desktop-kpi-bundle'] });
    await queryClient.invalidateQueries({ queryKey: ['local', 'alerts'] });
    syncUi.endPullSuccess();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de synchronisation';
    syncUi.endPullError(msg);
    throw e;
  }
}

/**
 * Rafraîchit équipements + KPI depuis le sync-service (ignore la révision — utile au pull-to-refresh).
 */
export async function pullMobileSnapshotForce(
  queryClient: QueryClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  const deviceToken = usePairingStore.getState().paired?.deviceToken;
  const linked = usePairingStore.getState().paired?.status === 'linked';
  if (!deviceToken || !linked) {
    return { ok: false, error: 'Appareil non appairé ou lien non validé.' };
  }
  try {
    await applySnapshotIfNewer(deviceToken, queryClient, true);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur de synchronisation';
    console.warn('[pullMobileSnapshotForce]', e);
    return { ok: false, error: msg };
  }
}

/**
 * Poll le sync-service quand un `deviceToken` est disponible (post-validation desktop).
 * Monté au niveau du drawer principal pour que le tableau de bord et le détail équipement
 * reçoivent les KPI même sans ouvrir la liste « Équipements ».
 */
export function useDesktopEquipmentsLiveSync(pollMs = 3500) {
  const queryClient = useQueryClient();
  const deviceToken = usePairingStore((s) => s.paired?.deviceToken);
  const linked = usePairingStore((s) => s.paired?.status === 'linked');

  useEffect(() => {
    if (!deviceToken || !linked) return;

    let cancelled = false;
    const tick = async () => {
      try {
        if (cancelled) return;
        await applySnapshotIfNewer(deviceToken, queryClient, false);
      } catch (e) {
        console.warn('[useDesktopEquipmentsLiveSync]', e);
      }
    };

    void tick();
    const id = setInterval(() => void tick(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [deviceToken, linked, pollMs, queryClient]);
}

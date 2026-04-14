import { getCloudApiBase } from '@/config/env';
import { refreshCloudToken } from '@/lib/authApi';
import { useAuthStore } from '@/store/authStore';

export interface MobileEquipmentSyncDto {
  id: string;
  name: string;
  site?: string | null;
  powerSource?: string | null;
  criticality?: string | null;
  type?: string | null;
  status?: string | null;
  createdAt: string;
  updatedAt: string;
  detail?: Record<string, unknown>;
}

export interface MobileAlertDto {
  id: string;
  title: string;
  equipmentId: string;
  equipmentName: string | null;
  severity: 'warning' | 'critical' | 'info';
  status: 'active' | 'acknowledged';
  triggeredAt: string;
}

export interface MobileEquipmentsSnapshotResponse {
  success: boolean;
  revision: number;
  updatedAt: string | null;
  equipments: MobileEquipmentSyncDto[];
  kpisByEquipmentId: Record<string, unknown>;
  measurementStatsByEquipmentId: Record<string, unknown>;
  alertsSnapshot?: MobileAlertDto[];
}

async function doFetchSnapshot(deviceToken: string): Promise<Response> {
  const base = getCloudApiBase().replace(/\/$/, '');
  return fetch(`${base}/v1/mobile/equipments`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${deviceToken}`,
      Accept: 'application/json',
    },
  });
}

function parseSnapshotResponse(raw: MobileEquipmentsSnapshotResponse): MobileEquipmentsSnapshotResponse {
  if (!raw.success || !Array.isArray(raw.equipments)) {
    throw new Error('Réponse sync invalide');
  }
  return {
    ...raw,
    kpisByEquipmentId:
      raw.kpisByEquipmentId && typeof raw.kpisByEquipmentId === 'object' && !Array.isArray(raw.kpisByEquipmentId)
        ? raw.kpisByEquipmentId
        : {},
    measurementStatsByEquipmentId:
      raw.measurementStatsByEquipmentId &&
      typeof raw.measurementStatsByEquipmentId === 'object' &&
      !Array.isArray(raw.measurementStatsByEquipmentId)
        ? raw.measurementStatsByEquipmentId
        : {},
    // undefined = serveur n'a pas encore de snapshot → ne pas toucher aux alertes locales
    alertsSnapshot: Array.isArray(raw.alertsSnapshot) ? raw.alertsSnapshot : undefined,
  };
}

export async function fetchMobileEquipmentsSnapshot(deviceToken: string): Promise<MobileEquipmentsSnapshotResponse> {
  let res = await doFetchSnapshot(deviceToken);

  // Intercepteur 401 : tenter un refresh de l'accessToken JWT cloud puis réessayer.
  // Note : deviceToken est le jeton d'appairage (long-lived), distinct du cloudToken JWT.
  // Le 401 sur /v1/mobile/equipments indique que le deviceToken est révoqué → pas de refresh possible.
  // En revanche, si l'on utilise le cloudToken pour d'autres appels, on peut refresh.
  // Ici on tente quand même d'utiliser le refreshToken de la session auth pour obtenir un nouveau cloudToken
  // et on relance : certaines implémentations du sync-service vérifient le Bearer cloudToken.
  if (res.status === 401) {
    const session = useAuthStore.getState().session;
    const rt = session?.refreshToken;
    if (rt) {
      const refreshed = await refreshCloudToken(rt);
      if (refreshed.success && refreshed.cloudToken) {
        useAuthStore.getState().refreshSession(refreshed.cloudToken, refreshed.refreshToken);
        // Relancer avec le même deviceToken (le 401 vient peut-être du cloudToken sur un autre endpoint)
        res = await doFetchSnapshot(deviceToken);
      }
    }
    if (res.status === 401) {
      // Le deviceToken est révoqué ou la session est expirée -- forcer déconnexion
      useAuthStore.getState().clearSession();
      throw new Error("Jeton mobile invalide ou session révoquée. Réappairez l'appareil.");
    }
  }

  if (!res.ok) {
    throw new Error(`Sync équipements (${res.status})`);
  }
  const raw = (await res.json()) as MobileEquipmentsSnapshotResponse;
  return parseSnapshotResponse(raw);
}

import { getPairedAuthApiBase, getPairedCloudApiBase } from '@/store/pairingStore';
import { getCustomAuthBase, getCustomSyncBase } from '@/store/serverConfigStore';

/** URL de type loopback dans le QR (sync sans SYNC_PUBLIC_URL) — inutilisable depuis le téléphone. */
function isLoopbackApiUrl(url: string): boolean {
  const trimmed = url.trim();
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const u = new URL(withProto);
    const h = u.hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return trimmed.includes('localhost') || trimmed.includes('127.0.0.1');
  }
}

/**
 * Base URL du sync-service (sans slash final).
 * Priorite :
 *   1) IP saisie manuellement dans l'app (serverConfigStore)  <-- NOUVEAU
 *   2) cloudApiBase du QR d'appairage
 *   3) EXPO_PUBLIC_SYNC_API_URL / EXPO_PUBLIC_CLOUD_API_URL
 *   4) URL publique par defaut
 */
export function getCloudApiBase(): string {
  const fromCustom = getCustomSyncBase();
  if (fromCustom) return fromCustom;

  const fromPairingRaw = getPairedCloudApiBase();
  const fromPairing =
    fromPairingRaw && !isLoopbackApiUrl(fromPairingRaw) ? fromPairingRaw.replace(/\/$/, '') : null;
  const fromEnv =
    (typeof process !== 'undefined' &&
      (process.env?.EXPO_PUBLIC_SYNC_API_URL?.trim() ||
       process.env?.EXPO_PUBLIC_CLOUD_API_URL?.trim())) ||
    '';
  const raw = fromPairing || fromEnv || 'https://api.optipower.bf';
  return raw.replace(/\/$/, '');
}

/**
 * Base URL du auth-service (sans slash final).
 * Priorite :
 *   1) IP saisie manuellement dans l'app (serverConfigStore)  <-- NOUVEAU
 *   2) authApiBase du QR d'appairage
 *   3) EXPO_PUBLIC_AUTH_API_URL
 *   4) getCloudApiBase() en dernier recours
 */
export function getAuthCloudApiBase(): string {
  const fromCustom = getCustomAuthBase();
  if (fromCustom) return fromCustom;

  const fromPairingRaw = getPairedAuthApiBase();
  const fromPairing =
    fromPairingRaw && !isLoopbackApiUrl(fromPairingRaw) ? fromPairingRaw.replace(/\/$/, '') : null;
  if (fromPairing) return fromPairing;

  const fromEnv =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_AUTH_API_URL?.trim()) || '';
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  return getCloudApiBase();
}

/** Auth-service Opti Power : routes sous `/api/v1/auth`. */
export function getAuthApiBasePath(): string {
  return `${getAuthCloudApiBase()}/api/v1/auth`;
}

export const CLOUD_TIMEOUT_MS = 12_000;

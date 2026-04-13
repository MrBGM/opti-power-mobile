/**
 * Payload QR d’appairage — aligné sur BLUEPRINT_MOBILE_E2E.md §8.2
 * (session desktop, identité, endpoint mailbox / cloud).
 */

export interface PairingQrPayload {
  pairingSessionId: string;
  desktopDeviceId: string;
  desktopPublicKeys?: { sign?: string; kex?: string };
  /** Base URL du sync-service (ex: http://192.168.1.10:3002) — utilisé pour /v1/mobile/* et /v1/pairing/* */
  cloudApiBase?: string;
  /** Base URL du auth-service (ex: http://192.168.1.10:3001) — utilisé pour /api/v1/auth/* */
  authApiBase?: string;
  mailboxEndpoint?: string;
  capabilities?: string[];
  /** Version du schéma pour évolutions */
  schemaVersion?: number;
}

export function parsePairingPayload(raw: string): PairingQrPayload {
  const trimmed = raw.trim();
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    throw new Error('Le contenu doit être un JSON valide (QR ou texte collé).');
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('Payload invalide.');
  }
  const p = obj as Record<string, unknown>;
  const pairingSessionId = String(p.pairingSessionId ?? p.sessionId ?? '');
  const desktopDeviceId = String(p.desktopDeviceId ?? '');
  if (!pairingSessionId || !desktopDeviceId) {
    throw new Error('QR incomplet : pairingSessionId et desktopDeviceId sont requis.');
  }
  // cloudApiBase = URL du sync-service (pour /v1/mobile/* et /v1/pairing/*)
  const cloudApiBaseRaw = p.cloudApiBase ?? p.endpoint;
  const cloudApiBase = cloudApiBaseRaw != null ? String(cloudApiBaseRaw).replace(/\/$/, '') : undefined;
  // authApiBase = URL du auth-service (pour /api/v1/auth/*), distinct du sync-service en dev
  const authApiBaseRaw = p.authApiBase;
  const authApiBase = authApiBaseRaw != null ? String(authApiBaseRaw).replace(/\/$/, '') : undefined;
  const mailboxEndpoint =
    p.mailboxEndpoint != null ? String(p.mailboxEndpoint).replace(/\/$/, '') : undefined;
  return {
    pairingSessionId,
    desktopDeviceId,
    desktopPublicKeys:
      p.desktopPublicKeys && typeof p.desktopPublicKeys === 'object'
        ? (p.desktopPublicKeys as PairingQrPayload['desktopPublicKeys'])
        : undefined,
    cloudApiBase: cloudApiBase || undefined,
    authApiBase: authApiBase || undefined,
    mailboxEndpoint: mailboxEndpoint || undefined,
    capabilities: Array.isArray(p.capabilities) ? (p.capabilities as string[]).map(String) : undefined,
    schemaVersion: typeof p.schemaVersion === 'number' ? p.schemaVersion : undefined,
  };
}

/**
 * Payload QR d’appairage — aligné sur BLUEPRINT_MOBILE_E2E.md §8.2
 * (session desktop, identité, endpoint mailbox / cloud).
 */

function stripBom(s: string): string {
  if (s.length > 0 && s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

/**
 * Récupère la chaîne utile depuis le callback expo-camera v17.
 *
 * expo-camera v17 (Expo SDK 54) : _onObjectDetected extrait nativeEvent en interne et
 * appelle notre callback avec directement un BarcodeScanningResult :
 *   { type: string, data: string, raw?: string, cornerPoints: [...], bounds: {...} }
 *
 * On conserve les fallbacks legacy (nativeEvent, raw) pour compatibilité.
 */
export function barcodeScanResultToString(result: unknown): string {
  if (result == null) return '';
  if (typeof result === 'string') return result.trim();
  if (typeof result !== 'object') return '';
  const o = result as Record<string, unknown>;
  // expo-camera v17 : data est directement sur l'objet
  const d = o['data'];
  if (typeof d === 'string' && d.length > 0) return d.trim();
  // Fallback raw (Android)
  const r = o['raw'];
  if (typeof r === 'string' && r.length > 0) return r.trim();
  // Legacy : nativeEvent wrapper (versions antérieures)
  if (o['nativeEvent'] && typeof o['nativeEvent'] === 'object') {
    const ne = o['nativeEvent'] as Record<string, unknown>;
    const nd = ne['data'];
    const nr = ne['raw'];
    if (typeof nd === 'string' && nd.length > 0) return nd.trim();
    if (typeof nr === 'string' && nr.length > 0) return nr.trim();
  }
  return '';
}

/** Extrait un objet JSON même si le scan a ajouté des caractères avant/après. */
export function extractPairingJsonString(raw: string): string {
  const s = stripBom(raw.trim());
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

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
  const jsonSlice = extractPairingJsonString(raw);
  let obj: unknown;
  try {
    obj = JSON.parse(jsonSlice);
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

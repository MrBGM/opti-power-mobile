/**
 * Client d'authentification mobile -- compatible auth-service Opti Power
 * (`POST /api/v1/auth/login`, corps `{ email, password }`, réponse `{ success, data }`).
 */

import { CLOUD_TIMEOUT_MS, getAuthApiBasePath, getAuthCloudApiBase } from '@/config/env';

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export type LoginMode = 'cloud' | 'local';

export interface LoginApiResult {
  success: boolean;
  mode?: LoginMode;
  cloudToken?: string;
  refreshToken?: string;
  user?: AuthUser;
  error?: string;
}

export interface RefreshApiResult {
  success: boolean;
  cloudToken?: string;
  refreshToken?: string;
  error?: string;
}

type AuthServiceUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
};

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return new Date().toISOString();
}

function mapServiceUserToAuthUser(u: AuthServiceUser): AuthUser {
  const roleRaw = String(u.role ?? 'viewer').toLowerCase();
  const role: UserRole = ['admin', 'manager', 'operator', 'viewer'].includes(roleRaw)
    ? (roleRaw as UserRole)
    : 'viewer';
  const createdAt = toIso(u.createdAt);
  const updatedAt = toIso(u.updatedAt ?? u.createdAt);
  return {
    id: u.id,
    username: u.email?.split('@')[0] ?? u.id,
    email: u.email ?? null,
    fullName: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email,
    role,
    isActive: u.status === 'active',
    permissions: [],
    createdAt,
    updatedAt,
    lastLoginAt: new Date().toISOString(),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

function networkHint(): string {
  const base = getAuthCloudApiBase();
  if (base.includes('localhost') || base.includes('127.0.0.1')) {
    return " L'URL pointe vers localhost : depuis un téléphone utilisez l'IP LAN du PC (ex. http://192.168.1.10:3001) via le QR d'appairage ou EXPO_PUBLIC_CLOUD_API_URL.";
  }
  return " Vérifiez le Wi-Fi, l'URL du serveur (écran Appairage / .env) et que auth-service écoute sur 0.0.0.0.";
}

/**
 * Connexion cloud -- `email` doit correspondre au compte (ex. démo auth-service : demo@optipower.bf).
 */
export async function loginCloud(email: string, password: string): Promise<LoginApiResult> {
  const loginUrl = `${getAuthApiBasePath()}/login`;
  try {
    const resp = await fetchWithTimeout(
      loginUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      },
      CLOUD_TIMEOUT_MS
    );

    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;

    if (!resp.ok) {
      const msg =
        (json.error as { message?: string } | undefined)?.message ??
        (json.message as string | undefined) ??
        `Erreur serveur (${resp.status})`;
      return { success: false, error: msg };
    }

    if (json.success === true && json.data && typeof json.data === 'object') {
      const data = json.data as {
        user?: AuthServiceUser;
        tokens?: { accessToken?: string; refreshToken?: string };
      };
      if (data.user && data.tokens?.accessToken) {
        return {
          success: true,
          mode: 'cloud',
          cloudToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          user: mapServiceUserToAuthUser(data.user),
        };
      }
    }

    const legacy = json as {
      accessToken?: string;
      user?: AuthServiceUser;
    };
    if (legacy.accessToken && legacy.user) {
      return {
        success: true,
        mode: 'cloud',
        cloudToken: legacy.accessToken,
        user: mapServiceUserToAuthUser(legacy.user),
      };
    }

    return {
      success: false,
      error: 'Réponse serveur inattendue -- vérifiez la version auth-service.',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Réseau indisponible';
    if (msg === 'The user aborted a request.' || msg.includes('aborted')) {
      return {
        success: false,
        error: `Délai dépassé (${CLOUD_TIMEOUT_MS / 1000}s) -- serveur injoignable.${networkHint()}`,
      };
    }
    return {
      success: false,
      error: `Impossible de joindre le cloud (${msg}).${networkHint()}`,
    };
  }
}

/**
 * Renouvelle l'accessToken via le refreshToken.
 * Retourne les nouveaux tokens ou { success: false } si le refresh token est expiré/invalide.
 */
export async function refreshCloudToken(refreshToken: string): Promise<RefreshApiResult> {
  const refreshUrl = `${getAuthApiBasePath()}/refresh`;
  try {
    const resp = await fetchWithTimeout(
      refreshUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      },
      CLOUD_TIMEOUT_MS
    );
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) return { success: false, error: `Refresh échoué (${resp.status})` };
    if (json.success === true && json.data && typeof json.data === 'object') {
      const tokens = json.data as { accessToken?: string; refreshToken?: string };
      if (tokens.accessToken) {
        return { success: true, cloudToken: tokens.accessToken, refreshToken: tokens.refreshToken };
      }
    }
    return { success: false, error: 'Réponse refresh inattendue' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Réseau indisponible';
    return { success: false, error: msg };
  }
}

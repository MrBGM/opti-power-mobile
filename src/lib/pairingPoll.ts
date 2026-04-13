/**
 * Attend la validation desktop (POST /pairing/approve) en interrogeant la session.
 */

/** Une seule lecture : utile si /claim renvoie déjà « session approuvée » (rescan du même QR). */
export async function fetchApprovedPairingSession(
  baseUrl: string,
  sessionId: string
): Promise<{ deviceToken: string; approvedAt?: string }> {
  const root = baseUrl.replace(/\/$/, '');
  const res = await fetch(`${root}/v1/pairing/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    throw new Error(`Lecture statut session (${res.status})`);
  }
  const data = (await res.json()) as {
    status?: string;
    deviceToken?: string;
    approvedAt?: string;
  };
  if (data.status === 'approved' && data.deviceToken) {
    return { deviceToken: data.deviceToken, approvedAt: data.approvedAt };
  }
  if (data.status === 'expired') {
    throw new Error('Session d’appairage expirée');
  }
  throw new Error('Session non approuvée ou jeton indisponible. Générez un nouveau code sur le bureau.');
}

export async function pollPairingSessionApproved(
  baseUrl: string,
  sessionId: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
): Promise<{ deviceToken: string; approvedAt?: string }> {
  const interval = opts?.intervalMs ?? 2000;
  const timeout = opts?.timeoutMs ?? 9 * 60 * 1000;
  const root = baseUrl.replace(/\/$/, '');
  const started = Date.now();

  while (Date.now() - started < timeout) {
    const res = await fetch(`${root}/v1/pairing/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) {
      throw new Error(`Lecture statut session (${res.status})`);
    }
    const data = (await res.json()) as {
      status?: string;
      deviceToken?: string;
      approvedAt?: string;
    };
    if (data.status === 'approved' && data.deviceToken) {
      return { deviceToken: data.deviceToken, approvedAt: data.approvedAt };
    }
    if (data.status === 'expired') {
      throw new Error('Session d’appairage expirée');
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error('Délai dépassé : validez l’appairage sur le desktop.');
}

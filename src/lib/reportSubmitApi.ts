/**
 * reportSubmitApi — Client HTTP pour soumettre des rapports terrain au superviseur
 *
 * Flux : Mobile → sync-service (POST /v1/reports) → Desktop (polling) → Base locale → Revue superviseur
 * Le technicien peut ensuite consulter l'état de sa revue (GET /v1/reports).
 */

import type { VoiceReport } from '@/storage/voiceReportsRepo';

const TIMEOUT_MS = 10_000;

interface SubmitResult {
  success:       boolean;
  cloudReportId?: string;
  duplicate?:    boolean;
  error?:        string;
}

interface ReviewStatus {
  id:          string;
  localReportId: string;
  status:      'pending' | 'accepted' | 'rejected';
  reviewNote:  string | null;
  reviewedAt:  string | null;
  reviewedBy:  string | null;
}

/** AbortSignal.timeout() n'existe pas dans Hermes (React Native) — polyfill via AbortController. */
function withTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

/**
 * Soumet un rapport vocal au sync-service pour revue par le superviseur.
 */
export async function submitReportToSupervisor(
  syncEndpoint: string,
  deviceToken:  string,
  report:       VoiceReport,
  technician:   { name: string; email: string; userId: string },
): Promise<SubmitResult> {
  const { signal, clear } = withTimeout(TIMEOUT_MS);
  try {
    const url = `${syncEndpoint.replace(/\/$/, '')}/v1/reports`;
    const resp = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({
        localReportId:    report.id,
        technicianUserId: technician.userId,
        technicianName:   technician.name,
        technicianEmail:  technician.email,
        equipmentName:    report.equipmentName ?? null,
        transcription:    report.transcription,
        structuredJson:   report.structuredJson,
        durationMs:       report.durationMs,
      }),
      signal,
    });

    const json = (await resp.json().catch(() => ({}))) as {
      success?: boolean;
      reportId?: string;
      duplicate?: boolean;
      error?: string;
    };

    if (!resp.ok || json.success === false) {
      return { success: false, error: json.error ?? `HTTP ${resp.status}` };
    }

    clear();
    return { success: true, cloudReportId: json.reportId, duplicate: json.duplicate };
  } catch (e) {
    clear();
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Récupère le statut de revue de tous les rapports soumis par cet appareil.
 */
export async function fetchMyReportStatuses(
  syncEndpoint: string,
  deviceToken:  string,
): Promise<ReviewStatus[]> {
  const { signal, clear } = withTimeout(TIMEOUT_MS);
  try {
    const url = `${syncEndpoint.replace(/\/$/, '')}/v1/reports`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${deviceToken}` },
      signal,
    });
    clear();
    if (!resp.ok) return [];
    const json = (await resp.json().catch(() => ({}))) as { reports?: ReviewStatus[] };
    return json.reports ?? [];
  } catch {
    clear();
    return [];
  }
}

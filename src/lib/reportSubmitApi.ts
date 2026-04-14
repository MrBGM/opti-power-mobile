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

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
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
      signal: withTimeout(TIMEOUT_MS),
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

    return { success: true, cloudReportId: json.reportId, duplicate: json.duplicate };
  } catch (e) {
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
  try {
    const url = `${syncEndpoint.replace(/\/$/, '')}/v1/reports`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${deviceToken}` },
      signal:  withTimeout(TIMEOUT_MS),
    });
    if (!resp.ok) return [];
    const json = (await resp.json().catch(() => ({}))) as { reports?: ReviewStatus[] };
    return json.reports ?? [];
  } catch {
    return [];
  }
}

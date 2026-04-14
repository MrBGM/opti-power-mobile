import { getDb } from '@/storage/db';

export interface VoiceReport {
  id: string;
  equipmentId: string | null;
  equipmentName: string | null;
  audioUri: string | null;
  /** Pistes audio complémentaires (même rapport, ordre chronologique). */
  extraAudioUris: string[];
  transcription: string;
  structuredJson: StructuredReport;
  durationMs: number;
  imageUris: string[];
  /** 'draft' | 'saved' */
  status: string;
  createdAt: string;
  updatedAt: string;
  /** ID du rapport côté sync-service après soumission au superviseur */
  cloudReportId: string | null;
  /** Horodatage de soumission au superviseur */
  submittedAt: string | null;
  /** Statut de la revue : null | 'pending' | 'accepted' | 'rejected' */
  reviewStatus: string | null;
  /** Motif du superviseur (renseigné si rejected) */
  reviewNote: string | null;
}

/** Découpage détaillé type rapport de maintenance (affichage modal note vocale). */
export interface StructuredReportMiningSections {
  objet: string[];
  constats: string[];
  mesures: string[];
  travaux: string[];
  recommandations: string[];
}

/** Séries extraites pour mini-graphiques (mesures comparables). */
export interface ReportChartSeries {
  title: string;
  unit: string;
  labels: string[];
  values: number[];
}

export interface StructuredReport {
  observations: string[];
  anomalies: string[];
  consumption: string[];
  actions: string[];
  rawText: string;
  _sections?: StructuredReportMiningSections;
  charts?: ReportChartSeries[];
}

export async function saveVoiceReport(r: VoiceReport): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO voice_reports
      (id, equipment_id, equipment_name, audio_uri, extra_audio_uris, transcription, structured_json, duration_ms, image_uris, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       equipment_id      = excluded.equipment_id,
       equipment_name    = excluded.equipment_name,
       audio_uri         = excluded.audio_uri,
       extra_audio_uris  = excluded.extra_audio_uris,
       transcription     = excluded.transcription,
       structured_json   = excluded.structured_json,
       duration_ms       = excluded.duration_ms,
       image_uris        = excluded.image_uris,
       status            = excluded.status,
       updated_at        = excluded.updated_at`,
    [
      r.id,
      r.equipmentId ?? null,
      r.equipmentName ?? null,
      r.audioUri ?? null,
      JSON.stringify(r.extraAudioUris ?? []),
      r.transcription,
      JSON.stringify(r.structuredJson),
      r.durationMs,
      JSON.stringify(r.imageUris ?? []),
      r.status,
      r.createdAt,
      r.updatedAt,
    ]
  );
}

export async function listVoiceReports(opts?: { equipmentId?: string }): Promise<VoiceReport[]> {
  const db = await getDb();
  const rows = opts?.equipmentId
    ? await db.getAllAsync<Row>(
        `SELECT * FROM voice_reports WHERE equipment_id = ? ORDER BY created_at DESC`,
        opts.equipmentId
      )
    : await db.getAllAsync<Row>(
        `SELECT * FROM voice_reports ORDER BY created_at DESC`
      );
  return rows.map(rowToVoiceReport);
}

export async function deleteVoiceReport(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM voice_reports WHERE id = ?`, id);
}

/** Met à jour les champs de soumission/revue sans toucher au reste */
export async function updateVoiceReportSubmission(
  id: string,
  data: { cloudReportId?: string; submittedAt?: string; reviewStatus?: string; reviewNote?: string | null },
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE voice_reports
     SET cloud_report_id = COALESCE(?, cloud_report_id),
         submitted_at    = COALESCE(?, submitted_at),
         review_status   = COALESCE(?, review_status),
         review_note     = ?,
         updated_at      = ?
     WHERE id = ?`,
    [
      data.cloudReportId ?? null,
      data.submittedAt   ?? null,
      data.reviewStatus  ?? null,
      data.reviewNote    ?? null,
      new Date().toISOString(),
      id,
    ],
  );
}

type Row = {
  id: string;
  equipment_id: string | null;
  equipment_name: string | null;
  audio_uri: string | null;
  extra_audio_uris?: string | null;
  transcription: string;
  structured_json: string;
  duration_ms: number;
  image_uris?: string;
  status: string;
  created_at: string;
  updated_at: string;
  cloud_report_id?: string | null;
  submitted_at?: string | null;
  review_status?: string | null;
  review_note?: string | null;
};

function rowToVoiceReport(r: Row): VoiceReport {
  let structured: StructuredReport = { observations: [], anomalies: [], consumption: [], actions: [], rawText: '' };
  try { structured = JSON.parse(r.structured_json) as StructuredReport; } catch { /* ignore */ }
  let imageUris: string[] = [];
  try { imageUris = JSON.parse(r.image_uris ?? '[]') as string[]; } catch { /* ignore */ }
  let extraAudioUris: string[] = [];
  try {
    extraAudioUris = JSON.parse(r.extra_audio_uris ?? '[]') as string[];
    if (!Array.isArray(extraAudioUris)) extraAudioUris = [];
  } catch { /* ignore */ }
  return {
    id: r.id,
    equipmentId: r.equipment_id,
    equipmentName: r.equipment_name,
    audioUri: r.audio_uri,
    extraAudioUris,
    transcription: r.transcription,
    structuredJson: structured,
    durationMs: r.duration_ms,
    imageUris,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    cloudReportId: r.cloud_report_id ?? null,
    submittedAt:   r.submitted_at   ?? null,
    reviewStatus:  r.review_status  ?? null,
    reviewNote:    r.review_note    ?? null,
  };
}

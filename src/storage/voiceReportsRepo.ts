import { getDb } from '@/storage/db';

export interface VoiceReport {
  id: string;
  equipmentId: string | null;
  equipmentName: string | null;
  audioUri: string | null;
  transcription: string;
  structuredJson: StructuredReport;
  durationMs: number;
  imageUris: string[];
  /** 'draft' | 'saved' */
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StructuredReport {
  observations: string[];
  anomalies: string[];
  consumption: string[];
  actions: string[];
  rawText: string;
}

export async function saveVoiceReport(r: VoiceReport): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO voice_reports
      (id, equipment_id, equipment_name, audio_uri, transcription, structured_json, duration_ms, image_uris, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       equipment_id    = excluded.equipment_id,
       equipment_name  = excluded.equipment_name,
       audio_uri       = excluded.audio_uri,
       transcription   = excluded.transcription,
       structured_json = excluded.structured_json,
       duration_ms     = excluded.duration_ms,
       image_uris      = excluded.image_uris,
       status          = excluded.status,
       updated_at      = excluded.updated_at`,
    [
      r.id,
      r.equipmentId ?? null,
      r.equipmentName ?? null,
      r.audioUri ?? null,
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

type Row = {
  id: string;
  equipment_id: string | null;
  equipment_name: string | null;
  audio_uri: string | null;
  transcription: string;
  structured_json: string;
  duration_ms: number;
  image_uris?: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function rowToVoiceReport(r: Row): VoiceReport {
  let structured: StructuredReport = { observations: [], anomalies: [], consumption: [], actions: [], rawText: '' };
  try { structured = JSON.parse(r.structured_json) as StructuredReport; } catch { /* ignore */ }
  let imageUris: string[] = [];
  try { imageUris = JSON.parse(r.image_uris ?? '[]') as string[]; } catch { /* ignore */ }
  return {
    id: r.id,
    equipmentId: r.equipment_id,
    equipmentName: r.equipment_name,
    audioUri: r.audio_uri,
    transcription: r.transcription,
    structuredJson: structured,
    durationMs: r.duration_ms,
    imageUris,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

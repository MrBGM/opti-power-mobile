import * as SQLite from 'expo-sqlite';

type Db = SQLite.SQLiteDatabase;

let dbPromise: Promise<Db> | null = null;

export async function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('opti-power-mobile.db');
  }
  return dbPromise;
}

export async function migrateDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      type TEXT NOT NULL,
      device_id TEXT NOT NULL,
      lamport INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      header_json TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      nonce TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

    CREATE TABLE IF NOT EXISTS equipments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      site TEXT,
      power_source TEXT,
      criticality TEXT,
      equipment_type TEXT,
      db_status TEXT,
      sync_payload TEXT,
      synced_from_desktop INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    /* Projection alertes (blueprint §5–6) — alimentée par events / seed démo V1 */
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      equipment_id TEXT,
      equipment_name TEXT,
      severity TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      triggered_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_equipment ON alerts(equipment_id);

    /* Notes vocales terrain (enregistrement audio + transcription + rapport structure) */
    CREATE TABLE IF NOT EXISTS voice_reports (
      id TEXT PRIMARY KEY,
      equipment_id TEXT,
      equipment_name TEXT,
      audio_uri TEXT,
      transcription TEXT NOT NULL DEFAULT '',
      structured_json TEXT NOT NULL DEFAULT '{}',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_voice_reports_equipment ON voice_reports(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_voice_reports_created ON voice_reports(created_at);
  `);

  await ensureEquipmentColumns(db);
  await ensureVoiceReportColumns(db);
}

async function ensureVoiceReportColumns(db: Db): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>('PRAGMA table_info(voice_reports)');
  const names = new Set(rows.map((r) => r.name));
  if (!names.has('image_uris')) {
    await db.execAsync("ALTER TABLE voice_reports ADD COLUMN image_uris TEXT NOT NULL DEFAULT '[]';");
  }
  if (!names.has('extra_audio_uris')) {
    await db.execAsync("ALTER TABLE voice_reports ADD COLUMN extra_audio_uris TEXT NOT NULL DEFAULT '[]';");
  }
  // Champs de soumission au superviseur (cloud report chain)
  if (!names.has('cloud_report_id')) {
    await db.execAsync('ALTER TABLE voice_reports ADD COLUMN cloud_report_id TEXT;');
  }
  if (!names.has('submitted_at')) {
    await db.execAsync('ALTER TABLE voice_reports ADD COLUMN submitted_at TEXT;');
  }
  if (!names.has('review_status')) {
    await db.execAsync('ALTER TABLE voice_reports ADD COLUMN review_status TEXT;');
  }
  if (!names.has('review_note')) {
    await db.execAsync('ALTER TABLE voice_reports ADD COLUMN review_note TEXT;');
  }
}

async function ensureEquipmentColumns(db: Db): Promise<void> {
  const rows = await db.getAllAsync<{ name: string }>('PRAGMA table_info(equipments)');
  const names = new Set(rows.map((r) => r.name));
  if (!names.has('equipment_type')) {
    await db.execAsync('ALTER TABLE equipments ADD COLUMN equipment_type TEXT;');
  }
  if (!names.has('db_status')) {
    await db.execAsync('ALTER TABLE equipments ADD COLUMN db_status TEXT;');
  }
  if (!names.has('sync_payload')) {
    await db.execAsync('ALTER TABLE equipments ADD COLUMN sync_payload TEXT;');
  }
  if (!names.has('synced_from_desktop')) {
    await db.execAsync('ALTER TABLE equipments ADD COLUMN synced_from_desktop INTEGER NOT NULL DEFAULT 0;');
  }
}


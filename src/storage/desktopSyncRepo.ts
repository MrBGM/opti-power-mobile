import { getDb } from '@/storage/db';

const KEY_KPIS = 'desktop_kpis_by_equipment_v1';
const KEY_STATS = 'desktop_measurement_stats_v1';

function parseJsonRecord(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function loadDesktopSyncBundle(): Promise<{
  kpisByEquipmentId: Record<string, unknown>;
  measurementStatsByEquipmentId: Record<string, unknown>;
}> {
  const db = await getDb();
  const k = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [KEY_KPIS]);
  const s = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [KEY_STATS]);
  return {
    kpisByEquipmentId: parseJsonRecord(k?.value),
    measurementStatsByEquipmentId: parseJsonRecord(s?.value),
  };
}

export async function replaceDesktopKpisAndStats(
  kpisByEquipmentId: Record<string, unknown>,
  measurementStatsByEquipmentId: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [
    KEY_KPIS,
    JSON.stringify(kpisByEquipmentId),
  ]);
  await db.runAsync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [
    KEY_STATS,
    JSON.stringify(measurementStatsByEquipmentId),
  ]);
}

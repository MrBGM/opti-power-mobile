import type { AlertProjection, AlertSeverity, AlertStatus } from '@/domain/alert';
import { getDb } from '@/storage/db';

export async function listAlerts(opts?: {
  excludeStatus?: AlertStatus[];
}): Promise<AlertProjection[]> {
  const db = await getDb();
  const exclude = opts?.excludeStatus ?? [];
  const placeholders = exclude.map(() => '?').join(', ');
  const sql =
    exclude.length > 0
      ? `SELECT id, title, equipment_id, equipment_name, severity, status, triggered_at, created_at, updated_at
         FROM alerts
         WHERE status NOT IN (${placeholders})
         ORDER BY triggered_at DESC`
      : `SELECT id, title, equipment_id, equipment_name, severity, status, triggered_at, created_at, updated_at
         FROM alerts
         ORDER BY triggered_at DESC`;

  const rows = await (exclude.length > 0
    ? db.getAllAsync<{
        id: string;
        title: string;
        equipment_id: string | null;
        equipment_name: string | null;
        severity: string;
        status: string;
        triggered_at: string;
        created_at: string;
        updated_at: string;
      }>(sql, ...exclude)
    : db.getAllAsync<{
        id: string;
        title: string;
        equipment_id: string | null;
        equipment_name: string | null;
        severity: string;
        status: string;
        triggered_at: string;
        created_at: string;
        updated_at: string;
      }>(sql));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    equipmentId: r.equipment_id,
    equipmentName: r.equipment_name,
    severity: r.severity as AlertSeverity,
    status: r.status as AlertStatus,
    triggeredAt: r.triggered_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function updateAlertStatus(id: string, status: AlertStatus): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE alerts SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    [status, id]
  );
}

export async function upsertAlert(a: AlertProjection): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO alerts (id, title, equipment_id, equipment_name, severity, status, triggered_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       equipment_id=excluded.equipment_id,
       equipment_name=excluded.equipment_name,
       severity=excluded.severity,
       status=excluded.status,
       triggered_at=excluded.triggered_at,
       updated_at=excluded.updated_at`,
    [
      a.id,
      a.title,
      a.equipmentId ?? null,
      a.equipmentName ?? null,
      a.severity,
      a.status,
      a.triggeredAt,
      a.createdAt,
      a.updatedAt,
    ]
  );
}

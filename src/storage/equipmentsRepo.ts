import type { MobileEquipmentSyncDto } from '@/api/mobileSync';
import type { Equipment } from '@/domain/equipment';
import { getDb } from '@/storage/db';

type EquipmentRow = {
  id: string;
  name: string;
  site: string | null;
  power_source: string | null;
  criticality: string | null;
  equipment_type: string | null;
  db_status: string | null;
  sync_payload: string | null;
  synced_from_desktop: number;
  created_at: string;
  updated_at: string;
};

function rowToEquipment(r: EquipmentRow): Equipment {
  return {
    id: r.id,
    name: r.name,
    site: r.site,
    powerSource: r.power_source,
    criticality: (r.criticality as Equipment['criticality']) ?? null,
    equipmentType: r.equipment_type,
    dbStatus: r.db_status,
    syncPayload: r.sync_payload,
    syncedFromDesktop: r.synced_from_desktop === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function dtoToEquipment(d: MobileEquipmentSyncDto): Equipment {
  return {
    id: d.id,
    name: d.name,
    site: d.site ?? null,
    powerSource: d.powerSource ?? null,
    criticality: (d.criticality as Equipment['criticality']) ?? null,
    equipmentType: d.type ?? null,
    dbStatus: d.status ?? null,
    syncPayload: d.detail ? JSON.stringify(d.detail) : null,
    syncedFromDesktop: true,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function listEquipments(): Promise<Equipment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<EquipmentRow>(
    `SELECT id, name, site, power_source, criticality, equipment_type, db_status, sync_payload,
            synced_from_desktop, created_at, updated_at
     FROM equipments
     ORDER BY synced_from_desktop DESC, updated_at DESC`
  );

  return rows.map(rowToEquipment);
}

export async function getEquipmentById(id: string): Promise<Equipment | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<EquipmentRow>(
    `SELECT id, name, site, power_source, criticality, equipment_type, db_status, sync_payload,
            synced_from_desktop, created_at, updated_at
     FROM equipments WHERE id = ?`,
    [id]
  );
  return r ? rowToEquipment(r) : null;
}

export async function upsertEquipment(e: Equipment): Promise<void> {
  const db = await getDb();
  const synced = e.syncedFromDesktop ? 1 : 0;
  await db.runAsync(
    `INSERT INTO equipments (id, name, site, power_source, criticality, equipment_type, db_status, sync_payload, synced_from_desktop, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name=excluded.name,
       site=excluded.site,
       power_source=excluded.power_source,
       criticality=excluded.criticality,
       equipment_type=excluded.equipment_type,
       db_status=excluded.db_status,
       sync_payload=excluded.sync_payload,
       synced_from_desktop=excluded.synced_from_desktop,
       updated_at=excluded.updated_at`,
    [
      e.id,
      e.name,
      e.site ?? null,
      e.powerSource ?? null,
      e.criticality ?? null,
      e.equipmentType ?? null,
      e.dbStatus ?? null,
      e.syncPayload ?? null,
      synced,
      e.createdAt,
      e.updatedAt,
    ]
  );
}

/** Remplace uniquement les lignes synchronisées depuis le desktop (conserve seed / données locales). */
export async function replaceDesktopEquipmentsSnapshot(equipments: Equipment[]): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM equipments WHERE synced_from_desktop = 1');
  for (const e of equipments) {
    await upsertEquipment({ ...e, syncedFromDesktop: true });
  }
}

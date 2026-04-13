/**
 * Résolution tolérante des entrées KPI / stats par ID équipement (casse, espaces).
 */

export function getKpiRecordFromBundle(
  kpisByEquipmentId: Record<string, unknown> | undefined,
  equipmentId: string | null | undefined
): Record<string, unknown> | null {
  if (!equipmentId?.trim() || !kpisByEquipmentId) return null;
  const id = equipmentId.trim();
  const direct = kpisByEquipmentId[id];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }
  const lower = id.toLowerCase();
  for (const k of Object.keys(kpisByEquipmentId)) {
    if (k.trim().toLowerCase() === lower) {
      const v = kpisByEquipmentId[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    }
  }
  return null;
}

export function getStatsRawFromBundle(
  measurementStatsByEquipmentId: Record<string, unknown> | undefined,
  equipmentId: string | null | undefined
): unknown {
  if (!equipmentId?.trim() || !measurementStatsByEquipmentId) return undefined;
  const id = equipmentId.trim();
  if (id in measurementStatsByEquipmentId) return measurementStatsByEquipmentId[id];
  const lower = id.toLowerCase();
  for (const k of Object.keys(measurementStatsByEquipmentId)) {
    if (k.trim().toLowerCase() === lower) return measurementStatsByEquipmentId[k];
  }
  return undefined;
}

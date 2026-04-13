export type EquipmentId = string;

export interface Equipment {
  id: EquipmentId;
  name: string;
  site?: string | null;
  powerSource?: string | null;
  criticality?: 'standard' | 'critical' | 'high' | 'low' | null;
  /** Métadonnées desktop (table equipment.type) */
  equipmentType?: string | null;
  /** Métadonnées desktop (table equipment.status) */
  dbStatus?: string | null;
  /** JSON sérialisé du bloc `detail` poussé par le desktop */
  syncPayload?: string | null;
  /** Ligne issue du snapshot desktop (remplacée à chaque sync) */
  syncedFromDesktop?: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}


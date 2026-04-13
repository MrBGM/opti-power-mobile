import { upsertAlert } from '@/storage/alertsRepo';
import { upsertEquipment } from '@/storage/equipmentsRepo';

function uuid(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // Fallback non-cryptographique (OK pour seed local).
  return `seed-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

export async function seedDemoData(): Promise<void> {
  const now = new Date().toISOString();
  const eqA = uuid();
  const eqB = uuid();
  await upsertEquipment({
    id: eqA,
    name: 'Groupe électrogène 250kVA',
    site: 'Atelier A',
    powerSource: 'sonabel',
    criticality: 'high',
    syncedFromDesktop: false,
    createdAt: now,
    updatedAt: now,
  });
  await upsertEquipment({
    id: eqB,
    name: 'Compresseur principal',
    site: 'Usine',
    powerSource: 'sonabel',
    criticality: 'critical',
    syncedFromDesktop: false,
    createdAt: now,
    updatedAt: now,
  });

  const t0 = new Date(Date.now() - 45 * 60_000).toISOString();
  const t1 = new Date(Date.now() - 6 * 60_000).toISOString();
  await upsertAlert({
    id: uuid(),
    title: 'THD courant élevé',
    equipmentId: eqA,
    equipmentName: 'Groupe électrogène 250kVA',
    severity: 'warning',
    status: 'active',
    triggeredAt: t0,
    createdAt: now,
    updatedAt: now,
  });
  await upsertAlert({
    id: uuid(),
    title: 'Surchauffe jeu de balais',
    equipmentId: eqB,
    equipmentName: 'Compresseur principal',
    severity: 'critical',
    status: 'active',
    triggeredAt: t1,
    createdAt: now,
    updatedAt: now,
  });
}


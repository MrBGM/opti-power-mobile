/**
 * Extraction des valeurs affichées sur le tableau de bord -- aligné sur DashboardPage.tsx (bureau).
 */

import { getKpiRecordFromBundle } from '@/lib/syncBundleLookup';

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

export function getKpiRecordForEquipment(
  kpisByEquipmentId: Record<string, unknown> | undefined,
  equipmentId: string | null
): Record<string, unknown> | null {
  return getKpiRecordFromBundle(kpisByEquipmentId, equipmentId ?? undefined);
}

/** True si le snapshot contient au moins un bloc exploitable pour l'UI (cartes KPI / supervision). */
export function kpiRecordHasDisplayableData(k: Record<string, unknown> | null | undefined): boolean {
  if (!k || k.error != null) return false;
  if (k.noMeasurements === true) return false;
  return Boolean(
    k.powerFactor ||
      k.harmonics ||
      k.energyConsumption ||
      k.phaseBalance ||
      k.frequency ||
      k.voltage ||
      k.energyKPIs
  );
}

/**
 * Raison pour laquelle un KPI record n'est pas affichable.
 * Permet de distinguer "pas de mesures" (normal) vs "erreur calcul" (problème technique).
 */
export type KpiEmptyReason = 'no-measurements' | 'calc-error' | 'no-data' | null;

export function kpiEmptyReason(k: Record<string, unknown> | null | undefined): KpiEmptyReason {
  if (!k) return 'no-data';
  if (k.noMeasurements === true) return 'no-measurements';
  if (k.error != null) return 'calc-error';
  if (!kpiRecordHasDisplayableData(k)) return 'no-data';
  return null;
}

export function kpiEmptyLabel(reason: KpiEmptyReason): string {
  switch (reason) {
    case 'no-measurements':
      return 'Aucune mesure importée sur le bureau';
    case 'calc-error':
      return 'Erreur de calcul KPI (voir logs bureau)';
    case 'no-data':
      return 'Données KPI non disponibles';
    default:
      return '';
  }
}

/** kWh total pour la carte « Consommation totale » (même priorité que le bureau). */
export function getConsumptionKwhFromKpi(k: Record<string, unknown> | null): number | null {
  if (!k) return null;
  const eKpis = k.energyKPIs as Record<string, unknown> | undefined;
  const tae = eKpis ? num(eKpis.totalActiveEnergy) : null;
  if (tae != null && tae > 0) return tae;
  const ec = k.energyConsumption as Record<string, unknown> | undefined;
  const mwh = ec ? num(ec.totalMWh) : null;
  if (mwh != null && mwh > 0) return mwh * 1000;
  return null;
}

export function formatConsumptionKwh(kwh: number): string {
  if (kwh >= 1_000_000) return `${(kwh / 1_000_000).toFixed(2)} GWh`;
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(2)} MWh`;
  return `${Math.round(kwh)} kWh`;
}

export function getPfFromKpi(k: Record<string, unknown> | null): {
  value: number | null;
  status: 'normal' | 'warning' | 'critical';
} {
  if (!k) return { value: null, status: 'normal' };
  const eKpis = k.energyKPIs as Record<string, unknown> | undefined;
  if (eKpis && eKpis.powerFactorEnergy != null) {
    const v = num(eKpis.powerFactorEnergy);
    const s = String(eKpis.powerFactorStatus ?? 'ok');
    const status = s === 'ok' ? 'normal' : s === 'warning' ? 'warning' : 'critical';
    return { value: v, status };
  }
  const pf = k.powerFactor as Record<string, unknown> | undefined;
  const value = pf ? num(pf.value) : null;
  const st = String(pf?.status ?? 'normal') as 'normal' | 'warning' | 'critical';
  return { value, status: st };
}

export function consumptionSubtitleFromKpi(k: Record<string, unknown> | null): string {
  if (!k) return 'Données bureau (sync)';
  const eKpis = k.energyKPIs as Record<string, unknown> | undefined;
  const start = eKpis?.periodStart;
  const end = eKpis?.periodEnd;
  if (typeof start === 'string' && typeof end === 'string') {
    const fmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    try {
      return `Total : ${fmt.format(new Date(start))} - ${fmt.format(new Date(end))}`;
    } catch {
      /* ignore */
    }
  }
  const period = String(k.period ?? 'AUTO');
  switch (period) {
    case '24H':
      return 'Total sur 24 heures';
    case '7J':
      return 'Total sur 7 jours';
    case '30J':
      return 'Total sur 30 jours';
    default:
      return 'Total sur toute la période (AUTO)';
  }
}

export function costFcfaFromKpi(k: Record<string, unknown> | null): number | null {
  if (!k) return null;
  const ec = k.energyConsumption as Record<string, unknown> | undefined;
  return ec ? num(ec.costFcfa) : null;
}

export function formatFcfa(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' FCFA';
}

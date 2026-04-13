/**
 * Même logique que `EquipmentStatus.tsx` du bureau (computeMetrics).
 */

export type EquipStatus = 'normal' | 'warning' | 'critical' | 'no-data';
export type Compliance = 'conforme' | 'partiel' | 'non-conforme' | 'sans-données';

export interface EquipMetrics {
  status: EquipStatus;
  health: number | null;
  pf: number | null;
  thdI: number | null;
  imbalance: number | null;
  consoKw: number | null;
  compliance: Compliance;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

export function computeEquipMetricsFromDesktopKpi(
  kpis: unknown,
  measurementStats: unknown
): EquipMetrics {
  const k = kpis && typeof kpis === 'object' && !Array.isArray(kpis) ? (kpis as Record<string, unknown>) : {};
  const stats =
    measurementStats && typeof measurementStats === 'object' && !Array.isArray(measurementStats)
      ? (measurementStats as Record<string, unknown>)
      : {};
  const hasMeasurements = num(stats.total_count) != null && (stats.total_count as number) > 0;

  const pfObj = k.powerFactor as Record<string, unknown> | null | undefined;
  const harmObj = k.harmonics as Record<string, unknown> | null | undefined;
  const ecObj = k.energyConsumption as Record<string, unknown> | null | undefined;
  const pbObj = k.phaseBalance as Record<string, unknown> | null | undefined;

  const pf = pfObj ? num(pfObj.value) : null;
  const thdI = harmObj ? num(harmObj.thdTotal) : null;
  const imbalance = pbObj ? num(pbObj.unbalancePercent) : null;

  let consoKw: number | null = ecObj ? num(ecObj.peakKw) : null;
  if (consoKw == null && ecObj) {
    const totalMWh = num(ecObj.totalMWh);
    const periodDays = num(ecObj.periodDays);
    if (totalMWh != null && totalMWh > 0 && periodDays != null && periodDays > 0) {
      consoKw = Math.round((totalMWh * 1000) / (periodDays * 24));
    }
  }

  const hasKpiData = pf != null || thdI != null || imbalance != null;

  let status: EquipStatus;
  if (!hasMeasurements || !hasKpiData) {
    status = 'no-data';
  } else if (
    (pf != null && pf < 0.85) ||
    (thdI != null && thdI > 15) ||
    (imbalance != null && imbalance > 5)
  ) {
    status = 'critical';
  } else if (
    (pf != null && pf < 0.9) ||
    (thdI != null && thdI > 8) ||
    (imbalance != null && imbalance > 2)
  ) {
    status = 'warning';
  } else {
    status = 'normal';
  }

  let health: number | null = null;
  if (hasKpiData) {
    const pfScore = pf != null ? Math.min(pf / 0.9, 1.0) * 40 : 20;
    const thdScore = thdI != null ? Math.max(0, 1 - thdI / 15) * 35 : 17.5;
    const balScore = imbalance != null ? Math.max(0, 1 - imbalance / 2) * 25 : 12.5;
    health = Math.round(pfScore + thdScore + balScore);
  }

  let compliance: Compliance;
  if (!hasKpiData) {
    compliance = 'sans-données';
  } else if (
    (pf == null || pf >= 0.9) &&
    (thdI == null || thdI <= 8) &&
    (imbalance == null || imbalance <= 2)
  ) {
    compliance = 'conforme';
  } else if (
    (pf == null || pf >= 0.85) &&
    (thdI == null || thdI <= 15) &&
    (imbalance == null || imbalance <= 5)
  ) {
    compliance = 'partiel';
  } else {
    compliance = 'non-conforme';
  }

  return { status, health, pf, thdI, imbalance, consoKw, compliance };
}

export function equipStatusLabelFr(status: EquipStatus): string {
  switch (status) {
    case 'normal':
      return 'Normal';
    case 'warning':
      return 'Avertissement';
    case 'critical':
      return 'Critique';
    default:
      return 'Sans données';
  }
}

export function complianceLabelFr(c: Compliance): string {
  switch (c) {
    case 'conforme':
      return 'Conforme';
    case 'partiel':
      return 'Partiel';
    case 'non-conforme':
      return 'Non conforme';
    default:
      return 'Sans données';
  }
}

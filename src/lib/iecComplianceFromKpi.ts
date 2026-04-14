/**
 * Cartes « Conformité IEC 61000-4-30 » — même logique que AnalyticsPage.tsx (desktop).
 */

export type ComplianceItem = {
  label: string;
  value: string;
  limit: string;
  conform: boolean;
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

export function buildComplianceItemsFromKpi(kpi: Record<string, unknown>): ComplianceItem[] {
  const harm = kpi.harmonics as Record<string, unknown> | undefined;
  const thdV = num(harm?.thdTotal) ?? 0;
  const thdVLimit = num(harm?.thdLimit) ?? 8;
  const thdCur = kpi.thdCurrent as Record<string, unknown> | undefined;
  const thdI = num(thdCur?.value ?? thdCur?.average ?? thdCur?.thdTotal) ?? 0;
  const thdILimit = num(thdCur?.limit) ?? 8;
  const thdIN = num(thdCur?.thdCurrentNeutral);
  const pb = kpi.phaseBalance as Record<string, unknown> | undefined;
  const vUnbalance = num(pb?.unbalancePercent) ?? 0;
  const cb = kpi.currentBalance as Record<string, unknown> | undefined;
  const iUnbalance = num(cb?.unbalancePercent) ?? 0;
  const pf = kpi.powerFactor as Record<string, unknown> | undefined;
  const pfVal = num(pf?.value) ?? 0;
  const pfThreshold = num(pf?.threshold) ?? 0.85;
  const freq = kpi.frequency as Record<string, unknown> | undefined;
  const freqHz = num(freq?.avgHz);
  const fl = kpi.flicker as Record<string, unknown> | undefined;
  const pltAvg = num(fl?.avgPlt);
  const pltMax = num(fl?.maxPlt);
  const pltLimit = num(fl?.limit) ?? 1.0;

  const items: ComplianceItem[] = [
    {
      label: 'THD Tension',
      value: `${thdV.toFixed(1)} %`,
      limit: `Limite: ${thdVLimit}% (EN 50160)`,
      conform: thdV <= thdVLimit,
    },
    {
      label: 'THD Courant A1/A2/A3',
      value: `${thdI.toFixed(1)} %`,
      limit: `Limite: ${thdILimit}% (IEEE 519)`,
      conform: thdI <= thdILimit,
    },
  ];
  if (thdIN !== null) {
    items.push({
      label: 'THD Courant Neutre AN',
      value: `${thdIN.toFixed(1)} %`,
      limit: `Limite: ${thdILimit}% (IEEE 519)`,
      conform: thdIN <= thdILimit,
    });
  }
  items.push(
    {
      label: 'Déséquilibre tension',
      value: `${vUnbalance.toFixed(1)} %`,
      limit: 'Limite: 2% (EN 50160)',
      conform: vUnbalance <= 2,
    },
    {
      label: 'Déséquilibre courant',
      value: `${iUnbalance.toFixed(1)} %`,
      limit: 'Limite: 10% (EN 50160)',
      conform: iUnbalance <= 10,
    },
    {
      label: 'Facteur de puissance (TPF)',
      value:
        num(pf?.dpf) != null
          ? `TPF ${pfVal.toFixed(4)} · DPF ${num(pf?.dpf)!.toFixed(4)}`
          : pfVal.toFixed(4),
      limit: `Limite: ${pfThreshold} (SONABEL)`,
      conform: pfVal >= pfThreshold,
    },
    {
      label: 'Fréquence',
      value: freqHz !== null ? `${freqHz.toFixed(2)} Hz` : '— Hz',
      limit: 'Limite: 49.5–50.5 Hz (WAPP)',
      conform: freqHz !== null ? freqHz >= 49.5 && freqHz <= 50.5 : false,
    }
  );
  if (pltAvg !== null) {
    items.push({
      label: 'Flicker Plt long-terme',
      value: `moy ${pltAvg.toFixed(2)} / max ${pltMax != null ? pltMax.toFixed(2) : '—'}`,
      limit: `Limite: ${pltLimit} (EN 50160)`,
      conform: pltAvg <= pltLimit,
    });
  }
  return items;
}

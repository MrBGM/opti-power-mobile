/**
 * Mise en forme des champs `detail` envoyés par le desktop (JSON / chaînes).
 */

const CONNECTION: Record<string, string> = {
  three_phase: 'Triphasé',
  single_phase: 'Monophasé',
  dc: 'Courant continu',
};

const ELECTRICAL_KEYS: { key: string; label: string; format?: 'voltage' | 'current' | 'power' | 'freq' | 'pf' }[] = [
  { key: 'connectionType', label: 'Raccordement' },
  { key: 'nominalVoltage', label: 'Tension nominale', format: 'voltage' },
  { key: 'nominalCurrent', label: 'Courant nominal', format: 'current' },
  { key: 'nominalPower', label: 'Puissance nominale', format: 'power' },
  { key: 'nominalFrequency', label: 'Fréquence', format: 'freq' },
  { key: 'powerFactor', label: 'Facteur de puissance', format: 'pf' },
];

export function parseJsonField(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return null;
}

function formatElectricalValue(key: string, val: unknown, format?: string): string {
  if (val === null || val === undefined) return '—';
  if (key === 'connectionType' && typeof val === 'string') {
    return CONNECTION[val] ?? val.replace(/_/g, ' ');
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    if (format === 'voltage') return `${val} V`;
    if (format === 'current') return `${val} A`;
    if (format === 'power') return val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)} kW` : `${val} W`;
    if (format === 'freq') return `${val} Hz`;
    if (format === 'pf') return String(val);
    return String(val);
  }
  return String(val);
}

export type DetailRow = { label: string; value: string };

export function electricalConfigRows(raw: unknown): DetailRow[] {
  const obj = parseJsonField(raw);
  if (!obj) return [];
  const out: DetailRow[] = [];
  for (const { key, label, format } of ELECTRICAL_KEYS) {
    if (key in obj) {
      out.push({ label, value: formatElectricalValue(key, obj[key], format) });
    }
  }
  for (const [k, v] of Object.entries(obj)) {
    if (ELECTRICAL_KEYS.some((e) => e.key === k)) continue;
    out.push({ label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim(), value: String(v) });
  }
  return out;
}

const SIMPLE_LABELS: Record<string, string> = {
  manufacturer: 'Fabricant',
  model: 'Modèle',
  serial_number: 'N° de série',
  installation_date: 'Mise en service',
  last_maintenance_date: 'Dernière maintenance',
};

export function simpleDetailRows(detail: Record<string, unknown>): DetailRow[] {
  const skip = new Set(['description', 'electrical_config', 'location_config']);
  const out: DetailRow[] = [];
  for (const [k, v] of Object.entries(detail)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue;
    const label = SIMPLE_LABELS[k] ?? k.replace(/_/g, ' ');
    out.push({ label, value: typeof v === 'string' ? v : String(v) });
  }
  return out;
}

export function locationRows(raw: unknown): DetailRow[] {
  const obj = parseJsonField(raw);
  if (!obj) return [];
  return Object.entries(obj).map(([k, v]) => ({
    label: k.replace(/_/g, ' '),
    value: v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v),
  }));
}

/** Même jointure que `EquipmentDetail.tsx` du bureau : site, zone, bâtiment, étage. */
export function siteZoneFromLocationConfig(
  raw: unknown,
  fallbackSite?: string | null
): string {
  const obj = parseJsonField(raw);
  const parts = obj
    ? ([obj.site, obj.zone, obj.building, obj.floor] as unknown[])
        .map((x) => (typeof x === 'string' && x.trim() ? x.trim() : null))
        .filter(Boolean) as string[]
    : [];
  if (parts.length > 0) return parts.join(', ');
  if (typeof fallbackSite === 'string' && fallbackSite.trim()) return fallbackSite.trim();
  return '—';
}

/**
 * Grille fixe alignée sur la colonne droite du bureau (toujours 6 lignes, « — » si absent).
 */
export function electricalSpecificationsRowsDesktop(raw: unknown): DetailRow[] {
  const obj = parseJsonField(raw);
  const n = (key: string): number | null => {
    const v = obj?.[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    return null;
  };
  const np = n('nominalPower');
  const nv = n('nominalVoltage');
  const nc = n('nominalCurrent');
  const nf = n('nominalFrequency');
  const nfpf = n('nominalPF');
  const eff = n('efficiency');
  return [
    { label: 'Puissance nominale', value: np != null ? `${np} kW` : '—' },
    { label: 'Tension nominale', value: nv != null ? `${nv} V` : '—' },
    { label: 'Courant nominal', value: nc != null ? `${nc} A` : '—' },
    { label: 'Fréquence', value: nf != null ? `${nf} Hz` : '—' },
    { label: 'FP nominal', value: nfpf != null ? nfpf.toFixed(2) : '—' },
    { label: 'Rendement', value: eff != null ? `${eff} %` : '—' },
  ];
}

const IDENTITY_KEYS = new Set([
  'manufacturer',
  'model',
  'serial_number',
  'installation_date',
]);

/** Évite les doublons avec la carte Identification. */
export function simpleDetailRowsExcludingIdentity(detail: Record<string, unknown>): DetailRow[] {
  const skip = new Set([...['description', 'electrical_config', 'location_config'], ...IDENTITY_KEYS]);
  const out: DetailRow[] = [];
  for (const [k, v] of Object.entries(detail)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue;
    const label = SIMPLE_LABELS[k] ?? k.replace(/_/g, ' ');
    out.push({ label, value: typeof v === 'string' ? v : String(v) });
  }
  return out;
}

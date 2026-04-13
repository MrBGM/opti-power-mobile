/**
 * Palette claire unifiee pour toute l'application Opti Power Mobile.
 * Un seul endroit a modifier pour changer le theme.
 */

export const C = {
  // ── Fonds ──────────────────────────────────────────────────────────
  bg:       '#f8fafc',   // fond ecran (slate-50)
  surface:  '#ffffff',   // cartes, modals
  surface2: '#f1f5f9',   // sections secondaires (slate-100)
  surface3: '#e8f0fe',   // bleu tres doux pour les accents

  // ── Bordures ───────────────────────────────────────────────────────
  border:   '#e2e8f0',   // bordure standard (slate-200)
  borderSub:'#f1f5f9',   // bordure tres legere

  // ── Textes ─────────────────────────────────────────────────────────
  text:     '#0f172a',   // texte principal (slate-900)
  textSub:  '#475569',   // texte secondaire (slate-600)
  textMuted:'#94a3b8',   // texte discret (slate-400)

  // ── Bleu – actions principales ─────────────────────────────────────
  blue:     '#2563eb',   // boutons, liens (blue-600)
  blueMid:  '#3b82f6',   // valeurs importantes (blue-500)
  blueSoft: '#eff6ff',   // fond bleu doux (blue-50)
  blueText: '#1d4ed8',   // texte sur fond bleu doux

  // ── Vert – OK / normal ─────────────────────────────────────────────
  green:    '#059669',   // emerald-600
  greenSoft:'#ecfdf5',   // emerald-50
  greenText:'#065f46',   // texte sur fond vert

  // ── Ambre – avertissement ──────────────────────────────────────────
  amber:    '#d97706',   // amber-600
  amberSoft:'#fffbeb',   // amber-50
  amberText:'#92400e',

  // ── Rouge – critique ───────────────────────────────────────────────
  red:      '#dc2626',   // red-600
  redSoft:  '#fef2f2',   // red-50
  redText:  '#991b1b',

  // ── Violet – IA / KPI secondaires ─────────────────────────────────
  purple:   '#7c3aed',   // violet-600
  purpleSoft:'#f5f3ff',  // violet-50
  purpleText:'#4c1d95',

  // ── Cyan – synchronisation / mesures ──────────────────────────────
  cyan:     '#0284c7',   // sky-600
  cyanSoft: '#f0f9ff',   // sky-50

  // ── Ombres ─────────────────────────────────────────────────────────
  shadow: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  shadowMd: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

/** Couleur semantique selon le statut KPI */
export function statusColor(s: 'normal' | 'warning' | 'critical'): string {
  if (s === 'critical') return C.red;
  if (s === 'warning')  return C.amber;
  return C.green;
}

export function statusBg(s: 'normal' | 'warning' | 'critical'): string {
  if (s === 'critical') return C.redSoft;
  if (s === 'warning')  return C.amberSoft;
  return C.greenSoft;
}

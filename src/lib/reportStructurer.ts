/**
 * Structure un texte transcrit en rapport de maintenance minier.
 * Sections inspirées des rapports de maintenance en milieu industriel/minier :
 *   1. Objet de l'intervention
 *   2. Constatations terrain
 *   3. Anomalies / défauts détectés
 *   4. Paramètres mesurés
 *   5. Travaux effectués
 *   6. Recommandations & suivi
 *
 * Fonctionne côté client, sans API externe.
 */
import type { StructuredReport } from '@/storage/voiceReportsRepo';

// ── Dictionnaires de mots-clés par section ────────────────────────────────

/** Objet / nature de l'intervention */
const OBJET_KEYS = [
  'inspection', 'visite', 'contrôle', 'controle', 'vérification', 'verification',
  'maintenance', 'entretien', 'révision', 'revision', 'intervention', 'dépannage', 'depannage',
  'remplacement', 'installation', 'mise en service', 'relevé', 'releve',
  'curative', 'préventive', 'preventive', 'corrective', 'programmée', 'programmee',
];

/** Constatations terrain (physique, sensoriel, visuel) */
const CONSTATS_KEYS = [
  'vibration', 'vibrations', 'bruit', 'claquement', 'bourdonnement', 'sifflement',
  'chaleur', 'chaud', 'odeur', 'fuite', 'humidité', 'humidite',
  'rouille', 'corrosion', 'échauffement', 'echauffement', 'température', 'temperature',
  'surchauffe', 'étincelle', 'etincelle', 'arc', 'poussière', 'poussiere',
  'encrassement', 'usure', 'détérioration', 'deterioration', 'déformation', 'deformation',
  'visuel', 'constaté', 'constate', 'observé', 'observe', 'noté', 'note',
  'câble', 'cable', 'connexion', 'borne', 'contact', 'jeu de barre', 'tableau',
];

/** Anomalies, défauts, alarmes, pannes */
const ANOMALIES_KEYS = [
  'anomalie', 'problème', 'probleme', 'défaut', 'defaut', 'panne', 'alarme', 'alerte',
  'dysfonctionnement', 'irrégularité', 'irregularite', 'anormal', 'critique', 'urgent',
  'coupure', 'surcharge', 'déséquilibre', 'desequilibre', 'surtension', 'sous-tension',
  'court-circuit', 'défaillance', 'defaillance', 'incident', 'trip', 'déclenchement', 'declenchement',
  'disjoncteur', 'fusible', 'relais', 'protections',
];

/** Paramètres mesurés — valeurs numériques électriques */
const MESURES_KEYS = [
  'consommation', 'énergie', 'energie', 'kwh', 'mwh', 'puissance', 'kw', 'kva', 'kvar',
  'facteur de puissance', 'thd', 'harmonique', 'réactive', 'reactive', 'active', 'apparente',
  'ampère', 'ampere', 'ampérage', 'amperage', 'tension', 'voltage', 'volt',
  'fréquence', 'frequence', 'hz', 'watt', 'kilowatt', 'compteur',
  'mesure', 'mesuré', 'mesure', 'valeur', 'relevé', 'releve', 'lecture',
  'déséquilibre', 'desequilibre', 'phase', 'courant', 'courants',
];

/** Travaux effectués pendant l'intervention */
const TRAVAUX_KEYS = [
  'nettoyé', 'nettoye', 'nettoyage', 'serré', 'serre', 'serrage',
  'remplacé', 'remplace', 'remplacement', 'réparé', 'repare', 'réparation', 'reparation',
  'calibré', 'calibre', 'calibrage', 'lubrifié', 'lubrifie', 'lubrification',
  'installé', 'installe', 'changé', 'change', 'modifié', 'modifie',
  'effectué', 'effectue', 'réalisé', 'realise', 'opération', 'operation',
  'test', 'testé', 'teste', 'essai', 'mise à zéro', 'réarmé', 'rearme',
];

/** Recommandations et actions futures */
const RECOMMANDATIONS_KEYS = [
  'faut', 'vérifier', 'verifier', 'recommande', 'recommandation', 'recommander',
  'inspecter', 'surveiller', 'planifier', 'prévoir', 'prevoir', 'programmer',
  'urgent', 'impérativement', 'imperativement', 'prochaine visite', 'prochainement',
  'suivi', 'préconise', 'preconise', 'préconisation', 'preconisation',
  'à changer', 'a changer', 'à remplacer', 'a remplacer', 'doit être', 'doit etre',
  'risque', 'danger', 'attention', 'avertissement',
];

// ── Helpers ───────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?;,\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function matchScore(sentence: string, keys: string[]): number {
  const norm = normalize(sentence);
  return keys.reduce((score, k) => score + (norm.includes(normalize(k)) ? 1 : 0), 0);
}

// ── Exports ───────────────────────────────────────────────────────────────

export function structureTranscription(text: string): StructuredReport {
  if (!text.trim()) {
    return { observations: [], anomalies: [], consumption: [], actions: [], rawText: text };
  }

  const sentences = splitSentences(text);

  const objet: string[] = [];
  const constats: string[] = [];
  const anomalies: string[] = [];
  const mesures: string[] = [];
  const travaux: string[] = [];
  const recommandations: string[] = [];
  const unclassified: string[] = [];

  /** Priorité en cas d’égalité : une phrase → une seule section la plus pertinente. */
  const sectionOrder = [objet, constats, anomalies, mesures, travaux, recommandations] as const;
  const keySets = [OBJET_KEYS, CONSTATS_KEYS, ANOMALIES_KEYS, MESURES_KEYS, TRAVAUX_KEYS, RECOMMANDATIONS_KEYS];

  for (const s of sentences) {
    const scores = keySets.map((keys, idx) => ({ idx, sc: matchScore(s, keys) }));
    const maxScore = Math.max(...scores.map((x) => x.sc), 0);

    if (maxScore === 0) {
      if (s.length > 15) unclassified.push(s);
      continue;
    }

    const bestIdx = scores.filter((x) => x.sc === maxScore).sort((a, b) => a.idx - b.idx)[0]?.idx;
    if (bestIdx !== undefined) sectionOrder[bestIdx].push(s);
  }

  // Unclassified sentences go into constats (general observations)
  constats.push(...unclassified);

  // Map to StructuredReport shape:
  // observations = objet + constats
  // anomalies = anomalies
  // consumption = mesures
  // actions = travaux + recommandations
  return {
    observations: [...new Set([...objet, ...constats])],
    anomalies: [...new Set(anomalies)],
    consumption: [...new Set(mesures)],
    actions: [...new Set([...travaux, ...recommandations])],
    rawText: text,
    // Extended sections stored in rawText context for display
    _sections: {
      objet: [...new Set(objet)],
      constats: [...new Set(constats)],
      mesures: [...new Set(mesures)],
      travaux: [...new Set(travaux)],
      recommandations: [...new Set(recommandations)],
    },
  };
}

export function structuredReportIsEmpty(r: StructuredReport): boolean {
  if (r.charts && r.charts.length > 0) return false;
  const sec = r._sections;
  if (sec) {
    const anySec =
      sec.objet.length > 0 ||
      sec.constats.length > 0 ||
      sec.mesures.length > 0 ||
      sec.travaux.length > 0 ||
      sec.recommandations.length > 0;
    if (anySec || r.anomalies.length > 0) return false;
  }
  return (
    r.observations.length === 0 &&
    r.anomalies.length === 0 &&
    r.consumption.length === 0 &&
    r.actions.length === 0
  );
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

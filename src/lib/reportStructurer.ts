/**
 * Transforme un texte transcrit en rapport structure par sections.
 * Fonctionne cote client, sans API externe.
 * Detecte les observations, anomalies, donnees de consommation et actions.
 */
import type { StructuredReport } from '@/storage/voiceReportsRepo';

// Mots-cles par categorie (francais + variations terrain)
const OBSERVATION_KEYS = [
  'vibration', 'bruit', 'chaleur', 'chaud', 'odeur', 'fuite', 'humidite',
  'rouille', 'corrosion', 'echauffement', 'temperature', 'surchauffe',
  'etincelle', 'arc', 'claquement', 'bourdonnement', 'sifflement',
  'poussiere', 'encrassement', 'usure', 'deterioration', 'deformation',
];

const ANOMALY_KEYS = [
  'anomalie', 'probleme', 'defaut', 'panne', 'alarme', 'alerte',
  'dysfonctionnement', 'irregularite', 'anormal', 'critique', 'urgent',
  'coupure', 'surcharge', 'desequilibre', 'surtension', 'sous-tension',
  'court-circuit', 'defaillance', 'incident',
];

const CONSUMPTION_KEYS = [
  'consommation', 'energie', 'kwh', 'puissance', 'facteur', 'thd',
  'harmonique', 'reactive', 'active', 'ampere', 'amperage', 'tension',
  'voltage', 'watt', 'kilowatt', 'compteur', 'facture',
];

const ACTION_KEYS = [
  'faut', 'verifier', 'vérifier', 'remplacer', 'nettoyer', 'revision',
  'maintenance', 'recommande', 'recommander', 'inspecter', 'changer',
  'reparer', 'réparer', 'serrer', 'lubrifier', 'calibrer', 'tester',
  'mesurer', 'surveiller', 'planifier', 'prevoir', 'prévoir',
  'urgent', 'imperativement', 'impérativement',
];

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

function sentenceMatchesKeys(sentence: string, keys: string[]): boolean {
  const norm = normalize(sentence);
  return keys.some((k) => norm.includes(normalize(k)));
}

export function structureTranscription(text: string): StructuredReport {
  if (!text.trim()) {
    return { observations: [], anomalies: [], consumption: [], actions: [], rawText: text };
  }

  const sentences = splitSentences(text);

  const observations: string[] = [];
  const anomalies: string[] = [];
  const consumption: string[] = [];
  const actions: string[] = [];

  for (const s of sentences) {
    const added = { obs: false, ano: false, con: false, act: false };

    if (sentenceMatchesKeys(s, ACTION_KEYS)) {
      actions.push(s);
      added.act = true;
    }
    if (sentenceMatchesKeys(s, ANOMALY_KEYS)) {
      anomalies.push(s);
      added.ano = true;
    }
    if (sentenceMatchesKeys(s, CONSUMPTION_KEYS)) {
      consumption.push(s);
      added.con = true;
    }
    if (sentenceMatchesKeys(s, OBSERVATION_KEYS)) {
      observations.push(s);
      added.obs = true;
    }
    // Phrase non classee : va dans observations si elle n'a deja pas ete classee ailleurs
    if (!added.obs && !added.ano && !added.con && !added.act && s.length > 15) {
      observations.push(s);
    }
  }

  return {
    observations: [...new Set(observations)],
    anomalies: [...new Set(anomalies)],
    consumption: [...new Set(consumption)],
    actions: [...new Set(actions)],
    rawText: text,
  };
}

export function structuredReportIsEmpty(r: StructuredReport): boolean {
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

/**
 * Structuration « intelligente » du rapport via LLM (Groq ou OpenAI),
 * avec repli sur l’heuristique locale si pas de clé ou erreur réseau.
 */
import { structureTranscription } from '@/lib/reportStructurer';
import type { ReportChartSeries, StructuredReport } from '@/storage/voiceReportsRepo';
import type { TranscribeProvider } from '@/lib/whisperTranscribe';

type LlmPayload = {
  objet?: unknown;
  constats?: unknown;
  anomalies?: unknown;
  mesures?: unknown;
  travaux?: unknown;
  recommandations?: unknown;
  charts?: unknown;
};

function asStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((i): i is string => typeof i === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function asCharts(x: unknown): ReportChartSeries[] {
  if (!Array.isArray(x)) return [];
  const out: ReportChartSeries[] = [];
  for (const c of x) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'Mesures';
    const unit = typeof o.unit === 'string' ? o.unit.trim() : '';
    const labels = asStringArray(o.labels);
    const rawVals = Array.isArray(o.values) ? o.values : [];
    const values = rawVals.map((v) => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = parseFloat(v.replace(',', '.').replace(/\s/g, ''));
        return Number.isFinite(n) ? n : NaN;
      }
      return NaN;
    }).filter((n) => !Number.isNaN(n));
    if (labels.length === 0 || labels.length !== values.length || labels.length > 14) continue;
    out.push({ title, unit, labels, values });
    if (out.length >= 6) break;
  }
  return out;
}

function uniqueStrings(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

export function llmPayloadToStructuredReport(text: string, p: LlmPayload): StructuredReport {
  const objet = uniqueStrings(asStringArray(p.objet));
  const constats = uniqueStrings(asStringArray(p.constats));
  const anomalies = uniqueStrings(asStringArray(p.anomalies));
  const mesures = uniqueStrings(asStringArray(p.mesures));
  const travaux = uniqueStrings(asStringArray(p.travaux));
  const recommandations = uniqueStrings(asStringArray(p.recommandations));
  const charts = asCharts(p.charts);

  return {
    observations: uniqueStrings([...objet, ...constats]),
    anomalies,
    consumption: mesures,
    actions: uniqueStrings([...travaux, ...recommandations]),
    rawText: text,
    _sections: { objet, constats, mesures, travaux, recommandations },
    charts: charts.length > 0 ? charts : undefined,
  };
}

function stripJsonFence(s: string): string {
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t.trim();
}

const SYSTEM_FR = `Tu es un expert en rédaction de rapports de maintenance électrique et industrielle (français).

À partir de la transcription brute, tu dois :
1) Découper en phrases ou items courts et factuels (pas de redondance inutile).
2) Classer chaque item dans UNE SEULE section parmi : objet, constats, anomalies, mesures, travaux, recommandations.
   - objet : nature / but de l’intervention (inspection, remplacement, dépannage…).
   - constats : observations terrain (bruits, fuites, aspect, odeur…) sans liste de mesures chiffrées structurées.
   - anomalies : défauts, pannes, alarmes, non-conformités.
   - mesures : valeurs mesurées (V, A, kW, kWh, Hz, THD %, température °C, etc.) — une phrase peut résumer plusieurs nombres.
   - travaux : ce qui a été fait sur place (nettoyage, serrage, remplacement effectué…).
   - recommandations : suites à donner, surveillance, prochaine visite, pièces à prévoir.
3) Si une phrase contient surtout des chiffres d’instrumentation, mets-la dans mesures.
4) charts : pour chaque jeu de valeurs comparables extraites du texte (ex. tensions L1/L2/L3, courants par phase, harmoniques H1–H5), ajoute un objet { "title", "unit", "labels", "values" } avec valeurs numériques. Maximum 4 graphiques. Uniquement si le texte contient explicitement des nombres cohérents.

Réponds par UN SEUL objet JSON valide, sans texte avant ou après, de la forme exacte :
{"objet":[],"constats":[],"anomalies":[],"mesures":[],"travaux":[],"recommandations":[],"charts":[]}`;

async function callOpenAiChat(apiKey: string, userContent: string): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.15,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_FR },
        { role: 'user', content: `Transcription à structurer :\n\n${userContent}` },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  return typeof raw === 'string' ? raw : null;
}

async function callGroqChat(apiKey: string, userContent: string): Promise<string | null> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.15,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: `${SYSTEM_FR}\nRéponds uniquement avec le JSON demandé.` },
        { role: 'user', content: `Transcription à structurer :\n\n${userContent}` },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content;
  return typeof raw === 'string' ? raw : null;
}

export type StructureReportOptions = {
  provider: TranscribeProvider;
  apiKey: string;
};

/**
 * Structuration : LLM si possible, sinon heuristique locale.
 */
export async function structureTranscriptionSmart(
  text: string,
  opts: StructureReportOptions | null
): Promise<{ report: StructuredReport; source: 'llm' | 'local' }> {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      report: { observations: [], anomalies: [], consumption: [], actions: [], rawText: text },
      source: 'local',
    };
  }

  if (opts?.apiKey) {
    try {
      const raw =
        opts.provider === 'groq'
          ? await callGroqChat(opts.apiKey, trimmed)
          : await callOpenAiChat(opts.apiKey, trimmed);
      if (raw) {
        const parsed = JSON.parse(stripJsonFence(raw)) as LlmPayload;
        const report = llmPayloadToStructuredReport(text, parsed);
        const hasCharts = report.charts && report.charts.length > 0;
        const hasSections =
          report._sections &&
          (report._sections.objet.length > 0 ||
            report._sections.constats.length > 0 ||
            report.anomalies.length > 0 ||
            report._sections.mesures.length > 0 ||
            report._sections.travaux.length > 0 ||
            report._sections.recommandations.length > 0);
        if (hasCharts || hasSections) return { report, source: 'llm' };
      }
    } catch {
      /* repli local */
    }
  }

  return { report: structureTranscription(text), source: 'local' };
}

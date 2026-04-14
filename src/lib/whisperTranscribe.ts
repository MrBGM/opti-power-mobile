/**
 * Transcription audio via Whisper — supporte OpenAI et Groq.
 *
 * Usage :
 *   const text = await transcribeAudio(audioUri, { provider: 'groq', apiKey: 'gsk_...' }, 'fr');
 */

export type TranscribeProvider = 'openai' | 'groq';

const PROVIDERS: Record<TranscribeProvider, { endpoint: string; model: string; name: string }> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
    name: 'OpenAI',
  },
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3-turbo',
    name: 'Groq',
  },
};

export interface TranscribeResult {
  text: string;
  error?: never;
}

export interface TranscribeError {
  text?: never;
  error: string;
}

export async function transcribeAudio(
  audioUri: string,
  opts: { provider: TranscribeProvider; apiKey: string },
  language = 'fr'
): Promise<TranscribeResult | TranscribeError> {
  const { provider, apiKey } = opts;
  const cfg = PROVIDERS[provider];

  if (!apiKey?.trim()) {
    return { error: `Clé API ${cfg.name} manquante. Configure-la dans Paramètres.` };
  }
  if (!audioUri) {
    return { error: 'Aucun fichier audio à transcrire.' };
  }

  try {
    const formData = new FormData();

    // React Native FormData accepte les URIs locales directement
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as unknown as Blob);

    formData.append('model', cfg.model);
    formData.append('language', language);
    formData.append('response_format', 'json');

    const response = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        // Ne PAS définir Content-Type : fetch le génère avec le boundary multipart
      },
      body: formData,
    });

    if (!response.ok) {
      const txt = await response.text();
      let msg = `Erreur ${cfg.name} Whisper (${response.status})`;
      try {
        const j = JSON.parse(txt) as { error?: { message?: string } };
        if (j?.error?.message) msg = j.error.message;
      } catch { /* ignore */ }
      return { error: msg };
    }

    const data = (await response.json()) as { text?: string };
    const text = (data.text ?? '').trim();

    if (!text) return { error: 'Transcription vide — réessaie ou parle plus clairement.' };

    return { text };
  } catch (e) {
    return { error: `Impossible de joindre ${cfg.name} : ${String(e)}` };
  }
}

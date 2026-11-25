import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface ExtractKeywordsOptions {
  total?: number; /** Nombre total de candidats (défaut 10) */
  generic?: number; /** Dont termes génériques (défaut 6) ; le reste = termes précis */
  thesaurusName?: string; /** Thésaurus visé, pour orienter la formulation (ex. « de l'UNESCO », « EuroVoc (Union européenne) ») */
}

export interface SelectDescriptorsInput {
  titre: string;
  resume: string;
  pool: string[]; /** Liste FERMÉE de libellés de descripteurs parmi lesquels choisir */
  already: string[]; /** Descripteurs déjà retenus (à ne pas répéter) */
  count: number;
}

@Injectable()
export class GoogleAiService {
  private readonly logger = new Logger(GoogleAiService.name);
  private readonly ai: GoogleGenAI;
  private readonly embeddingModel = 'gemini-embedding-001';
  private readonly textModel = 'gemini-2.5-flash';
  // Principal d'abord, secours ensuite (un modèle saturé ne l'est pas forcément en même temps que l'autre)
  private readonly summaryModels = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
  private readonly sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('REPLACE_WITH_YOUR')) {
      this.logger.warn('Google Gen AI API key is not configured properly.');
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });
  }

  /** Erreurs temporaires côté Google : surcharge, quota, timeout, réseau */
  private isTransient(e: any): boolean {
    const status = Number(e?.status ?? e?.code);
    if ([429, 500, 502, 503, 504].includes(status)) return true;
    return /UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|high demand|overloaded|timeout|fetch failed/i.test(
      e?.message ?? '',
    );
  }

  async generateEmbedding(
    text: string,
    taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY',
  ): Promise<number[]> {
    try {
      this.logger.debug(`Generating embedding for text (${text.length} chars)...`);
      const response = await this.ai.models.embedContent({
        model: this.embeddingModel,
        contents: text,
        config: { taskType },
      });
      const values = response.embeddings?.[0]?.values || [];
      this.logger.debug(`Embedding generated successfully: ${values.length} dimensions`);

      return values;
    } catch (error: any) {
      const cause = error?.cause;
      this.logger.error(
        `Failed to generate embedding: ${error?.message} | cause: ${cause?.code ?? ''} ${cause?.message ?? ''}`,
        error?.stack,
      );
      throw new Error(`Erreur lors de la génération de l'embedding: ${error?.message} (${cause?.code ?? 'no code'})`);
    }
  }

  async extractKeywords(titre: string, resume: string, options: ExtractKeywordsOptions = {}): Promise<string[]> {
    const { total = 10, generic = 6, thesaurusName } = options;
    const specific = Math.max(0, total - generic);
    const cible = thesaurusName ? `du thésaurus ${thesaurusName}` : `d'un thésaurus documentaire`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.textModel,
        contents: `Titre : ${titre}\nRésumé : ${resume}`,
        config: {
          systemInstruction:
            `Propose ${total} mots-clés candidats pour ce mémoire, en français, en minuscules, sans doublons. ` +
            `D'abord ${generic} termes génériques de discipline ou de grand thème, formulés comme des descripteurs ${cible} ` +
            `(1 à 3 mots, forme canonique : nom commun au singulier, sans article, ex. « biologie », « astronomie », « protection de l'environnement », « enseignement supérieur »), ` +
            `puis ${specific} termes précis spécifiques au sujet (1 à 3 mots, même forme canonique). ` +
            'Réponds uniquement avec un tableau JSON de chaînes.',
          responseMimeType: 'application/json',
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: 0.2,
        },
      });
      const parsed = JSON.parse(response.text ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch (e: any) {
      this.logger.warn(`Keyword extraction failed: ${e?.message}`);
      return []; // non bloquant : la soumission continue sans mots-clés
    }
  }

  async summarizePdf(pdf: Buffer, titre: string): Promise<string> {
    // Base64 calculé une seule fois (le PDF peut être lourd)
    const contents = [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: pdf.toString('base64') } },
          { text: `Titre du mémoire : ${titre}` },
        ],
      },
    ];
    const config = {
      systemInstruction:
        'Tu es documentaliste. Rédige en français un résumé de 120 à 150 mots de ce mémoire : ' +
        'problématique, méthode, principaux résultats. ' +
        "Appuie-toi surtout sur l'introduction, la conclusion et les chapitres de résultats. " +
        'Ignore la page de garde, les remerciements, la table des matières et la bibliographie. ' +
        "N'invente rien : appuie-toi uniquement sur le document. " +
        'Ne dépasse pas 130 mots. Réponds en texte brut, sans titre ni liste.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      httpOptions: { timeout: 60_000 }, // un modèle qui rame ne doit pas bloquer la soumission
    };

    for (const model of this.summaryModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await this.ai.models.generateContent({ model, contents, config });
          const text = response.text?.trim();
          if (text) {
            if (model !== this.summaryModels[0]) this.logger.log(`PDF summarized with fallback model ${model}`);
            return text;
          }
          this.logger.warn(`${model} returned an empty summary`);
          break; // réponse vide : on passe au modèle suivant
        } catch (e: any) {
          this.logger.warn(`PDF summarization failed on ${model} (attempt ${attempt}): ${e?.message}`);
          if (!this.isTransient(e)) break; // erreur non temporaire : inutile de réessayer ce modèle
          if (attempt < 2) await this.sleep(1500);
        }
      }
    }
    return ''; // l'appelant décide quoi faire (saisie manuelle du résumé)
  }

  /**
   * Choisit `count` descripteurs dans une liste FERMÉE. L'appelant doit re-valider les libellés renvoyés
   * contre la liste (le LLM peut en inventer) : seuls ceux présents dans `pool` sont retenus.
   */
  async selectDescriptors({ titre, resume, pool, already, count }: SelectDescriptorsInput): Promise<string[]> {
    if (pool.length === 0 || count <= 0) return [];
    try {
      const response = await this.ai.models.generateContent({
        model: this.textModel,
        contents:
          `Titre : ${titre}\nRésumé : ${resume.slice(0, 2000)}\n\n` +
          `Déjà retenus (ne pas répéter) : ${already.join(' ; ') || 'aucun'}\n\n` +
          `LISTE FERMÉE DE DESCRIPTEURS :\n${pool.map((l) => `- ${l}`).join('\n')}`,
        config: {
          systemInstruction:
            `Tu es documentaliste. Choisis les ${count} descripteurs de la LISTE FERMÉE qui décrivent le mieux ` +
            'le sujet de ce mémoire et qui sont complémentaires de ceux déjà retenus. ' +
            "N'invente jamais de terme : recopie les libellés EXACTEMENT comme dans la liste. " +
            "N'en choisis aucun s'il n'est pas réellement pertinent. " +
            'Réponds uniquement avec un tableau JSON de chaînes.',
          responseMimeType: 'application/json',
          responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
          temperature: 0.1,
        },
      });
      const parsed = JSON.parse(response.text ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch (e: any) {
      this.logger.warn(`Descriptor selection failed: ${e?.message}`);
      return []; // non bloquant : l'appelant a un repli lexical
    }
  }
}
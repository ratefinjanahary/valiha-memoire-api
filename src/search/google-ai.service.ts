import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';

export interface ExtractKeywordsOptions {
  /** Nombre total de candidats (défaut 10) */
  total?: number;
  /** Dont termes génériques (défaut 6) ; le reste = termes précis */
  generic?: number;
  /** Thésaurus visé, pour orienter la formulation (ex. « de l'UNESCO », « EuroVoc (Union européenne) ») */
  thesaurusName?: string;
}

export interface SelectDescriptorsInput {
  titre: string;
  resume: string;
  /** Liste FERMÉE de libellés de descripteurs parmi lesquels choisir */
  pool: string[];
  /** Descripteurs déjà retenus (à ne pas répéter) */
  already: string[];
  count: number;
}

@Injectable()
export class GoogleAiService {
  private readonly logger = new Logger(GoogleAiService.name);
  private readonly ai: GoogleGenAI;
  private readonly embeddingModel = 'gemini-embedding-001';
  private readonly textModel = 'gemini-2.5-flash'; // ou le flash courant

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('REPLACE_WITH_YOUR')) {
      this.logger.warn('Google Gen AI API key is not configured properly.');
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });
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
import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';

@Injectable()
export class GoogleAiService {
  private readonly logger = new Logger(GoogleAiService.name);
  private readonly ai: GoogleGenAI;
  private readonly embeddingModel = 'gemini-embedding-001';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.includes('REPLACE_WITH_YOUR')) {
      this.logger.warn('Google Gen AI API key is not configured properly.');
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key' });
  }

  async generateEmbedding(text: string, taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY'): Promise<number[]> {
    try {
      this.logger.debug(`Generating embedding for text (${text.length} chars)...`);
      const response = await this.ai.models.embedContent({
        model: this.embeddingModel,
        contents: text,
        config: { taskType }
      });
      const values = response.embeddings?.[0]?.values || [];
      this.logger.debug(`Embedding generated successfully: ${values.length} dimensions`);
      return values;
    } catch (error: any) {
      this.logger.error(
        `Failed to generate embedding: ${error?.message || error}`,
        error?.stack,
      );
      throw new Error(`Erreur lors de la génération de l'embedding: ${error?.message}`);
    }
  }

  async extractKeywords(titre: string, resume: string): Promise<string[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash', // ou le flash courant
        contents: `Titre : ${titre}\nRésumé : ${resume}`,
        config: {
          systemInstruction:
            "Propose 10 mots-clés candidats pour ce mémoire, en français, en minuscules, sans doublons. " +
            "D'abord 6 termes génériques de discipline ou de grand thème, formulés comme dans un thésaurus " +
            "(1 à 3 mots, ex. « biologie », « astronomie », « protection de l'environnement », « enseignement supérieur »), " +
            "puis 4 termes précis spécifiques au sujet (1 à 3 mots). " +
            "Réponds uniquement avec un tableau JSON de chaînes.",
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
}

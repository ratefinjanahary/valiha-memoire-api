import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleAiService } from './google-ai.service.js';

export interface SemanticRow {
  id: string; 
  titre: string; 
  resume: string; 
  anneeSoutenance: number;
  auteurNom: string; 
  auteurPrenom: string; 
  typeDiplome: string; 
  similarity: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: GoogleAiService,
  ) {}

  async searchSemantic(queryText: string) {
    if (!queryText) return [];

    try {
      const embedding = await this.aiService.generateEmbedding(queryText, 'RETRIEVAL_QUERY');
      if (!embedding.length) {
        throw new InternalServerErrorException("L'embedding n'a pas pu être généré.");
      }

      const embeddingString = `[${embedding.join(',')}]`;
      const floor = Number(process.env.SEMANTIC_MIN_SIMILARITY ?? 0.55); // en dessous : rien de pertinent
      const maxGap = Number(process.env.SEMANTIC_MAX_GAP ?? 0.06);      // écart toléré avec le meilleur

      const rows = await this.prisma.$queryRawUnsafe<SemanticRow[]>(`
        SELECT m.id, m.titre, m.resume, m."annee_soutenance" as "anneeSoutenance",
              m."auteur_nom" as "auteurNom", m."auteur_prenom" as "auteurPrenom",
              m."type_diplome" as "typeDiplome",
              1 - (m.embedding <=> $1::vector) as similarity
        FROM memoires m
        WHERE m.statut = 'VALIDE'
          AND m.embedding IS NOT NULL
        ORDER BY m.embedding <=> $1::vector
        LIMIT 30;
      `, embeddingString);

      const best = rows[0]?.similarity ?? 0;
      if (best < floor) return [];

      return rows.filter((r) => r.similarity >= best - maxGap).slice(0, 10);
    } catch (error: any) {
      this.logger.error(`Semantic search failed: ${error?.message}`, error?.stack);
      throw new InternalServerErrorException(error?.message || 'Semantic search failed');
    }
  }
}

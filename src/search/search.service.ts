import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleAiService } from './google-ai.service.js';
import { StatutMemoire } from '@prisma/client';
import { SearchQueryDto } from './dto/search-query.dto.js';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private aiService: GoogleAiService,
  ) {}

  async search(query: SearchQueryDto) {
    const { q, annee, universiteId, domaineId, typeDiplome } = query;

    const where: any = {
      statut: StatutMemoire.VALIDE,
    };

    if (q) {
      where.OR = [
        { titre: { contains: q, mode: 'insensitive' } },
        { resume: { contains: q, mode: 'insensitive' } },
        { auteurNom: { contains: q, mode: 'insensitive' } },
        { auteurPrenom: { contains: q, mode: 'insensitive' } },
      ];
    }
    
    if (annee) where.anneeSoutenance = parseInt(annee, 10);
    if (universiteId) where.universiteId = universiteId;
    if (domaineId) where.domaineId = domaineId;
    if (typeDiplome) where.typeDiplome = typeDiplome;

    return this.prisma.memoire.findMany({
      where,
      include: {
        universite: true,
        domaine: true,
        motsCles: { include: { motCle: true } },
        encadreurs: { include: { encadreur: true } },
      },
      orderBy: { anneeSoutenance: 'desc' },
      take: 50,
    });
  }

  async searchSemantic(queryText: string) {
    if (!queryText) return [];

    // 1. Générer l'embedding de la requête
    const embedding = await this.aiService.generateEmbedding(queryText);
    if (!embedding.length) {
      throw new Error("L'embedding n'a pas pu être généré.");
    }

    // Convertir l'array TS en string au format vector(768) pour pgvector: '[0.1, 0.2, ...]'
    const embeddingString = `[${embedding.join(',')}]`;

    // 2. Effectuer la recherche par similarité (Cosinus : 1 - (A <=> B))
    // On ne retourne que les mémoires VALIDES
    const results = await this.prisma.$queryRawUnsafe(`
      SELECT m.id, m.titre, m.resume, m."annee_soutenance" as "anneeSoutenance",
             m."auteur_nom" as "auteurNom", m."auteur_prenom" as "auteurPrenom",
             1 - (m.embedding <=> $1::vector) as similarity
      FROM memoires m
      WHERE m.statut = 'VALIDE' AND m.embedding IS NOT NULL
      ORDER BY m.embedding <=> $1::vector
      LIMIT 10;
    `, embeddingString);

    return results;
  }

  async exportBibtex(id: string) {
    const memoire = await this.prisma.memoire.findUnique({
      where: { id, statut: StatutMemoire.VALIDE },
      include: { universite: true },
    });

    if (!memoire) {
      throw new Error('Mémoire introuvable ou non validé');
    }

    const annee = memoire.anneeSoutenance;
    const author = `${memoire.auteurNom}, ${memoire.auteurPrenom}`;
    const key = `${memoire.auteurNom}${annee}`;
    
    return `@mastersthesis{${key},
  author  = {${author}},
  title   = {${memoire.titre}},
  school  = {${memoire.universite.nom}},
  year    = {${annee}},
  type    = {${memoire.typeDiplome}}
}`;
  }
}

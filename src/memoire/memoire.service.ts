import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleAiService } from '../search/google-ai.service.js';
import 'multer';
import type { IFileStorage } from '../storage/storage.interface.js';
import { FILE_STORAGE_SERVICE } from '../storage/storage.module.js';
import { StatutMemoire, TypeDiplome } from '@prisma/client';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { SubmitMemoireDto } from './dto/submit-memoire.dto.js';
import { SearchMemoireDto } from './dto/search.memoire.dto.js';
import { SimilaireQueryDto } from './dto/similaire.query.dto.js';
import { PopulariteQueryDto } from './dto/popularite.query.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../common/audit.actions.js';
import { jaccardSimilarity } from '../common/jaccard.util.js';

@Injectable()
export class MemoireService {
  private readonly logger = new Logger(MemoireService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: GoogleAiService,
    @Inject(FILE_STORAGE_SERVICE) private fileStorage: IFileStorage,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Vérifie que les encadreurs référencés existent (et que l'auteur n'est pas son propre encadreur).
   * Appelé AVANT l'upload du PDF pour ne pas laisser de fichier orphelin en cas d'erreur.
   */
  private async assertEncadreursValides(encadreurIds: string[], auteurEncadreurId?: string) {
    if (auteurEncadreurId && encadreurIds.includes(auteurEncadreurId)) {
      throw new BadRequestException("L'auteur d'un mémoire ne peut pas en être aussi l'encadreur");
    }

    const idsToCheck = auteurEncadreurId ? [...encadreurIds, auteurEncadreurId] : encadreurIds;
    const found = await this.prisma.encadreur.findMany({
      where: { id: { in: idsToCheck } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((e) => e.id));
    const missing = idsToCheck.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new BadRequestException(`Encadreur(s) introuvable(s) : ${missing.join(', ')}`);
    }
  }

  async submitMemoire(data: SubmitMemoireDto, file: Express.Multer.File, userId: string) {
    const encadreurIds = [...new Set(data.encadreurIds)];
    await this.assertEncadreursValides(encadreurIds, data.auteurEncadreurId);

    const pdfUrl = await this.fileStorage.uploadFile(file, 'memoires');

    let resume = data.resume || '';
    if (!resume) {
      try {
        const pdfData = await pdfParse(file.buffer);
        resume = pdfData.text.substring(0, 1000) + '...';
      } catch (error) {
        this.logger.error('Failed to parse PDF', error);
      }
    }

    const memoire = await this.prisma.memoire.create({
      data: {
        titre: data.titre,
        resume: resume,
        anneeSoutenance: parseInt(data.anneeSoutenance, 10),
        typeDiplome: data.typeDiplome as TypeDiplome,
        statut: StatutMemoire.EN_ATTENTE_MODERATION,
        pdfUrl: pdfUrl,
        tailleFichier: file.size,
        auteurNom: data.auteurNom,
        auteurPrenom: data.auteurPrenom,
        auteurEmail: data.auteurEmail,
        soumisParId: userId,
        universiteId: data.universiteId,
        domaineId: data.domaineId,
        auteurEncadreurId: data.auteurEncadreurId ?? null,
        encadreurs: {
          create: encadreurIds.map((encadreurId) => ({ encadreurId })),
        },
      },
    });

    try {
      const textToEmbed = `${data.titre}. ${resume}`;
      const embedding = await this.aiService.generateEmbedding(textToEmbed);
      if (embedding && embedding.length > 0) {
        const embeddingString = `[${embedding.join(',')}]`;
        await this.prisma.$executeRawUnsafe(`
          UPDATE memoires SET embedding = $1::vector WHERE id = $2;
        `, embeddingString, memoire.id);
      }
    } catch (e) {
      this.logger.error(`Error generating embedding for memoire ${memoire.id}`, e);
    }

    this.auditService.log(AuditAction.SUBMIT_MEMOIRE, userId, `memoireId:${memoire.id}`);

    return memoire;
  }

  async getPendingMemoires(page: number = 1) {
    const limit = 10;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.memoire.count({ where: { statut: StatutMemoire.EN_ATTENTE_MODERATION } }),
      this.prisma.memoire.findMany({
        where: { statut: StatutMemoire.EN_ATTENTE_MODERATION },
        include: {
          soumisPar: { select: { nom: true, prenom: true, email: true } },
          universite: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /* updateStatus — branché sur l'audit */
  async updateStatus(id: string, statut: StatutMemoire, motifRejet?: string, moderateurId?: string) {
    const updated = await this.prisma.memoire.update({
      where: { id },
      data: {
        statut,
        motifRejet: statut === StatutMemoire.REJETTE ? motifRejet : null,
      },
    });

    const action =
      statut === StatutMemoire.VALIDE
        ? AuditAction.VALIDATE_MEMOIRE
        : statut === StatutMemoire.REJETTE
          ? AuditAction.REJECT_MEMOIRE
          : undefined;

    if (action) {
      this.auditService.log(action, moderateurId, `memoireId:${id}`);
    }

    return updated;
  }

  /* Recherche par mot-clé any|all */
  async searchByKeyword(dto: SearchMemoireDto, user?: { id: string; role: string }) {
    const { q, mode, annee, typeDiplome, universiteId, domaineId, page } = dto;
    const limit = 2;
    const skip = (page - 1) * limit;

    const and: any[] = [{ statut: StatutMemoire.VALIDE }];
    if (annee) and.push({ anneeSoutenance: annee });
    if (typeDiplome) and.push({ typeDiplome });
    if (universiteId) and.push({ universiteId });
    if (domaineId) and.push({ domaineId });

    if (q && q.trim()) {
      const mots = q.trim().split(/\s+/).filter(Boolean);
      const buildWordConditions = (mot: string) => [
        { titre: { contains: mot, mode: 'insensitive' as const } },
        { resume: { contains: mot, mode: 'insensitive' as const } },
        { auteurNom: { contains: mot, mode: 'insensitive' as const } },
        { auteurPrenom: { contains: mot, mode: 'insensitive' as const } },
        { motsCles: { some: { motCle: { libelle: { contains: mot, mode: 'insensitive' as const } } } } },
      ];
      and.push(
        mode === 'any'
          ? { OR: mots.flatMap(buildWordConditions) }
          : { AND: mots.map((mot) => ({ OR: buildWordConditions(mot) })) },
      );
    }

    const where = { AND: and };

    const [total, data] = await Promise.all([
      this.prisma.memoire.count({ where }),
      this.prisma.memoire.findMany({
        where,
        select: {
          id: true,
          titre: true,
          resume: true,
          anneeSoutenance: true,
          typeDiplome: true,
          auteurNom: true,
          auteurPrenom: true,
          universite: { select: { nom: true, sigle: true } },
          domaine: { select: { nom: true } },
          motsCles: {
            select: {
              motCle: {
                select: {
                  libelle: true,
                },
              },
            },
          },
        },
        orderBy: { anneeSoutenance: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    this.auditService.log(AuditAction.SEARCH, user?.id, `q="${q ?? ''}" mode=${mode}`);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getSimilaires(id: string, dto: SimilaireQueryDto) {
    const safeLimit = Math.min(dto.limit, 20);

    const target = await this.prisma.memoire.findUnique({
      where: { id, statut: StatutMemoire.VALIDE },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException(`Mémoire ${id} introuvable ou non validé`);
    }

    // Récupérer les mots-clés de TOUS les mémoires VALIDE via $queryRaw (tagged template)
    const rows = await this.prisma.$queryRaw<Array<{ memoire_id: string; mot_cle_id: string }>>`
      SELECT mmc.memoire_id, mmc.mot_cle_id
      FROM memoire_mots_cles mmc
      INNER JOIN memoires m ON m.id = mmc.memoire_id
      WHERE m.statut = 'VALIDE'
    `;

    if (rows.length === 0) return [];

    // Construire la map memoireId → Set<motCleId>
    const motClesParMemoire = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!motClesParMemoire.has(row.memoire_id)) {
        motClesParMemoire.set(row.memoire_id, new Set());
      }
      motClesParMemoire.get(row.memoire_id)!.add(row.mot_cle_id);
    }

    const setTarget = motClesParMemoire.get(id) ?? new Set<string>();

    if (setTarget.size === 0) return [];

    /* Calculer Jaccard pour chaque autre mémoire VALIDE */
    const scores: Array<{ memoireId: string; score: number }> = [];
    for (const [memoireId, setB] of motClesParMemoire.entries()) {
      if (memoireId === id) continue;
      const score = jaccardSimilarity(setTarget, setB);
      if (score > 0) scores.push({ memoireId, score });
    }

    // Trier par score décroissant, prendre les N premiers
    scores.sort((a, b) => b.score - a.score);
    const topIds = scores.slice(0, safeLimit).map((s) => s.memoireId);

    if (topIds.length === 0) return [];

    const memoires = await this.prisma.memoire.findMany({
      where: { id: { in: topIds } },
      include: {
        universite: { select: { nom: true, sigle: true } },
        domaine: { select: { nom: true } },
        motsCles: { include: { motCle: { select: { libelle: true } } } },
      },
    });

    // Ré-attacher le score Jaccard et retourner dans l'ordre
    const scoreMap = new Map(scores.map((s) => [s.memoireId, s.score]));
    return memoires
      .map((m) => ({ ...m, jaccardScore: scoreMap.get(m.id) ?? 0 }))
      .sort((a, b) => b.jaccardScore - a.jaccardScore);
  }

  /* Récupérer un mémoire individuel et enregistrer sa consultation */
  async getMemoireWithConsultation(id: string, ipAddress: string, userAgent: string) {
    const memoire = await this.prisma.memoire.findUnique({
      where: { id },
      include: {
        universite: { select: { nom: true, sigle: true } },
        domaine: { select: { nom: true } },
        motsCles: { include: { motCle: { select: { libelle: true } } } },
        encadreurs: { include: { encadreur: true } },
      },
    });

    if (!memoire) {
      throw new NotFoundException(`Mémoire introuvable`);
    }

    if (memoire.statut === StatutMemoire.VALIDE) {
      await this.prisma.consultation.create({
        data: {
          memoireId: id,
          ipAddress,
          userAgent,
        },
      });
    }

    return memoire;
  }

  /* Statistiques de popularité par mémoire */
  async getPopulariteMemoire(id: string) {
    const memoire = await this.prisma.memoire.findUnique({
      where: { id, statut: StatutMemoire.VALIDE },
      select: { id: true, titre: true, auteurNom: true, auteurPrenom: true },
    });

    if (!memoire) {
      throw new NotFoundException(`Mémoire ${id} introuvable ou non validé`);
    }

    const count = await this.prisma.consultation.count({
      where: { memoireId: id },
    });

    return {
      memoireId: id,
      titre: memoire.titre,
      auteur: `${memoire.auteurPrenom} ${memoire.auteurNom}`,
      nbConsultations: count,
    };
  }

  /* Top global des mémoires les plus consultés */
  async getTopMemoires(dto: PopulariteQueryDto) {
    const safeLimit = Math.min(dto.limit, 100);

    /* groupBy sur consultations pour obtenir les counts */
    const grouped = await this.prisma.consultation.groupBy({
      by: ['memoireId'],
      _count: { memoireId: true },
      orderBy: { _count: { memoireId: 'desc' } },
      take: safeLimit,
    });

    if (grouped.length === 0) return [];

    const memoireIds = grouped.map((g) => g.memoireId);

    const memoires = await this.prisma.memoire.findMany({
      where: { id: { in: memoireIds }, statut: StatutMemoire.VALIDE },
      select: {
        id: true,
        titre: true,
        auteurNom: true,
        auteurPrenom: true,
        anneeSoutenance: true,
        typeDiplome: true,
        universite: { select: { nom: true, sigle: true } },
        domaine: { select: { nom: true } },
      },
    });

    /* Construire un map id → détails */
    const memoireMap = new Map(memoires.map((m) => [m.id, m]));

    /* Combiner avec les counts et retourner dans l'ordre */
    return grouped.filter((g) => memoireMap.has(g.memoireId)).map((g, index) => ({
        rang: index + 1,
        ...memoireMap.get(g.memoireId)!,
        nbConsultations: g._count.memoireId,
      }));
  }
}

/* Helpers internes */

/**
 * Construit la contrainte de statut selon le rôle de l'utilisateur.
 * PUBLIC / non authentifié → uniquement VALIDE
 * ETUDIANT → VALIDE + ses propres mémoires (OR)
 * DOCUMENTALISTE / ADMIN → aucune restriction
 */
const buildStatutFilter = (user?: { id: string; role: string }) => {
  if (!user) return { statut: StatutMemoire.VALIDE };

  switch (user.role) {
    case 'ETUDIANT':
      return {
        OR: [
          { statut: StatutMemoire.VALIDE },
          { soumisParId: user.id },
        ],
      };
    case 'DOCUMENTALISTE':
    case 'ADMIN':
      return {};
    default:
      return { statut: StatutMemoire.VALIDE };
  }
}
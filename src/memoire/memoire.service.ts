import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleAiService } from '../search/google-ai.service.js';
import 'multer';
import type { IFileStorage } from '../storage/storage.interface.js';
import { FILE_STORAGE_SERVICE } from '../storage/storage.module.js';
import { StatutMemoire, TypeDiplome, Memoire, Prisma } from '../generated/prisma/client.js';
import { PDFParse } from 'pdf-parse';
import { SubmitMemoireDto } from './dto/submit-memoire.dto.js';
import { SearchMemoireDto } from './dto/search.memoire.dto.js';
import { PopulariteQueryDto } from './dto/popularite.query.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../common/audit.actions.js';
import type { UpdateMemoireInput, ListModerationQuery } from './dto/memoire.validator.dto.js';
import { ThesaurusKeywordService } from '../thesaurus/thesaurus-keyword.service.js';
import { AutoKeywordsService } from './auto-keywords.service.js';

@Injectable()
export class MemoireService {
  private readonly logger = new Logger(MemoireService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: GoogleAiService,
    @Inject(FILE_STORAGE_SERVICE) private fileStorage: IFileStorage,
    private readonly auditService: AuditService,
    private readonly thesaurusKeywords: ThesaurusKeywordService,
    private readonly autoKeywords: AutoKeywordsService,
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

  private normaliserMotsCles(mots: string[]) {
    return [...new Set(
      mots.map((m) => m.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')).filter((m) => m.length >= 2),
    )].slice(0, 10);
  }

  /** Génère et stocke l'embedding. Non bloquant : un échec est juste loggé. */
  private async refreshEmbedding(memoireId: string, titre: string, resume: string, motsCles: string[]) {
    try {
      const textToEmbed = `${titre}. ${resume}. Mots-clés : ${motsCles.join(', ')}`;
      const embedding = await this.aiService.generateEmbedding(textToEmbed, 'RETRIEVAL_DOCUMENT');
      if (embedding && embedding.length > 0) {
        const embeddingString = `[${embedding.join(',')}]`;
        await this.prisma.$executeRawUnsafe(
          `UPDATE memoires SET embedding = $1::vector WHERE id = $2;`,
          embeddingString,
          memoireId,
        );
      }
    } catch (e) {
      this.logger.error(`Error generating embedding for memoire ${memoireId}`, e);
    }
  }

  async submitMemoire(data: SubmitMemoireDto, file: Express.Multer.File | undefined, userId: string) {
    const resumeSaisi = data.resume?.trim();
    if (!file && !resumeSaisi) {
      throw new BadRequestException("Le résumé est obligatoire lorsqu'aucun PDF n'est fourni");
    }

    const encadreurIds = [...new Set(data.encadreurIds)];
    await this.assertEncadreursValides(encadreurIds, data.auteurEncadreurId);

    const pdfUrl = file ? await this.fileStorage.uploadFile(file, 'memoires') : null;

    let memoire: Memoire;
    let resume = resumeSaisi ?? '';
    let motsCles: string[] = [];

    /* 1 - Création du mémoire en BD. Si quelque chose plante, on supprime le PDF de Drive. */
    try {
      if (!resume && file) {
        try {
          const parser = new PDFParse({ data: file.buffer });
          try {
            const { text } = await parser.getText();
            const t = text.trim();
            resume = t.length > 1000 ? t.substring(0, 1000) + '...' : t;
          } finally {
            await parser.destroy();
          }
        } catch (error) {
          this.logger.error('Failed to parse PDF', error);
        }
      }

      const saisis = !!data.motsCles?.length;
      const assoc = saisis
        ? await this.thesaurusKeywords.resolveAndUpsert(this.normaliserMotsCles(data.motsCles!), { domaineId: data.domaineId })
        : await this.autoKeywords.generateAndUpsert(data.titre, resume, data.domaineId); // `resume` = résumé final (saisi ou extrait du PDF)
      motsCles = assoc.libelles;

      memoire = await this.prisma.memoire.create({
        data: {
          titre: data.titre,
          resume,
          anneeSoutenance: parseInt(data.anneeSoutenance, 10),
          typeDiplome: data.typeDiplome as TypeDiplome,
          statut: StatutMemoire.EN_ATTENTE_MODERATION,
          pdfUrl,
          tailleFichier: file?.size ?? null,
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
          motsCles: {
            create: assoc.motCleIds.map((motCleId) => ({ motCleId })),
          },
        },
      });
    } catch (error) {
      // Rollback : pas de PDF orphelin sur Drive
      if (pdfUrl) await this.fileStorage.deleteFile(pdfUrl);
      throw error;
    }

    /* 2 - Embedding : non bloquant */
    await this.refreshEmbedding(memoire.id, data.titre, resume, motsCles);

    this.auditService.log(AuditAction.SUBMIT_MEMOIRE, userId, `memoireId:${memoire.id}`);

    return memoire;
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

  async getModerationList(query: ListModerationQuery) {
    const { statut, page, limit } = query;
    const where: Prisma.MemoireWhereInput = statut ? { statut } : {};

    const [total, data] = await Promise.all([
      this.prisma.memoire.count({ where }),
      this.prisma.memoire.findMany({
        where,
        include: {
          soumisPar: { select: { nom: true, prenom: true, email: true } },
          universite: true,
          domaine: true,
          motsCles: { include: { motCle: { select: { id: true, libelle: true } } } },
          encadreurs: { include: { encadreur: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /* Modification d'un mémoire BROUILLON / EN_ATTENTE_MODERATION / REJETTE (le statut n'est pas modifié ici) */
  async updateMemoire(id: string, dto: UpdateMemoireInput, userId?: string) {
    const existing = await this.prisma.memoire.findUnique({
      where: { id },
      select: {
        id: true,
        statut: true,
        titre: true,
        resume: true,
        domaineId: true,
        auteurEncadreurId: true,
        encadreurs: { select: { encadreurId: true } },
        motsCles: { select: { motCle: { select: { libelle: true } } } },
      },
    });

    if (!existing) throw new NotFoundException('Mémoire introuvable');

    // Références (FK) : on renvoie un 400 propre plutôt qu'une erreur Prisma P2003
    if (dto.universiteId) {
      const u = await this.prisma.universite.findUnique({ where: { id: dto.universiteId }, select: { id: true } });
      if (!u) throw new BadRequestException('Université introuvable');
    }
    if (dto.domaineId) {
      const d = await this.prisma.domaine.findUnique({ where: { id: dto.domaineId }, select: { id: true } });
      if (!d) throw new BadRequestException('Domaine introuvable');
    }

    // Encadreurs : on valide la combinaison finale (valeurs envoyées + valeurs existantes)
    const encadreurIds = dto.encadreurIds
      ? [...new Set(dto.encadreurIds)]
      : existing.encadreurs.map((e) => e.encadreurId);
    const auteurEncadreurId =
      dto.auteurEncadreurId !== undefined ? dto.auteurEncadreurId : existing.auteurEncadreurId;

    if (dto.encadreurIds !== undefined || dto.auteurEncadreurId !== undefined) {
      await this.assertEncadreursValides(encadreurIds, auteurEncadreurId ?? undefined);
    }

    const titre = dto.titre ?? existing.titre;
    const resume = dto.resume ?? existing.resume;

    // Mots-clés : tableau vide => extraction IA, comme à la soumission
    let motsCles: string[] | undefined;
    let motCleIds: string[] | undefined;
    if (dto.motsCles !== undefined) {
      const saisis = !!dto.motsCles.length;
      const domaineId = dto.domaineId ?? existing.domaineId;
      // Saisis : descripteur si trouvé, sinon mot libre. Vide : génération auto (6 descripteurs visés)
      const assoc = saisis
        ? await this.thesaurusKeywords.resolveAndUpsert(this.normaliserMotsCles(dto.motsCles), { domaineId })
        : await this.autoKeywords.generateAndUpsert(titre, resume, domaineId);
      motsCles = assoc.libelles;
      motCleIds = assoc.motCleIds;
    }

    const { encadreurIds: _enc, motsCles: _mc, ...scalaires } = dto;
    const data: Prisma.MemoireUncheckedUpdateInput = { ...scalaires };

    if (dto.encadreurIds !== undefined) {
      data.encadreurs = {
        deleteMany: {},
        create: encadreurIds.map((encadreurId) => ({ encadreurId })),
      };
    }
    if (motCleIds) {
      data.motsCles = {
        deleteMany: {},
        create: motCleIds.map((motCleId) => ({ motCleId })),
      };
    }

    const updated = await this.prisma.memoire.update({
      where: { id },
      data,
    });

    // Le texte embarqué dépend du titre, du résumé et des mots-clés
    if (dto.titre !== undefined || dto.resume !== undefined || motsCles) {
      const libelles = motsCles ?? existing.motsCles.map((m) => m.motCle.libelle);
      await this.refreshEmbedding(id, titre, resume, libelles);
    }

    this.auditService.log(AuditAction.UPDATE_MEMOIRE, userId, `memoireId:${id}`);

    return updated;
  }

  async deleteMemoire(id: string, userId?: string) {
    const existing = await this.prisma.memoire.findUnique({
      where: { id },
      select: { id: true, statut: true, pdfUrl: true },
    });

    if (!existing) throw new NotFoundException('Mémoire introuvable');
    await this.prisma.memoire.delete({ where: { id } });

    // BD d'abord, fichier ensuite : en cas d'échec on a au pire un PDF orphelin (loggé),
    // jamais une fiche sans PDF
    const { pdfUrl } = existing;
    if (pdfUrl) {
      try {
        await this.fileStorage.deleteFile(pdfUrl);
      } catch (e) {
        this.logger.warn(`PDF non supprimé pour le mémoire ${id} (${pdfUrl})`, e);
      }
    }
    this.auditService.log(AuditAction.DELETE_MEMOIRE, userId, `memoireId:${id}`);

    return { id, deleted: true };
  }

  /* Recherche par mot-clé any|all */
  async searchByKeyword(dto: SearchMemoireDto, user?: { id: string; role: string }) {
    const { q, mode, annee, typeDiplome, universiteId, domaineId, page } = dto;
    const limit = 9;
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /* Récupérer un mémoire individuel et enregistrer sa consultation */

  async getMemoireWithConsultation(id: string, ipAddress: string, userAgent: string) {
    const memoire = await this.prisma.memoire.findUnique({
      where: { id },
      include: {
        universite: { select: { nom: true, sigle: true } },
        domaine: { select: { nom: true } },
        motsCles: { include: { motCle: { select: { id: true, libelle: true, descripteurUri: true, thesaurus: true } } } },
        encadreurs: { include: { encadreur: true } },
      },
    });

    if (!memoire) {
      throw new NotFoundException(`Mémoire introuvable`);
    }

    if (memoire.statut === StatutMemoire.VALIDE) {
      try {
        await this.prisma.consultation.create({
          data: {
            memoireId: id,
            ipAddress: ipAddress.slice(0, 45),
            userAgent: userAgent.slice(0, 255),
          },
        });
      } catch (e) {
        this.logger.error(`Échec enregistrement consultation (mémoire ${id})`, e instanceof Error ? e.stack : e);
      }
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
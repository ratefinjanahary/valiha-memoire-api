
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleAiService } from '../search/google-ai.service.js';
import 'multer';
import type { IFileStorage } from '../storage/storage.interface.js';
import { FILE_STORAGE_SERVICE } from '../storage/storage.module.js';
import { StatutMemoire, TypeDiplome } from '@prisma/client';
// @ts-ignore
import pdfParse from 'pdf-parse';
import { SubmitMemoireDto } from './dto/submit-memoire.dto.js';

@Injectable()
export class MemoireService {
  private readonly logger = new Logger(MemoireService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: GoogleAiService,
    @Inject(FILE_STORAGE_SERVICE) private fileStorage: IFileStorage,
  ) {}

  async submitMemoire(data: SubmitMemoireDto, file: Express.Multer.File, userId: string) {
    // 1. Sauvegarder le fichier PDF
    const pdfUrl = await this.fileStorage.uploadFile(file, 'memoires');

    // 2. Extraire le texte du PDF
    let resume = data.resume || '';
    if (!resume) {
      try {
        const pdfData = await pdfParse(file.buffer);
        // On prend les 1000 premiers caractères comme résumé si non fourni
        resume = pdfData.text.substring(0, 1000) + '...';
      } catch (error) {
        this.logger.error('Failed to parse PDF', error);
      }
    }

    // 3. Créer le mémoire dans la BDD
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
      },
    });

    // 4. Calculer l'embedding de manière asynchrone (ou synchrone)
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

    return memoire;
  }

  async getPendingMemoires() {
    return this.prisma.memoire.findMany({
      where: { statut: StatutMemoire.EN_ATTENTE_MODERATION },
      include: {
        soumisPar: { select: { nom: true, prenom: true, email: true } },
        universite: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, statut: StatutMemoire, motifRejet?: string) {
    return this.prisma.memoire.update({
      where: { id },
      data: {
        statut,
        motifRejet: statut === StatutMemoire.REJETTE ? motifRejet : null,
      },
    });
  }
}

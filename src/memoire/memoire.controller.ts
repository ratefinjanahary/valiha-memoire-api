import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  Get,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import { MemoireService } from './memoire.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../auth/role.enum.js';
import { StatutMemoire } from '@prisma/client';
import { SubmitMemoireDto } from './dto/submit-memoire.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { SearchMemoireDto } from './dto/search.memoire.dto.js';
import { SimilaireQueryDto } from './dto/similaire.query.dto.js';
import { PopulariteQueryDto } from './dto/popularite.query.dto.js';

@Controller('api')
export class MemoireController {
  constructor(private readonly memoireService: MemoireService) {}

  // ─────────────────────────────────────────────────────────────
  // EXISTANT : Soumettre un mémoire
  // ─────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('memoires/submit')
  @UseInterceptors(FileInterceptor('file'))
  async submitMemoire(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: SubmitMemoireDto,
    @Request() req: any,
  ) {
    if (!file) {
      throw new Error('Le fichier PDF est requis');
    }
    return this.memoireService.submitMemoire(body, file, req.user.id);
  }

  // ─────────────────────────────────────────────────────────────
  // EXISTANT : Mémoires en attente de modération
  // ─────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCUMENTALISTE, Role.ADMIN)
  @Get('moderation/pending')
  async getPending() {
    return this.memoireService.getPendingMemoires();
  }

  // ─────────────────────────────────────────────────────────────
  // EXISTANT : Mettre à jour le statut
  // ─────────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCUMENTALISTE, Role.ADMIN)
  @Patch('moderation/:id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.memoireService.updateStatus(id, body.statut, body.motifRejet, req.user.id);
  }

  // ─────────────────────────────────────────────────────────────
  // FEATURE 1 : Recherche par mot-clé any|all
  // Route statique — DOIT être AVANT /:id/...
  // ─────────────────────────────────────────────────────────────
  /**
   * GET /api/memoires/search
   *
   * Recherche les mémoires par mots-clés.
   * - `mode=any` (défaut) : au moins un mot matche
   * - `mode=all` : tous les mots doivent matcher
   *
   * Rôle PUBLIC → uniquement VALIDE
   * Rôle ETUDIANT → VALIDE + ses propres mémoires
   * Rôle DOC/ADMIN → tout
   */
  @Get('memoires/search')
  async searchByKeyword(
    @Query() query: SearchMemoireDto,
    @Request() req: any,
  ) {
    // L'endpoint est public mais on lit le user s'il est connecté
    return this.memoireService.searchByKeyword(query, req.user);
  }

  // ─────────────────────────────────────────────────────────────
  // FEATURE 7 : Top global des mémoires les plus consultés
  // Route statique — DOIT être AVANT /:id/...
  // ─────────────────────────────────────────────────────────────
  /**
   * GET /api/memoires/top
   *
   * Classement global des mémoires VALIDE par nombre de consultations.
   * Accessible sans authentification.
   *
   * @query limit - Nombre de résultats (1-100, défaut 10)
   */
  @Get('memoires/top')
  async getTop(@Query() query: PopulariteQueryDto) {
    return this.memoireService.getTopMemoires(query);
  }

  // ─────────────────────────────────────────────────────────────
  // FEATURE 4 : Recommandation Jaccard
  // ─────────────────────────────────────────────────────────────
  /**
   * GET /api/memoires/:id/similaires
   *
   * Retourne les mémoires VALIDE les plus similaires via l'indice de Jaccard
   * calculé sur les mots-clés communs. Accessible sans authentification.
   *
   * @param id - UUID du mémoire cible
   * @query limit - Nombre de suggestions (1-20, défaut 5)
   */
  @Get('memoires/:id/similaires')
  async getSimilaires(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SimilaireQueryDto,
  ) {
    return this.memoireService.getSimilaires(id, query);
  }

  // ─────────────────────────────────────────────────────────────
  // FEATURE 7 : Popularité d'un mémoire spécifique
  // ─────────────────────────────────────────────────────────────
  /**
   * GET /api/memoires/:id/popularite
   *
   * Retourne le nombre total de consultations d'un mémoire VALIDE.
   * Accessible sans authentification.
   */
  @Get('memoires/:id/popularite')
  async getPopularite(@Param('id', ParseUUIDPipe) id: string) {
    return this.memoireService.getPopulariteMemoire(id);
  }
}

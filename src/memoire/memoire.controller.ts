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
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../auth/role.enum.js';
import { SubmitMemoireDto } from './dto/submit-memoire.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { SearchMemoireDto } from './dto/search.memoire.dto.js';
import { SimilaireQueryDto } from './dto/similaire.query.dto.js';
import { PopulariteQueryDto } from './dto/popularite.query.dto.js';

@Controller('api')
export class MemoireController {
  constructor(private readonly memoireService: MemoireService) {}

  /* Soumettre un mémoire existant */
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

  /* Mémoires en attente de modération existant */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCUMENTALISTE, Role.ADMIN)
  @Get('moderation/pending')
  async getPending(@Query('page') page?: string) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    return this.memoireService.getPendingMemoires(pageNumber > 0 ? pageNumber : 1);
  }

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

  /* Recherche par mot-clé any|all existant */
  @UseGuards(OptionalJwtGuard)
  @Get('memoires/search')
  async searchByKeyword(
    @Query() query: SearchMemoireDto,
    @Request() req: any,
  ) {
    return this.memoireService.searchByKeyword(query, req.user);
  }

  @Get('memoires/top')
  async getTop(@Query() query: PopulariteQueryDto) {
    return this.memoireService.getTopMemoires(query);
  }

  @Get('memoires/:id/similaires')
  async getSimilaires(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SimilaireQueryDto,
  ) {
    return this.memoireService.getSimilaires(id, query);
  }

  @Get('memoires/:id/popularite')
  async getPopularite(@Param('id', ParseUUIDPipe) id: string) {
    return this.memoireService.getPopulariteMemoire(id);
  }

  @Get('memoires/:id')
  async getMemoire(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    const userAgent = req.headers['user-agent'] || '';
    return this.memoireService.getMemoireWithConsultation(id, ip, userAgent);
  }
}

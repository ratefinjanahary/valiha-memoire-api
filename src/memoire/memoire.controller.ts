import { Controller, Post, Body, UseInterceptors, UploadedFile, UseGuards, Request, Get, Patch, Param } from '@nestjs/common';
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

@Controller('api')
export class MemoireController {
  constructor(private readonly memoireService: MemoireService) {}

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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCUMENTALISTE, Role.ADMIN)
  @Get('moderation/pending')
  async getPending() {
    return this.memoireService.getPendingMemoires();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCUMENTALISTE, Role.ADMIN)
  @Patch('moderation/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
  ) {
    return this.memoireService.updateStatus(id, body.statut, body.motifRejet);
  }
}

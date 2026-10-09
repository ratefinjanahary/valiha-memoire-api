import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EncadreurService } from './encadreur.service.js';
import { CreateEncadreurDto } from './dto/create-encadreur.dto.js';
import { SearchEncadreurDto } from './dto/search-encadreur.dto.js';

@Controller('api/encadreurs')
export class EncadreurController {
  constructor(private readonly encadreurService: EncadreurService) {}

  /** GET /api/encadreurs?q=rakoto&page=1&limit=10 */
  @Get()
  search(@Query() query: SearchEncadreurDto) {
    return this.encadreurService.search(query);
  }

  /** POST /api/encadreurs  { nom, prenom, titre?, email? } */
  // TODO: protéger avec tes guards d'auth existants (utilisateur connecté au minimum)
  @Post()
  create(@Body() dto: CreateEncadreurDto) {
    return this.encadreurService.create(dto);
  }
}

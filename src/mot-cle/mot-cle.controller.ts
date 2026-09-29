import { Controller, Get, Query } from '@nestjs/common';
import { MotCleService } from './mot-cle.service.js';
import { TrendingQueryDto } from './dto/trending.query.dto.js';

@Controller('api/mot-cles')
export class MotCleController {
  constructor(private readonly motCleService: MotCleService) {}

  /**
   * GET /api/mot-cles/trending
   * Retourne les mots-clés les plus utilisés sur les mémoires VALIDE.
   * Résultat mis en cache (TTL 5 min). Accessible sans authentification.
   *
   * @query limit - Nombre de résultats (1-50, défaut 10)
   */
  @Get('trending')
  async getTrending(@Query() query: TrendingQueryDto) {
    return this.motCleService.getTrending(query.limit);
  }
}

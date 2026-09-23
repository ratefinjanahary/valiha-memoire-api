import { Controller, Get, Post, Body, Query, Param, Res } from '@nestjs/common';
import { SearchService } from './search.service.js';
import type { Response } from 'express';
import { SearchQueryDto } from './dto/search-query.dto.js';
import { SearchSemanticDto } from './dto/search-semantic.dto.js';

@Controller('api/memoires')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search')
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Post('search-semantic')
  async searchSemantic(@Body() body: SearchSemanticDto) {
    return this.searchService.searchSemantic(body.query);
  }

  @Get(':id/export-bibtex')
  async exportBibtex(@Param('id') id: string, @Res() res: Response) {
    try {
      const bibtex = await this.searchService.exportBibtex(id);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="memoire-${id}.bib"`);
      return res.send(bibtex);
    } catch (error: any) {
      return res.status(404).json({ message: error.message });
    }
  }
}

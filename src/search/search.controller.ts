import { Controller, Post, Body } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { SearchSemanticDto } from './dto/search-semantic.dto.js';

@Controller('api/memoires')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('search-semantic')
  async searchSemantic(@Body() body: SearchSemanticDto) {
    return this.searchService.searchSemantic(body.query);
  }
}

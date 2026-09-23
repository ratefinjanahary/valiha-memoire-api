import { Module } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { SearchController } from './search.controller.js';
import { GoogleAiService } from './google-ai.service.js';

@Module({
  providers: [SearchService, GoogleAiService],
  controllers: [SearchController],
  exports: [SearchService, GoogleAiService],
})
export class SearchModule {}

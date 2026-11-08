import { Module } from '@nestjs/common';
import { MemoireService } from './memoire.service.js';
import { MemoireController } from './memoire.controller.js';
import { SearchModule } from '../search/search.module.js';
import { ThesaurusModule } from '../thesaurus/thesaurus.module.js';
import { AutoKeywordsService } from './auto-keywords.service.js';

@Module({
  imports: [SearchModule, ThesaurusModule],
  providers: [MemoireService, AutoKeywordsService],
  controllers: [MemoireController],
})
export class MemoireModule {}

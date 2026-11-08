import { Module } from '@nestjs/common';
import { createStrategies } from './strategies/strategy.factory.js';
import { buildThesaurusConfig } from './thesaurus.config.js';
import type { ThesaurusConfig } from './thesaurus.schemas.js';
import { THESAURUS_CONFIG, THESAURUS_STRATEGIES } from './thesaurus.types.js';
import { ThesaurusKeywordService } from './thesaurus-keyword.service.js';
import { ThesaurusRoutingService } from './thesaurus-routing.service.js';

@Module({
  providers: [
    // Échoue au boot si une variable d'environnement est invalide (Zod)
    { provide: THESAURUS_CONFIG, useFactory: (): ThesaurusConfig => buildThesaurusConfig() },
    {
      provide: THESAURUS_STRATEGIES,
      useFactory: (config: ThesaurusConfig) => createStrategies(config),
      inject: [THESAURUS_CONFIG],
    },
    ThesaurusRoutingService,
    ThesaurusKeywordService,
  ],
  exports: [ThesaurusRoutingService, ThesaurusKeywordService],
})
export class ThesaurusModule {}

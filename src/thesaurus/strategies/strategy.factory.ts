import { THESAURUS_IDS, type ThesaurusConfig } from '../thesaurus.schemas.js';
import type { ThesaurusStrategy } from '../thesaurus.types.js';
import { SkosmosStrategy } from './skosmos.strategy.js';
import { SparqlStrategy } from './sparql.strategy.js';
import { SPARQL_QUERY_BUILDERS } from './sparql-queries.js';

export function createStrategies(config: ThesaurusConfig): ThesaurusStrategy[] {
  return THESAURUS_IDS.map((id): ThesaurusStrategy => {
    const cfg = config[id];
    if (cfg.kind === 'skosmos') return new SkosmosStrategy(id, cfg);

    const builder = SPARQL_QUERY_BUILDERS[id];
    if (!builder) throw new Error(`Aucun constructeur de requête SPARQL pour le thésaurus ${id}`);
    return new SparqlStrategy(id, cfg, builder);
  });
}

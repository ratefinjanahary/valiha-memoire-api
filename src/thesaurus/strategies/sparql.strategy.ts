import type { SparqlEndpoint, ThesaurusId } from '../thesaurus.schemas.js';
import { SparqlJsonSchema } from '../thesaurus.schemas.js';
import { fetchJson } from '../thesaurus.resilience.js';
import {
  ThesaurusApiError,
  type SearchMode,
  type ThesaurusCandidate,
  type ThesaurusStrategy,
} from '../thesaurus.types.js';
import type { SparqlQueryBuilder } from './sparql-queries.js';

const SPARQL_JSON = 'application/sparql-results+json';

/** Stratégie SPARQL générique : seul le constructeur de requête change (Eurovoc, RAMEAU, Getty AAT). */
export class SparqlStrategy implements ThesaurusStrategy {
  constructor(
    readonly id: ThesaurusId,
    private readonly cfg: SparqlEndpoint,
    private readonly buildQuery: SparqlQueryBuilder,
  ) {}

  async search(term: string, mode: SearchMode): Promise<ThesaurusCandidate[]> {
    const query = this.buildQuery({ term, mode, lang: this.cfg.lang });
    const params = new URLSearchParams({ query, format: SPARQL_JSON });

    const json = await fetchJson(`${this.cfg.endpointUrl}?${params.toString()}`, {
      timeoutMs: this.cfg.timeoutMs,
      headers: { Accept: `${SPARQL_JSON}, application/json;q=0.9` },
    });

    const parsed = SparqlJsonSchema.safeParse(json);
    if (!parsed.success) throw new ThesaurusApiError(`Réponse SPARQL ${this.id} inattendue`, false);

    // Un concept peut sortir sur plusieurs lignes (prefLabel + synonymes) : on regroupe par URI
    const byUri = new Map<string, { uri: string; prefLabel: string; alt: Set<string> }>();
    for (const row of parsed.data.results.bindings) {
      const uri = row.concept?.value;
      const prefLabel = row.prefLabel?.value;
      if (!uri || !prefLabel) continue;

      const entry = byUri.get(uri) ?? { uri, prefLabel, alt: new Set<string>() };
      const matched = row.matched?.value;
      if (matched && matched !== prefLabel) entry.alt.add(matched);
      byUri.set(uri, entry);
    }

    return [...byUri.values()].map((e) => ({ uri: e.uri, prefLabel: e.prefLabel, altLabels: [...e.alt] }));
  }
}
